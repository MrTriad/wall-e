from options import initialize_options
from style import style
import asyncio
from db import insertOrigin, create_async_pool, selectOriginByDomain, insertOriginHistory

from telethon.sync import TelegramClient
import os, re

from sentinel import get_channel_info


api_id = os.getenv("TELEGRAM_API_ID")
api_hash = os.getenv("TELEGRAM_API_HASH")
bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
phone_number = os.getenv("TELEGRAM_PHONE_NUMBER")

ROOT_PATH = os.getenv('ROOT_PATH')

if( phone_number and api_id and api_hash):
	client = TelegramClient(phone_number, int(api_id), api_hash)

async def main():

	print(style.sysinfo("Welcome to the telegram insert! Setting up so you're ready to go"))

	argv = initialize_options()

	if argv.AddOrigin:
		##############################################################
		### Client initialization ####################################
		if(client and phone_number):
			await client.start(phone_number)   # type: ignore
			me = await client.get_me()
			if(not me):
				print(style.error("Connection to the client failed"))
				return -1
			print(style.info(f"Client online with user {me.username}")) # type: ignore
		else:
			print(style.error("Connection to the client failed"))
			return -1
			
		##############################################################   //TODO Questa andrebbe cambiata da pool a conn, stesso adattamento alle richieste poi
		### Database initialization ##################################

		pool = await create_async_pool()
		if (not pool):
			print(style.error("Connection to the DB failed"))
			return -1
		print(style.info(f"Database connected"))
		
		##############################################################

		if re.match(r"^-[0-9]{13}$", argv.AddOrigin):
			domain = int(argv.AddOrigin)
		else:
			domain = argv.AddOrigin

		print(style.sysinfo(f"Adding the requested new domain: {domain}"))

		rows = await selectOriginByDomain(pool=pool, domain=domain)

		if rows != None and len(rows) == 0:
			additional_infos = await get_channel_info(client, domain)
			if(additional_infos):
				origin = {
					'domain': domain,
					'name': None,
					'is_dead_score': 0,
					'category': 1 # 0 cleanweb, 1 telegram, 2 dark
				}

				_id_origin = await insertOrigin(pool=pool, origin=origin)
				if(_id_origin):
					print(style.success(f'The origin {domain} has been added to the database. Assigned ID: {_id_origin}'))

					origin_history = {
						'additional_infos': str(additional_infos),
						'_id_origin': _id_origin
					}

					_id_origin_history = await insertOriginHistory(pool=pool, origin_history=origin_history) #TODO servirebbe un pezzo di parser che non prenda e metta dentro tutte le info come history ma selezioni un po' la roba importante
					if(_id_origin_history):
						print(style.success(f'The origin history associated to {domain} has been added to the database. Assigned ID: {_id_origin_history}'))
					else:
						print(style.error(f'Critical error while inserting the origin_history associated to the domain: {domain}'))

				else:
					print(style.error(f'Critical error while inserting the origin: {domain}'))
			else:
				print(style.error(f'The origin {domain} does not respond to telegram API, check the name inserted'))
		else:
			print(style.error(f'Origin {domain} already present in the db'))
	

if __name__ == "__main__":
	asyncio.get_event_loop().run_until_complete(main())