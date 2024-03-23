/**
 * @module LFT-R
 * @description Module containing interfaces for the database interactions
 * @category TA-NK_database
 */

import format from "pg-format";

import { pool } from "./TA-NK.js";
import { AuthorInput, DatabaseMetadata, OriginInput, ForumPathInput, ForumPath, OriginHistoryInput, SourceInput, SourceThreadInput } from "./dbschemas.js";
import { style } from "../modules/style.js";

/**
* @description Select an origin, its most recent origin_history and its linked forum path by category and domain of the origin
*
* @async
* @param {number} category Origin category -> 0 ClearWeb, 1 Telegram, 2 DarkWeb
* @param {string} domain Starting URL of the thread origin
* @returns {Promise<{_id_origin: number, updated_time: number, additional_infos: string, last_url: string, next_page_path: string, table_body_path: string, thread_link_path: string, thread_title_path: string, thread_description_path: string, thread_pubblication_date_path: string} | undefined>} origin, its most recent history, its forum_path or undefined in case of error
*/
export const selectOrigin_OriginHistory_ForumPath = async (category: number, domain: string): Promise<{
	_id_origin: number, updated_time: number, additional_infos: string, last_url: string, 
	next_page_path: string, table_body_path: string, thread_link_path: string, thread_title_path: string, thread_description_path: string, thread_pubblication_date_path: string
} | undefined> => {
	try {
		const res = await pool.query(`
		SELECT o._id_origin, oh.updated_time, oh.additional_infos, o.last_url, fp.next_page_path, fp.table_body_path, fp.thread_link_path, fp.thread_title_path, fp.thread_description_path, fp.thread_pubblication_date_path
		FROM origin o
		INNER JOIN origin_history oh ON o._id_origin = oh._id_origin
		INNER JOIN forum_path fp ON o._id_origin = fp._id_origin 
		WHERE category = $1
		AND domain = $2
		ORDER BY updated_time DESC
		LIMIT 1
		`, [category, domain]);
		return {
			_id_origin: res.rows[0]._id_origin,
			updated_time: res.rows[0].updated_time,
			additional_infos: res.rows[0].additional_infos,
			last_url: res.rows[0].last_url,
			next_page_path: res.rows[0].next_page_path, 
			table_body_path: res.rows[0].table_body_path,
			thread_link_path: res.rows[0].thread_link_path,
			thread_title_path: res.rows[0].thread_title_path,
			thread_description_path: res.rows[0].thread_description_path,
			thread_pubblication_date_path: res.rows[0].thread_pubblication_date_path
		};
	} catch (err) {
		return undefined
	}
}

/**
* @description Select _id_origin by category and domain from the postgres database
*
* @async
* @param {number} category the category of the origin 0: clearweb, 1: telegram, 2: darkweb
* @param {string} domain the domain of the origin
* @returns {Promise<number | undefined>} returns the id of the origin or undefined in case of error
*/
export const selectOrigin = async (category : number, domain : string): Promise<number | undefined> => {
	try {
		const res = await pool.query(`
		SELECT _id_origin
		FROM origin
		WHERE category = $1
		AND domain = $2
		`, [category, domain])	
		return res.rows[0]._id_origin
	} catch (err) {
		return undefined
	}
}



/**
* @description Returns an Array with the domain of all the origins matching the inputted category
*
* @async
* @param {number} category Category of the origins you need to gather 0: clearweb, 1: telegram, 2: darkweb
* @returns {(Promise<Array<string> | undefined>)} Returns the array of domain or undefined in case of error
*/
export const selectOriginAll = async (category: number): Promise<Array<string> | undefined> => {
	try {
		const res = await pool.query('SELECT domain FROM origin WHERE category=$1',[category])
		const out : Array< string > = new Array()
		res.rows.forEach((row) => {
			out.push(row.domain)
		})
		return out
	} catch (err) {
		return undefined
	}
}


