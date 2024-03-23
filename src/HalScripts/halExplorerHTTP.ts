/**
 * @module halExplorerHTTP
 * @description CLI script version for the exploreHTTP function of the ExplorerHTTP module. Explore a new origin, classifies the html paths and inserts the result in the postgresDB
 * 
 * - Script options:
 *
 * ```sh
 * node halExplorerHTTP.js --help
 * 		Options:
 * 		    --version         Show version number                            [boolean]
 *			-u, --url             Url of the forum origin to add in the DataBase
 *	                                                           	   [string] [required]
 * 			-n, --number_of_page  Number of pages that the classifier should test to find
 *          	                 the possible paths                              [number]
 *	        --noproxy, --np   Avoid the usage of proxy(in case of a .onion link this o
 *     		                  ptions will be ignored)                        [boolean]
 * 			-v, --verbose         Verbose log mode                           [boolean]
 *  	  	    --help            Show help                                      [boolean]
 * ```
 * 
 * @category HalScripts
 * @see {@link explorerHTTP}
 */

import { style } from '../modules/style.js';
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import {load_configuration} from '../modules/conf_loader.js'

import { exploreHTTP } from '../M-O_Scraper/explorerHTTP.js';

////////////////////////////////////////////////////////////////////
//// conf.json setup
////////////////////////////////////////////////////////////////////

const config = load_configuration()

if(!config){ 
	console.log(style.error("Error while loading the config.json file"))
	process.exit(-1)
}

////////////////////////////////////////////////////////////////////
//// Yargs conf and setup of cli options
////////////////////////////////////////////////////////////////////

const argv = await yargs(hideBin(process.argv))
.option('url', {
	alias: 'u',
	describe: 'Url of the forum origin to add in the DataBase',
	demandOption: true,
	type: 'string'
})
.option('number_of_page', {
	alias: 'n',
	describe: 'Number of pages that the classifier should test to find the possible paths',
	demandOption: false,
	type: 'number'
})
.option('noproxy', {
	alias: 'np',
	describe: 'Avoid the usage of proxy(in case of a .onion link this options will be ignored)',
	demandOption: false, 
	type: 'boolean',
})
.option('verbose', {
	alias: 'v',
	describe: 'Verbose log mode',
	demandOption: false,
	type: 'boolean',
})
.help() // Add --help option to display usage information
.argv;

// Starting URL to analyze
const url = argv.url
// Select if the proxy option should be able or not
const proxymode = !argv.noproxy
// Number of pages that the classifier will try to look for
const page_analyze = argv.number_of_page
// Verbose mode for the various methods
const verbose = argv.verbose

await exploreHTTP({url, proxymode, page_analyze, verbose})

