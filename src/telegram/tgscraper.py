from datetime import datetime, timedelta
import asyncio, subprocess, logging, pytz, os, json, sys

from telethon.tl.types import DocumentAttributeFilename
import re
from dotenv import load_dotenv

from client import initialize_client
from db import create_async_pool, selectOrigins, insertOriginHistory, insertSource, selectSourceTegramByDomainAndMessage, updateOriginDeadScore, updateOriginLastChecked
from sentinel import get_channel_info, parse_channel_info

##############################################################
### config.json and env SETUP ################################

load_dotenv()

with open(os.path.join(os.path.dirname(__file__), '../../config.json')) as f:
	config = json.load(f)

	CHECK_HISTORY_OFFSET = config["Telegram"]["CHECK_HISTORY_OFFSET"]
	LOG_LEVEL = config["Telegram"]["LOG_LEVEL"]
	SUPPORTED_FILETYPES = config["General"]["SUPPORTED_FILETYPES"]
	ROOT_PATH = config["General"]["ROOT_PATH"]

if(not (CHECK_HISTORY_OFFSET and SUPPORTED_FILETYPES and ROOT_PATH)):
	sys.exit(-1)

##############################################################
### logging setup ############################################

log_level = LOG_LEVEL

# CRITICAL	50
# ERROR		40
# WARNING	30
# INFO		20
# DEBUG		10
# NOTSET	0

logging.basicConfig(format='%(asctime)s %(levelname)s:%(message)s', level=logging.CRITICAL, datefmt='%d/%m/%Y %H:%M:%S')
logging = logging.getLogger(__name__)
logging.setLevel(log_level)

##############################################################

# Message and array of supported files
def is_supported_filetype(message, supported_filetypes):
	if hasattr(message.media, 'document'):
		document = message.media.document
		if isinstance(document.attributes[0], DocumentAttributeFilename):
			file_name = document.attributes[0].file_name.lower()
			return any(file_name.endswith('.' + ext) for ext in supported_filetypes)
	return False


async def download_supported_files(pool, client, supported_filetypes, _id_origin, domain, last_checked):
	
	if(not last_checked):
		last_checked = 0

	new_checked = last_checked # Created to compare between old offset and possible new offset

	async for message in client.iter_messages(domain, reverse=True , offset_id = last_checked): 

		new_checked = message.id

		if is_supported_filetype(message, supported_filetypes):

			source = {
				'spam_score': 0,
				'published_time': message.date,
				'_id_origin': _id_origin,
				'_id_author': None # FIXME 3 Qui si può festeggiare ma va pensata un pelo
			}

			source_telegram = {
				'_id_source_telegram': message.id,
				'message_text': message.raw_text,
				'views_count': message.views,
				'shares_count': message.forwards
			}

			checkSource = await selectSourceTegramByDomainAndMessage(pool=pool, domain=domain, _id_source_telegram=source_telegram['_id_source_telegram'])

			if(checkSource != None):
				if(len(checkSource) == 0 ):
					_id_source = await insertSource(pool, source, source_telegram) # WARN Non testata domani piuttosto fanne una unica che crea in una singola transizione source e collegato source_telegram
					if(_id_source):
						logging.info('Valid source found with ID: %s', _id_source)
						file_name = message.media.document.attributes[0].file_name
						logging.info('Downloading %s', file_name)
						file_path = os.path.join(ROOT_PATH, 'src/telegram/supported_files', file_name)
						await client.download_media(message, file=file_path)
						call_node_script(os.path.join(ROOT_PATH,"src/HalScripts/halAnalyzeDBs.js"), args=[("--target_file="+file_path),('--source_id='+str(_id_source))])
				elif(len(checkSource) == 1 ):
					logging.warning('Found source already scraped for domain %s with assigned source_telegram ID: %s', domain, str(source_telegram['_id_source_telegram']))
				else:
					logging.critical('Found multiple source lines assigned to the domain: %s. Error found with source_telegram ID: %s', domain, str(source_telegram['_id_source_telegram']))
			else:
				logging.error('Error while checking source existance for domain %s', domain)

	if last_checked == new_checked:
		logging.info('No new messages for origin_id: %s - %s', _id_origin, domain)
	else:
		if (await updateOriginLastChecked(pool, new_checked, _id_origin) == new_checked): # type: ignore
			logging.info('Last checked for origin %s - %s updated at %s', _id_origin, domain, new_checked)
		else:
			logging.error('Error while updating last_checked for origin %s - %s', _id_origin, domain)


	