/**
 * @description update the origin_history for the passed origin in the postgres database
 *
 * @async
 * @param {OriginHistoryInput} origin_history updated origin_history
 * @param {number} most_recent_time id of the most recent origin_history for the desired origin
 * @returns {Promise<number | undefined>} 0: for success, undefined: case of error
 */
export const updateOriginHistory = async (origin_history : OriginHistoryInput, most_recent_time : number): Promise<number | undefined> => { //Ora come ora loaddati uno ad uno, non penso sia giusto fralo in bulk
	try {
		
		await pool.query(
			"UPDATE origin_history SET updated_time = to_timestamp($1) WHERE _id_origin = $2 AND updated_time = $3",
			[
				origin_history.updated_time,
				origin_history._id_origin,
				most_recent_time
			]
			);
			return 0 // as all fine
		} catch (err) {
			console.error(style.error(err))	
			return undefined
		} 
	};
	
	
	/**
	* Updates the is_dead_score of the origin, by setting a new value or raising the present one
	*
	* @async
	* @param {number} _id_origin ID of the origin to update
	* @param {number} [raise = 1] Increase/Decrease the is_dead_score value
	* @param {number} [set = undefined] Set the is_dead_score value to a specific value
	* @returns {Promise<number | undefined>} Updated value of the is_dead_score param
	*/

	
	/**
	 * @description raise or set the deadness score for an origin in the postgres database. If both raise and set are passed, set takes the priority
	 *
	 * @export
	 * @async
	 * @param {Object} Options
	 * @param {number} _id_origin Id of the origin to update
	 * @param {number | undefined} [raise = 1] raise the deadness score of x
	 * @param {number | undefined} set set the deadness score to x
	 * @returns {Promise<number | undefined>} id of the updated origin or undefined in case of error
	 */
	export async function updateOriginDeadness({ _id_origin, raise = 1, set }: { _id_origin: number; raise?: number; set?: number }): Promise<number | undefined> {
		try {
			let res
			if(set){
				res = await pool.query(
					"UPDATE origin SET is_dead_score = $1 WHERE _id_origin = $2 RETURNING is_dead_score",
					[
						set,
						_id_origin
					]
					);
				}else if(raise){
					res = await pool.query(
						"UPDATE origin SET is_dead_score = is_dead_score + $1 WHERE _id_origin = $2 RETURNING is_dead_score",
						[
							raise,
							_id_origin
						]
						);
					}else { return undefined }
					return res.rows[0].is_dead_score
				} catch (err) {
					console.error(style.error(err));
					return undefined
				}
			}
			
			
			/**
			 * @description Close the postgres connection pool
			 */
			export const close_pool = () => {
				// @ts-ignore 
				if(!pool.ended){pool.end()}  
			}
			
			
			
			
			/**
			* @description Loads the Origin to the pg database
			*
			* @async
			* @param {Origin} origin Data to load formatted with the database schema
			* @return {number | undefined } _id_origin or undefined if insertion had a problem
			*/
			export const insertOrigin = async (origin : OriginInput): Promise<number | undefined> => {
				try {
					const res = await pool.query(
						"INSERT INTO origin (domain, name, is_dead_score, category) VALUES ($1, $2, $3, $4) RETURNING _id_origin",
						[
							origin.domain,
							origin.name,
							origin.is_dead_score,
							origin.category
						]
						);
						return res.rows[0]._id_origin // returned id
					} catch (err : any) {
						if (err.code === '23505') {
							console.error(style.error(`[!] Origin identified with domain ${origin.domain} already present. Skipping it`)); //Non dovrebbe succedere(controllo pre chiamata)
						} else {
							console.error(err)
						}
						return undefined
					} 
				};
				
				
				/**
				 * @description Insert a new origin_history in the postgres database
				 *
				 * @async
				 * @param {OriginHistoryInput} origin_history Origin_history formatted as the schema
				 * @returns {Promise<number | undefined>}
				 */
				export const insertOriginHistory = async (origin_history : OriginHistoryInput) : Promise<number | undefined> => {
					try {
						const res = await pool.query(
							"INSERT INTO origin_history (additional_infos, updated_time, _id_origin) VALUES ($1, to_timestamp($2), $3) RETURNING _id_origin_history",
							[
								origin_history.additional_infos,
								origin_history.updated_time,
								origin_history._id_origin
							]
							);
							return res.rows[0]._id_origin_history
						} catch (err : any) {
							console.error(style.error(err))
							return undefined
						} 
					};
					
					
					/**
					 * Search the postgreDB chooseing fields and searchTerm. Also requires to know the standard search fields to check that no field was edited with malicious intentions 
					 *
					 * @async
					 * @param {Array<string>} inputFields Selected fields to search
					 * @param {Array<string>} searchFields All the fields available
					 * @param {string} searchTerm searchTerm
					 * @returns {Promise<any[] | undefined>} Result of the search
					 */
					export const search = async (inputFields : Array<string>, searchFields : Array<string>, searchTerm : string) : Promise<any[] | undefined> => {
						
						const isValidFields = inputFields.every(value => searchFields.includes(value));
						if(!isValidFields || searchTerm === '' || inputFields.length === 0){ return undefined }

						try{
							const conditions = inputFields.map((field) => `${field}::text ILIKE $1`);

							const query = {
								text: `SELECT * FROM data WHERE ${conditions.join(' OR ')}`,
								values: [`%${searchTerm}%`], // Use '%' to match any substring
								};
	
								const res = await pool.query(query);
								return res.rows;
						}catch(err : any){
							console.error(style.error(err))
							return undefined
						}
					}
					
					/**
					 * Search the postgreDB chooseing fields and searchTerm. Also requires to know the standard search fields to check that no field was edited with malicious intentions 
					 *
					 * @async
					 * @param {Array<string>} inputFields Selected fields to search
					 * @param {Array<string>} searchFields All the fields available
					 * @param {string} searchTerm searchTerm
					 * @returns {Promise<any[] | undefined>} Result of the search
					 */
					export const search_source_thread = async (inputFields : Array<string>, searchFields : Array<string>, searchTerm : string) : Promise<any[] | undefined> => {
						
						const isValidFields = inputFields.every(value => searchFields.includes(value));
						if(!isValidFields || searchTerm === '' || inputFields.length === 0){ return undefined }

						try{
							const conditions = inputFields.map((field) => `${field}::text ILIKE $1`);

							const query = {
								text: `SELECT * FROM source_thread WHERE ${conditions.join(' OR ')}`,
								values: [`%${searchTerm}%`], // Use '%' to match any substring
								};
	
								const res = await pool.query(query);
								return res.rows;
						}catch(err : any){
							console.error(style.error(err))
							return undefined
						}
					}
					
					/**
					 * @description insert a forum path into the postgres database
					 *
					 * @async
					 * @param {ForumPathInput} forum_path The forum paths to add in the database
					 * @returns {Promise<number | undefined>} The ID of the added forum path or in case of error, undefined
					 */
					export const insertForumPath = async (forum_path : ForumPathInput) : Promise<number | undefined>  => {
						
						try {
							const res = await pool.query(
								`INSERT INTO public.forum_path (next_page_path, table_body_path, thread_link_path, thread_title_path,
									thread_description_path, thread_pubblication_date_path, is_auto_generated, _id_origin) VALUES (
										$1, $2, $3, $4, $5, $6, $7, $8) RETURNING _id_forum_path;`,
										[
											forum_path.next_page_path,
											forum_path.table_body_path,
											forum_path.thread_link_path,
											forum_path.thread_title_path,
											forum_path.thread_description_path,
											forum_path.thread_pubblication_date_path,
											forum_path.is_auto_generated,
											forum_path._id_origin
										]
										)
										return res.rows[0]._id_forum_path // returned id
									} catch (err : any) {
										if (err.code === '23505') {
											console.error(style.error(`Forum Path identified with domain already present. Skipping it`)); //Non dovrebbe succedere(controllo pre chiamata)
										} else {
											console.error(err)
										}
										return undefined
									} 
								}
								
								
								/**
								 * @description Update the passed forum_path on the postgres database
								 *
								 * @async
								 * @param {ForumPathInput} forum_path The new forum_path data in schema Object
								 * @returns {Promise<number | undefined>} Id of the edited forum path or undefined in case of error
								 */
								export const updateForumPath = async (forum_path : ForumPathInput) : Promise<number | undefined> => {
									
									try {
										const res = await pool.query(
											`UPDATE public.forum_path SET
											next_page_path = $1, table_body_path = $2, thread_link_path = $3, thread_title_path = $4, thread_description_path = $5, thread_pubblication_date_path = $6, is_auto_generated = $7 WHERE
											_id_origin = $8 returning _id_forum_path;`,
											[
												forum_path.next_page_path,
												forum_path.table_body_path,
												forum_path.thread_link_path,
												forum_path.thread_title_path,
												forum_path.thread_description_path,
												forum_path.thread_pubblication_date_path,
												forum_path.is_auto_generated,
												forum_path._id_origin
											]
											)
											return res.rows[0]._id_forum_path // returned id
										} catch (err : any) {
											console.error(style.error(err)); //Non dovrebbe succedere(controllo pre chiamata)
											return undefined
										} 
									}
									
									
									/**
									 * @description Update the last crawled url for an origin in the postgres database
									 *
									 * @async
									 * @param {number} _id_origin id of the origin to update
									 * @param {string} last_url new last crawled url to insert
									 * @returns {Promise<number | undefined>} id of the edited origin or undefined in case of error
									 */
									export const updateLastUrl = async (_id_origin : number, last_url : string) : Promise<number | undefined> => {
										
										try {
											const res = await pool.query(
												`UPDATE public.origin SET
												last_url = $1 WHERE
												_id_origin = $2
												returning _id_origin;`,
												[
													last_url,
													_id_origin
												]
												)
												return res.rows[0]._id_origin // returned id
											} catch (err : any) {
												console.error(style.error(err)); 
												return undefined
											} 
										}
										
										
										/**
										 * Select a forum_path from the postgres database by id
										 *
										 * @async
										 * @param {number} _id_origin Id of the origin requesting the forum_path 
										 * @returns {Promise< ForumPath | undefined >} Forum_path in schema object or undefined in case of error
										 */
										export const selectForumPath = async ( _id_origin : number ) : Promise< ForumPath | undefined > => {
											
											try {
												const res = await pool.query(`SELECT * FROM public.forum_path WHERE _id_origin = $1;`,
												[_id_origin]
												)
												
												return {
													_id_forum_path: res.rows[0]._id_forum_path,
													next_page_path: res.rows[0].next_page_path,
													table_body_path: res.rows[0].table_body_path,
													thread_link_path: res.rows[0].thread_link_path,
													thread_title_path: res.rows[0].thread_title_path,
													thread_description_path: res.rows[0].thread_description_path,
													thread_pubblication_date_path: res.rows[0].thread_pubblication_date_path,
													is_auto_generated: res.rows[0].is_auto_generated,
													_id_origin: res.rows[0]._id_origin
												}
											} catch (error) {
												console.error(style.error(error))
												return undefined
											}
										}
										
										
										
										/**
										* Select distinct author from a specific origin from the postgres_database
										*
										* @param {string} author_tag Tag of the author on this origin
										* @param {number} origin_id id of the origin to test
										* @return {Promise<number | undefined>} Returns the id of the author if already existent, otherwise null
										*/
										export const searchAuthorAbsolute = async (author_tag : string, origin_id : number): Promise<number | undefined> => {
											
											try {
												const res = await pool.query(
													"SELECT DISTINCT a._id_author FROM author as a INNER JOIN thread as t ON a._id_author = t._id_author INNER JOIN origin as o ON o._id_origin = t._id_origin WHERE o._id_origin = $1 AND a.tag = $2",
													[
														origin_id,
														author_tag
													]
													)
													return res.rows.length === 1 ? res.rows[0]._id_author : null
												} catch (err) {
													console.error(err)
													return undefined
												}
											}
											
											
											/**
											 * @description Inserts a new Author in the database 
											 *
											 * @async
											 * @param {AuthorInput} author Tag and username of the Author
											 * @returns {Promise<number | undefined>} Author ID or undefined in case of error
											 */
											export const insertAuthor = async (author : AuthorInput): Promise<number | undefined> => {
												try {
													const res = await pool.query(
														"INSERT INTO author (tag, username) VALUES ($1, $2) ON CONFLICT (tag, username) DO UPDATE SET tag = EXCLUDED.tag, username = EXCLUDED.username RETURNING _id_author;",
														[
															author.tag,
															author.username
														]
														);
														console.log(style.success(`New author added. Tag: ${author.tag} - Username: ${author.username}`));
														return res.rows[0]._id_author // returned id
													} catch (err : any) {
														if (err.code === '23505') {
															console.error(style.error(`Author identified with tag ${author.tag} already present. Skipping it`)); //Non dovrebbe succedere(controllo pre chiamata)
														} else {
															console.error(err)
														}
														return undefined
													} 
												};
												
												/**
												* @description Loads the DatabaseMetadata in the postgres database
												*
												* @param {DatabaseMetadata} database_metadata Data to load formatted with the database schema
												* @return {Number} 0: No errors, 1: database already present in the table, -1: non supported error during db operations 
												*/
												export const insertDatabaseMetadata = async (database_metadata : DatabaseMetadata): Promise<number> => {
													try {
														await pool.query(
															
															"INSERT INTO database_metadata (_og_hashmd5, name, breach_time, og_filename, is_hashed, is_salted, _id_source) VALUES ($1, $2, to_timestamp($3), $4, $5, $6, $7)",
															[
																database_metadata._og_hashmd5,
																database_metadata.name,
																database_metadata.breach_time,
																database_metadata.og_filename,
																database_metadata.is_hashed,
																database_metadata.is_salted,
																database_metadata._id_source
															]
															);
															return 0 // As no error :3
														} catch (err : any) {
															if (err.code === '23505') {
																return 1 // Return 1 as supported error: db already present on the table //FIXME non mi fa impazzire
															} else {
																console.error(err)
																return -1 //Return -1 as not supported error
															}
														} 
													};
													
													
													/**
													 * @description Insert a new source in the postgres database
													 *
													 * @async
													 * @param {SourceInput} source The new source in the schema structure
													 * @returns {Promise<number | undefined>} The ID of the new Source or undefined in case of error
													 */
													export const insertSource = async (source : SourceInput): Promise<number | undefined> => {
														try {
															const res = await pool.query(
																"INSERT INTO source (spam_score, published_time, crawled_time, updated_time, _id_origin, _id_author) VALUES ($1, to_timestamp($2), to_timestamp($3), to_timestamp($4), $5, $6) RETURNING _id_source;",
																[
																	source.spam_score,
																	source.published_time,
																	source.crawled_time,
																	source.updated_time,
																	source._id_origin,
																	source._id_author
																]
																);
																//console.log(style.success(`New author added. Tag: ${author.tag} - Username: ${author.username}`));
																return res.rows[0]._id_source // returned id
															} catch (err : any) {
																console.error(err)
																return undefined
															} 
														};
														
														
														
														/**
														 * @description Select a source_thread from the postgres database
														 *
														 * @async
														 * @param {string} url url of the source thread
														 * @returns {Promise<number | undefined>} ìthe id of the source_thread or undefined in case of error
														 */
														export const selectSourceThread = async (url : string): Promise<number | undefined> => { 
															try {
																const res = await pool.query(
																	"SELECT _id_source_thread FROM source_thread WHERE url = $1",
																	[url]
																	)
																	if(res.rows.length > 0){
																		return res.rows[0]._id_source_thread
																	}else{ return undefined }
																	
																} catch (err : any) {
																	console.error(err)
																	return undefined
																}
															}
															
															/**
															 * @description Insert a new source_thread in the postgres database
															 *
															 * @async
															 * @param {SourceThreadInput} thread The new source_thread in the schema structure
															 * @returns {Promise<number | undefined>} The ID of the new source_thread or undefined in case of error
															 */
															export const insertSourceThread = async (thread : SourceThreadInput): Promise<number | undefined> => { //Ora come ora loaddati uno ad uno, non penso sia giusto fralo in bulk
																try {
																	const res = await pool.query(
																		"INSERT INTO source_thread (url, title, description, replies_count, views_count, _id_source) VALUES ($1, $2, left($3, 65535), $4, $5, $6) RETURNING _id_source_thread",
																		[
																			thread.url,
																			thread.title,
																			thread.description,
																			thread.replies_count,
																			thread.views_count,
																			thread._id_source
																		]
																		);
																		return res.rows[0]._id_source_thread
																	} catch (err : any) {
																		console.error(err)
																		return undefined
																	};
																}
																
																/**
																* @description Queries DELETE FROM [table]
																*
																* @param {string}  table_name Name of the table to reset
																* @return {Promise<number | undefined>} 0: No errors, undefined: non supported error during db operations 
																*/
																export const resetTable = async (table_name : string): Promise<number | undefined> => {
																	try {
																		await pool.query(
																			`DELETE FROM ${table_name}`
																			);
																			console.log(style.info(`Table ${table_name} resetted`));
																			return 0 // As no error :3
																		} catch (err) {
																			console.error(err)
																			return undefined
																		} 
																	};
																	
																	/**
																	* @description Applies the specified fixes to the jsonDatabase and then batch loads the entries on postgres
																	*
																	* @param {string} _og_hashmd5 HashMD5 primary key of the source database_metadata
																	* @param {Map<string,string>} fixes Object of fixes generated by FIX-IT.testfile()
																	* @param {JSON[]} jsonedDB jsonDB containing the entries pre-fixes
																	* @return {number} 0: No errors, -1: non supported error during db operations 
																	*/
																	export const insertBreachEntries = async (_og_hashmd5 : string, fixes : Map<string, string>, jsonedDB : any[]): Promise<number> => {
																		
																		const formattedData = formatEntryDB(_og_hashmd5, fixes ,jsonedDB)
																		console.log(formattedData[0])
																		const query = format(
																			"INSERT INTO data (email_address, phone_number, ip_address, username, misc, _og_hashmd5) VALUES %L",
																			formattedData
																			);
																			try {
																				await pool.query(query);
																				console.log(style.success(`New entries added to the DB`));
																				return 0 // As no error :3
																			} catch (err) {
																				console.error(err)
																				return -1 //Return -1 as not supported error
																			} 
																		};
																		
																		// Applies the fixes specified in input
																		function formatEntryDB(_og_hashmd5 : string, fixes : Map<string, string>, jsonedDB : any[]) {
																			const custom_fields = Array.from(fixes.values()) //giusto per rileggerlo 500000 vlte
																			const formattedForPG = Object.values(jsonedDB).map(entry => {
																				const out = [  ]
																				for (let value of custom_fields){  //Inserisco vaolri statici mail, ip, tel, ecc
																					out.push(entry[value]) 
																				}
																				out.push(JSON.stringify(filterMisc(entry, custom_fields))) //Formatto ed inserisco il resto in misc
																				out.push(_og_hashmd5) //aggiungo lhash utilizzato come FK
																				return out
																			})
																			return formattedForPG
																		}
																		
																		// Generates the misc JSON to add in pg as misc field
																		function filterMisc(entry : any, custom_fields : Array<string>){  //Genero misc in modo che non siano presenti i campi già estrapolati e la aggiungo all'array. Separato per leggibilità
																			return Object.keys(entry).reduce((obj, key) => {
																				if (!custom_fields.includes(key)) {
																					const { [key]: value } = entry;
																					return { ...obj, [key]: value };
																				}
																				return obj;
																			}, {});	
																		}