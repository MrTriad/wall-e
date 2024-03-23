/**
 * @module jsonizer
 * @description Utility module that offers translate functions from origin database format to json
 * @category misc
 */

/**
* Module that should handle the different conversion from source to json
* Currently supported formats: csv
*/

import CSVToJSON from 'csvtojson'
import fs from 'fs'

/**
* @description Converts from csv to json. CSVtoJSON library
*
* @param {string} filepath Path to the file to translate.
* @return {Promise<any[] | null>} Jsoned database
*/
export const csv2json = async (filepath : string) : Promise<any[] | null> => {
	try {
		const input_file = fs.readFileSync(filepath).toString().replace(/;/g,','); //eh, quando si parla di un vero convertitore stabiloso magari si trova di meglio di ste toppe
		const jsonedDB = await CSVToJSON().fromString(input_file)
		return jsonedDB
	} catch (err) {
		console.error(err)
		return null
	}
};