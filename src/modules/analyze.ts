/**
 * @module analyze
 * @description Modules containing function to analyze database to standardize and extract metadata
 * @category misc
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { DatabaseMetadata } from '../TA-NK_database/dbschemas';

/**
* @description Analyzes the db to generate the metadata from a starting file
*
* @param {Object} Options
* @param {string} Options.filepath Path to the file to analyze.
* @param {number} [Options.breach_time=(Date.now()/1000)] Date of the breach in number format.
* @param {number} [Options._id_source=null] Id of the source where the database was extracted
* @return {DatabaseMetadata} Metadata formatted in the database schema.
*/
export function analyzeDB({ filepath, breach_time = (Date.now() / 1000), _id_source = null }: { filepath: string; breach_time?: number; _id_source?: number | null; }) : DatabaseMetadata {
  const og_db = fs.readFileSync(filepath);
  const _og_hashmd5 = createHash('md5').update(og_db).digest('hex');
  const og_filename = path.basename(filepath);

  const out: DatabaseMetadata = {
    _og_hashmd5: _og_hashmd5,
    name: null,
    breach_time: breach_time,
    og_filename: og_filename,
    is_hashed: null,
    is_salted: null,
    _id_source: _id_source
  };

  return out;
}