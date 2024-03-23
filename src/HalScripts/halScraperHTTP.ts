/**
 * @module halScraperHTTP
 * @description CLI script version for the scraperHTTP function of the scraperHTTP module. Runs a manual scraping of the clearweb/darkweb origins in the postgresDB
 * 
 * - Script options:
 *
 * ```sh
 * node halScraperHTTP.js --help
 * 		Options:
 * 		    --version         Show version number                            [boolean]
 *			-d, --dark           Scrape dark web origins. Cat. 2 [boolean] [default: false]
 * 		    --noproxy, --np  Avoid the usage of proxy(in case of a .onion link this op
 *      	                 tions will be ignored)         [boolean] [default: false]
 * 			-v, --verbose        Verbose log mode               [boolean] [default: false]
 *  	       --help            Show help                                      [boolean]
 * ```
 * 
 * @category HalScripts
 * @see {@link scraperHTTP}
 */

import { style } from '../modules/style.js';
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import {load_configuration} from '../modules/conf_loader.js'

import { scraperHTTP } from '../M-O_Scraper/scraperHTTP.js';

////////////////////////////////////////////////////////////////////
//// conf.json setup
////////////////////////////////////////////////////////////////////

const config = load_configuration()

if(!config){ 
	console.log(style.error("Error while loading the config.json file"))
	process.exit(-1)
}

///////////////////////////////////////////////////////////////////
//// Yargs conf and setup of cli options
///////////////////////////////////////////////////////////////////

const argv = await yargs(hideBin(process.argv))
.option('dark', {
	alias: 'd',
	describe: 'Scrape dark web origins. Cat. 2',
	demandOption: false,
	type: 'boolean',
	default: false
})
.option('noproxy', {
	alias: 'np',
	describe: 'Avoid the usage of proxy(in case of a .onion link this options will be ignored)',
	demandOption: false, 
	type: 'boolean',
	default: false
})
.option('verbose', {
	alias: 'v',
	describe: 'Verbose log mode',
	demandOption: false,
	type: 'boolean',
	default: false
})
.help()
.argv;



const is_onion = argv.dark
// Select if the proxy option should be able or not
const proxymode = !argv.noproxy
// Verbose mode for the various methods
const verbose = argv.verbose

await scraperHTTP({
	proxymode,
	is_onion,
	verbose
})