def call_node_script(script_path, args=None):
	logging.debug('Calling node subprocess %s', script_path)
	command = ["node", script_path]
	
	if args:
		command.extend(args)
	
	try:
		result = subprocess.run(command, capture_output=True, text=True)
		if result.returncode == 0:
			logging.debug('Subprocess executed successfully')
			logging.info(result.stdout)
		else:
			logging.error('Subprocess execution failed.\n%s',result.stderr)
	except FileNotFoundError:
		print("Node.js interpreter not found. Please make sure Node.js is installed.")

async def main():
	logging.info('Welcome to the still unnamed telgram scraper! Initializiating the components:')

	os.makedirs('supported_files', exist_ok=True)

	##############################################################
	### Client initialization ####################################

	client = await initialize_client()
	if(client):
		me = await client.get_me() 
		logging.info('Client online with user %s', me.username) # type: ignore
	else:
		logging.error('Connection to the client failed')
		return -1

	##############################################################
	### Database initialization ##################################

	pool = await create_async_pool()
	if (pool):
		logging.info('Database connected')
	else:
		logging.error('Connection to the DB failed')
		return -1
	
	##############################################################

	logging.info('Looking for supported files of type: %s', SUPPORTED_FILETYPES)

	telegram_origins = await selectOrigins(pool=pool) # type: ignore

	if(telegram_origins):
		logging.info('Sourced %s origins from the database', len(telegram_origins))
		for origin in telegram_origins:
			_id_origin = origin['_id_origin']  # Non riesco a capire come farmi una strutturina al volo, non molto pratico di python ^^' Boh mettermi a far classi per questo mi sembra un po' eeh
			last_checked_id = origin['last_checked']
			updated_time = origin['updated_time']
			is_dead_score = origin['is_dead_score']

			if re.match(r"^-[0-9]{13}$", origin['domain']):
				domain = int(origin['domain'])
			else:
				domain = origin['domain']

			additional_infos = await get_channel_info(client=client, channel_username=domain)
			if(additional_infos): # Channel still alive
				### Check freshness history

				if (datetime.utcnow().replace(tzinfo=pytz.UTC) - updated_time) > timedelta(milliseconds=CHECK_HISTORY_OFFSET):
					logging.info('The source %s looks kinda dusty. Time to refresh its data', _id_origin)

					if((await updateOriginDeadScore(pool=pool, is_dead_score=0, _id_origin=_id_origin)) == 0): # type: ignore
						logging.info('Dead score resetted for origin_id: %s - %s', _id_origin, domain)
					
					parsed_additional_infos = await parse_channel_info(additional_infos)

					if(parsed_additional_infos):
						origin_history = {
							'additional_infos': str( additional_infos),
							'_id_origin': _id_origin
						}
						_id_origin_history = await insertOriginHistory(pool=pool, origin_history=origin_history) # type: ignore
						if(_id_origin_history):
							logging.info('A new origin history associated to origin_id: %s - %s has been added to the database. Assigned history ID: %s', _id_origin, domain, _id_origin_history)
						else:
							logging.error('Error while inserting a new origin_history associated to the origin_id: %s - %s', _id_origin, domain)
			
				### Gathering valid filetype sources

				await download_supported_files(pool, client, SUPPORTED_FILETYPES, _id_origin, domain, last_checked_id)

				logging.info('Search terminated for the origin_id: %s - %s, files saved in the "supported_files" folder ^w^', _id_origin, domain)

			else: # Not responding, increase deadness
				logging.error('The origin_id: %s - %s does not respond to telegram API, check the name inserted', _id_origin, domain)

				if(await updateOriginDeadScore(pool=pool, is_dead_score=is_dead_score+1, _id_origin=_id_origin) == is_dead_score+1): # type: ignore
					logging.info('Dead score incremented for origin_id: %s - %s', _id_origin, domain)
	
	else:
		logging.error('Error while retrieving the origins from the database ;w; Check the database or ensure to add telegram origins via tginsert.py')


if __name__ == "__main__":
	asyncio.get_event_loop().run_until_complete(main())