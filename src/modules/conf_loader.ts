/**
 * @module conf_loader
 * @description Utility module to handle loading and checking of the config.json file
 * @category misc
 */

import fs from 'fs'


/**
 * Loads and check the config.json file
 *
 * @returns {({ ROOT_PATH:string, CHECK_HISTORY_OFFSET: number, LINK_SCAN_OFFSET: number, ORIGIN_DEADNESS_RAISE: number,THREAD_TABLE_GOOD_WORDS : Array<string>, THREAD_TABLE_BAD_WORDS : Array<string>, DEFAULT_EXPLORE_NUMBER_OF_PAGES : number, DEFAULT_PROXYMODE : boolean,DEFAULT_VERBOSE : boolean} | null)}
 */
export const load_configuration = () : { ROOT_PATH:string, CHECK_HISTORY_OFFSET: number, LINK_SCAN_OFFSET: number, ORIGIN_DEADNESS_RAISE: number,
	THREAD_TABLE_GOOD_WORDS : Array<string>, THREAD_TABLE_BAD_WORDS : Array<string>, DEFAULT_EXPLORE_NUMBER_OF_PAGES : number, DEFAULT_PROXYMODE : boolean,
	DEFAULT_VERBOSE : boolean, TOR_PROXY_PORT : number, TOR_PROXY_ADDRESS : string
} | null => {
	try {
		const config_file = fs.readFileSync('config.json', 'utf8')
		const config = JSON.parse(config_file);
		return {
			"ROOT_PATH": config.General.ROOT_PATH,
			"CHECK_HISTORY_OFFSET": config.Web.CHECK_HISTORY_OFFSET,
			"LINK_SCAN_OFFSET": config.Web.LINK_SCAN_OFFSET,
			"ORIGIN_DEADNESS_RAISE": config.Web.ORIGIN_DEADNESS_RAISE,
			"THREAD_TABLE_GOOD_WORDS": config.Web.THREAD_TABLE_GOOD_WORDS, 
			"THREAD_TABLE_BAD_WORDS": config.Web.THREAD_TABLE_BAD_WORDS,
			"DEFAULT_EXPLORE_NUMBER_OF_PAGES": config.Web.DEFAULT_EXPLORE_NUMBER_OF_PAGES,
			"DEFAULT_PROXYMODE": config.Web.DEFAULT_PROXYMODE,
			"DEFAULT_VERBOSE": config.Web.DEFAULT_VERBOSE,
			"TOR_PROXY_ADDRESS": config.Web.TOR_PROXY_ADDRESS,
			"TOR_PROXY_PORT": config.Web.TOR_PROXY_PORT
		}
	} catch (err) {
		return null
	}
}
