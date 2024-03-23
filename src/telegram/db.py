import asyncpg
from datetime import datetime

from style import style

from dotenv import load_dotenv
import os
load_dotenv()

db_params = {
    'host': os.getenv('DB_HOST'),
    'database': os.getenv('DB_NAME'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'port': os.getenv('DB_PORT')
}

async def create_async_pool():
    try:
        return await asyncpg.create_pool(**db_params) # type: ignore
    except asyncpg.exceptions as e:
        print(style.error(f"Unexpected error while connecting to the db: {e}"))
        return None        




async def insertOrigin(pool, origin):
    try:
        # Take a connection from the pool.
        async with pool.acquire() as conn:
            # Open a transaction.
            async with conn.transaction():
                # Run the query passing the request argument.
                res = await conn.fetchrow('INSERT INTO origin (domain, name, is_dead_score, category) VALUES ($1, $2, $3, $4) RETURNING _id_origin', str(origin['domain']), origin['name'], origin['is_dead_score'], origin['category'])
                return res['_id_origin']

    except Exception as e:
        # Rollback the transaction if an error occurs
        print(style.error(f"Unexpected error while inserting a new origin: {e}"))
        return None

async def insertSource(pool, source, source_telegram):
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                source_res = await conn.fetchrow('INSERT INTO source (spam_score, published_time, _id_origin, _id_author) VALUES ($1, $2, $3, $4) RETURNING _id_source',
                    source['spam_score'], source['published_time'], source['_id_origin'], source['_id_author'])
                
                if source_res['_id_source']:
                    source_telegram_res = await conn.fetchrow('INSERT INTO source_telegram (_id_source_telegram, message_text, views_count, shares_count, _id_source) VALUES ($1, $2, $3, $4, $5) RETURNING _id_source_telegram',
                        source_telegram['_id_source_telegram'], source_telegram['message_text'], source_telegram['views_count'], source_telegram['shares_count'], source_res['_id_source'])
                    if source_telegram_res['_id_source_telegram']:
                        return source_res['_id_source']
                    else:
                        conn.rollback()
                        return None
                else:
                    conn.rollback()
                    return None

    except Exception as e:
        # Rollback the transaction if an error occurs
        print(style.error(f"Unexpected error while inserting a new source: {e}"))
        return None
    

async def selectSourceTegramByDomainAndMessage(pool, domain, _id_source_telegram):
    try:
        # Take a connection from the pool.
        async with pool.acquire() as conn:
            # Open a transaction.
            async with conn.transaction():
                # Run the query passing the request argument.
                return await conn.fetch('''
                                        SELECT s._id_source FROM origin o
                                            INNER JOIN source s ON o._id_origin = s._id_origin
                                            INNER JOIN source_telegram st ON s._id_source = st._id_source
                                                WHERE o.domain = $1
                                                AND st._id_source_telegram = $2
                                        ''', str(domain), _id_source_telegram)
    except Exception as e:
        print(style.error(f"Unexpected error while selecting the origin for the domain: {domain}\n{e}"))
        return None

async def insertOriginHistory(pool, origin_history):
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                res = await conn.fetchrow('INSERT INTO origin_history (additional_infos, _id_origin) VALUES ($1, $2) RETURNING _id_origin_history', origin_history['additional_infos'], origin_history['_id_origin'])
                return res['_id_origin_history']
    except Exception as e:
        print(style.error(f"Unexpected error while inserting a new origin history: {e}"))
        return None


async def selectOriginByDomain(pool, domain):
    try:
        # Take a connection from the pool.
        async with pool.acquire() as conn:
            # Open a transaction.
            async with conn.transaction():
                # Run the query passing the request argument.
                return await conn.fetch('SELECT * FROM origin WHERE category = 1 AND domain = $1', (str(domain)))
    except Exception as e:
        print(style.error(f"Unexpected error while selecting the origin for the domain: {domain}\n{e}"))
        return None
    
async def selectOrigins(pool):
    try:
        # Take a connection from the pool.
        async with pool.acquire() as conn:
            # Open a transaction.
            async with conn.transaction():
                # Run the query passing the request argument.
                return await conn.fetch('''SELECT * FROM origin o
                                            JOIN origin_history oh
                                            ON oh._id_origin = o._id_origin
                                            AND oh.updated_time = (
                                                SELECT MAX(z.updated_time) 
                                                FROM origin_history z 
                                                WHERE o.category = 1
                                                AND z._id_origin = o._id_origin
                                            )''')
    except Exception as e:
        print(style.error(f"Unexpected error while selecting origins: {e}"))
        return None
    


async def updateOriginDeadScore(pool, is_dead_score, _id_origin):
    try:
        # Take a connection from the pool.
        async with pool.acquire() as conn:
            # Open a transaction.
            async with conn.transaction():
                # Run the query passing the request argument.
                res = await conn.fetchrow('UPDATE origin SET is_dead_score = $1 WHERE _id_origin = $2 RETURNING is_dead_score', is_dead_score, _id_origin)
                return res['is_dead_score']
    except Exception as e:
        print(style.error(f"Unexpected error while updating is_dead_score for origin id: {_id_origin}\n{e}"))
        return None
    
async def updateOriginLastChecked(pool, last_checked, _id_origin):
    try:
        # Take a connection from the pool.
        async with pool.acquire() as conn:
            # Open a transaction.
            async with conn.transaction():
                # Run the query passing the request argument.
                res = await conn.fetchrow('UPDATE origin SET last_checked = $1 WHERE _id_origin = $2 RETURNING last_checked', last_checked, _id_origin)
                return res['last_checked']
    except Exception as e:
        print(style.error(f"Unexpected error while updating last_checked for origin id: {_id_origin}\n{e}"))
        return None