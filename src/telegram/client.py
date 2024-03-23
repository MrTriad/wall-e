
import os
from telethon.sync import TelegramClient

async def initialize_client():

	TELEGRAM_API_ID = os.getenv("TELEGRAM_API_ID")
	TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH")
	# TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
	TELEGRAM_PHONE_NUMBER = os.getenv("TELEGRAM_PHONE_NUMBER")

	if(TELEGRAM_API_ID and TELEGRAM_API_HASH and TELEGRAM_PHONE_NUMBER):
		client = TelegramClient(TELEGRAM_PHONE_NUMBER, int(TELEGRAM_API_ID), TELEGRAM_API_HASH)
		return await client.start(TELEGRAM_PHONE_NUMBER)  # type: ignore
	else:
		return None