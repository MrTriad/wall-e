/**
 * @module config.js
 * @description Utility script to reset the config.json file to defaults and set the root folder for the project
 * 
 * - Example usage:
 *
 * ```sh
 * node config.js
 * > config.json created and populated successfully.
 * ```
 */


import fs from 'fs';
import path from 'path';

// Get the current working directory
const currentDirectory = process.cwd();

// Define the default config object
const defaultConfig = {
	General: {
		SUPPORTED_FILETYPES: ['csv'],
		ROOT_PATH: currentDirectory,
	},
	Web: {
		CHECK_HISTORY_OFFSET: 43200000,
		LINK_SCAN_OFFSET: 5,
		ORIGIN_DEADNESS_RAISE: 1,
		THREAD_TABLE_GOOD_WORDS: [
			'data', 'breach', 'leak', 'combo', 'log', 'list', 'reply', 'view',
			'replies', 'topic', 'title', 'db', 'csv', 'database', 'xls', 'xlsx', 'sql',
			'.com', 'thread', 'wallet', 'email',
		],
		THREAD_TABLE_BAD_WORDS: ['announcement', 'news', 'update', 'avatar', 'old', 'avatar'],
		DEFAULT_EXPLORE_NUMBER_OF_PAGES: 4,
		DEFAULT_PROXYMODE: false,
		DEFAULT_VERBOSE: false,
		TOR_PROXY_ADDRESS: "http://127.0.0.1",
		TOR_PROXY_PORT: 9053
	},
	Telegram: {
		CHECK_HISTORY_OFFSET: 43200000,
		LOG_LEVEL: 10
	},
};

// Convert the config object to JSON with tabs for indentation
const configJSON = JSON.stringify(defaultConfig, null, '\t');

// Write the JSON to the config file
const configFilePath = path.join(currentDirectory, 'config.json');

fs.writeFile(configFilePath, configJSON, (err) => {
	if (err) {
		console.error('Error writing config.json:', err);
	} else {
		console.log('config.json created and populated successfully.');
	}
});
	
