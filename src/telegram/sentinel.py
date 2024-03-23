
from telethon.tl.functions.channels import GetFullChannelRequest

async def get_channel_info(client, channel_username):
	try:
		entity = await client.get_entity(channel_username)
		if entity:
			return await client(GetFullChannelRequest(channel=entity)) # type: ignore

	except Exception as e:
		return None
	
async def parse_channel_info(raw_data):
	try:
		return {
			"channel_id": raw_data.full_chat.id,
			"about": raw_data.full_chat.about,
			"read_inbox_max_id": raw_data.full_chat.read_inbox_max_id,
			"pts": raw_data.full_chat.pts,
			"hidden_prehistory": raw_data.full_chat.hidden_prehistory,
			"participants_count": raw_data.full_chat.participants_count,
			"admins_count": raw_data.full_chat.admins_count,
			"date": raw_data.chats[0].date,
			"access_hash": raw_data.chats[0].access_hash
		}

	except Exception as e:
		return None