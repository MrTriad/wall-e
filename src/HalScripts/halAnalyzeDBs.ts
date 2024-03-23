/**
 * @module halAnalyzeDBs
 * @description CLI script version for the analyzeDB function. Analyzes a database or a directory of databases and loads metadata and entries in the postgres db
 * 
 * - Script options:
 *
 * ```sh
 * node halAnalyzeDBs.js --help
 *      Options:
 *      	--version                 Show version number                    [boolean]
 *      	--target_file, --tf       Path to the file to analyze             [string]
 *	 	 --source_id, --oid        Source ID linked to the db to analyze
 *		 						   [number] [default: null]
 * 		 --target_directory, --td  Path to the folder containing files to analyze
 * 																		   [string]
 * 		 -l, --lines                   Line that the classifier should read
 * 														   [number] [default: 1000]
 * 		 --help                    Show help                              [boolean]
 * ```
 * 
 * @category HalScripts
 * @see {@link analyze}
 */

import { analyzeDB } from "../modules/analyze.js"
import { close_pool, insertBreachEntries, insertDatabaseMetadata } from '../TA-NK_database/LFT-R.js';
import { DatabaseMetadata } from "../TA-NK_database/dbschemas.js";
import { test_file } from "../modules/FIX-IT.js";
import { csv2json } from "../modules/jsonizer.js";
import path from 'path';
import fs from 'fs';
import { style } from "../modules/style.js";
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import dotenv from 'dotenv'
dotenv.config()


const default_line_to_analyze = 1000 //line that the classifier should read

const argv = await yargs(hideBin(process.argv))
.option('target_file', {
	alias: 'tf',
	describe: 'Path to the file to analyze',
	demandOption: false, // Set to true to require the option,
	type: 'string'
})
.option('source_id', {
	alias: 'oid',
	describe: 'Source ID linked to the db to analyze',
	demandOption: false, // Set to true to require the option,
	type: 'number',
	default: null
})
.option('target_directory', { 
	alias: 'td',
	describe: 'Path to the folder containing files to analyze',
	demandOption: false, // Set to true to require the option,
	type: 'string'
})
.option('lines', {
	alias: 'l',
	describe: 'Line that the classifier should read',
	default: default_line_to_analyze,
	demandOption: false,
	type: 'number'
})
.help() // Add --help option to display usage information
.argv;

//const folder_path = './telegram/supported_files';

const target_file = argv.target_file
const target_directory = argv.target_directory

if(target_file){
	try {
		await analyzefile(target_file, argv.lines, argv.source_id)
	} catch (err) {
		console.error('Error while reading the file: ', err);
	} finally{
		close_pool()
	}
	
}else if(target_directory){
	try {
		const files = fs.readdirSync(target_directory)    
		await Promise.all(files.map(async (file) => {
			await analyzefile(path.join(target_directory, file), argv.lines, argv.source_id)
		}));
	} catch (err) {
		console.error('Error while reading the folder: ', err);
	} finally{
		close_pool()
	}
}else{
	console.log(style.error('Please select a file or a directory to execute the scan'))
}


async function analyzefile(input_path : string, line_to_analyze : number, _id_source : number | null = null){
	//const input_path = path.join(folder_path, file);
	
	const database_metadata : DatabaseMetadata = analyzeDB({ filepath: input_path, _id_source: _id_source }) 
	const insertDBmetadata_result = await insertDatabaseMetadata(database_metadata)
	
	if( insertDBmetadata_result === 0 ){
		console.log(style.success(`New database identified with hash ${database_metadata._og_hashmd5}`))
		const jsonedDB = (await csv2json(input_path))
		
		if(jsonedDB){
			console.log(style.success("File correctly converted to standard format"))
			const fixes = test_file(jsonedDB, line_to_analyze)
			if(fixes){
				await insertBreachEntries(database_metadata._og_hashmd5, fixes, jsonedDB)
				
			}
		}else{ console.log(style.error('Error while trying to convert the file ') + style.data(input_path))}
		
	}else if( insertDBmetadata_result === 1 ){
		console.log(style.error(`Database identified with hash ${database_metadata._og_hashmd5} already present. Skipping it`))
	}else{
		console.log(style.error(`File ${input_path} caused an unexpected error while loading the metadata in the database`))
	}
}