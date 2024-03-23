/**
 * @module TA-NK
 * @description Module containing the database configuration
 * @category TA-NK_database
 */

import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

/**
 * @constant pool
 * @description postgres connection pool configured from the env file
 * 
 */
export const pool = new pg.Pool({
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  host: process.env.DB_HOST,
});



