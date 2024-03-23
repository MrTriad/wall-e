/**
 * @module explorerHTTP
 * @description Crawler to explore, classify and add new HTTP origins to the database
 * 
 * @category M-O_Scraper
 */

import { Configuration, Dictionary, HttpCrawler, ProxyConfiguration, Request } from 'crawlee';
import * as cheerio from 'cheerio'
import { style } from '../modules/style.js';
import { smallizeHTML } from '../DOMPathExplorer/smallizzator2.js';
import { find_next_page, find_thread_table, find_thread_href, find_thread_manual, mapReduceMax, getDateFromRaw } from '../DOMPathExplorer/pathexplorer.js';
import { insertForumPath, insertOrigin, insertOriginHistory, selectForumPath, selectOrigin, updateForumPath } from '../TA-NK_database/LFT-R.js';
import { ForumPathInput, OriginHistoryInput, OriginInput } from '../TA-NK_database/dbschemas.js';
import whoiser, { WhoisSearchResult } from 'whoiser';
import confirm from '@inquirer/confirm'
import select from '@inquirer/select';
import input from '@inquirer/input';
import {load_configuration} from '../modules/conf_loader.js'
import { randomUUID } from 'crypto';

////////////////////////////////////////////////////////////////////
//// conf.json setup
////////////////////////////////////////////////////////////////////

const config = load_configuration()

if(!config){ 
	console.log(style.error("Error while loading the config.json file"))
	process.exit(-1)
}

////////////////////////////////////////////////////////////////////

const crawlee_log_config = Configuration.getGlobalConfig();
crawlee_log_config.set('logLevel', 'OFF');




/**
 * @description Crawler to explore, classify and add new HTTP origins to the database
 *
 * @async
 * @param {Object} options - The options for exploration.
 * @param {string} options.url - The URL to explore. This is the URL you want crawl, classify and add
 * @param {boolean} [options.proxymode=config.DEFAULT_PROXYMODE] - Whether to use the proxies for the connection [default = config.json DEFAULT_PROXYMODE]
 * @param {number} [options.page_analyze=config.DEFAULT_EXPLORE_NUMBER_OF_PAGES] - Custom number of pages to anayze during the classification process [default = config.json DEFAULT_EXPLORE_NUMBER_OF_PAGES]
 * @param {boolean} [options.verbose=config.DEFAULT_VERBOSE] - Whether to enable verbose mode. [default = config.json DEFAULT_VERBOSE]
 * 
 * @returns {Promise<void>}
 */
export const exploreHTTP = async ({url, proxymode = config.DEFAULT_PROXYMODE, page_analyze = config.DEFAULT_EXPLORE_NUMBER_OF_PAGES, 
	verbose = config.DEFAULT_VERBOSE} : {url : string; proxymode?: boolean; page_analyze? : number; verbose?: boolean} ) : Promise<void> => {

	const thread_table_good_words = config.THREAD_TABLE_GOOD_WORDS
	const thread_table_bad_words = config.THREAD_TABLE_BAD_WORDS
	
	////////////////////////////////////////////////////////////////////
	
	const page_holder = new Array<string>()	// Storage for the pages to analyze
	const thread_holder =  new Array<{title: string, html: string}>()	// Storage for the threads to analyze
	const results : ForumPathInput = { is_auto_generated: true}	// Storage for the explore data to push on the db
	
	var is_onion = false
	var proxyConfiguration = undefined
	if(new URL(url).hostname.endsWith('.onion')){
		is_onion = true
		proxyConfiguration = new ProxyConfiguration({
			proxyUrls: [
				`http://127.0.0.1:9053`,
			]
		})	
	}else if(proxymode){
		try {
			proxyConfiguration = new ProxyConfiguration({
				proxyUrls: [
					''// TODO mettere/importare da file esterno proxy fichi per vedere il mondo
				]
			})	
		} catch (e) {
			console.log(style.error(`Error in the proxy configuration: ${e}\nExiting the program execution with status code -1`))
			process.exit(-1)
		}
	}
	
	let shouldCrawlerFinish = false; // Set at true at end crawling
	var explore = true // Set at flase at end of the first exploration phase
	var next_page = { path: '', link: '' }
	const retrieved_origin : { _id_origin : number | null, is_new? : boolean | null} = { _id_origin: null, is_new: null } // Origin ID to associate in the path
	
	const crawler = new HttpCrawler({
		
		proxyConfiguration: proxyConfiguration,
		useSessionPool: true,
		ignoreSslErrors: true,
		persistCookiesPerSession: true,
		sessionPoolOptions: { maxPoolSize: 5 },
		
		autoscaledPoolOptions: {
			isFinishedFunction: async () => {
				if(thread_holder.length > 0){
					
					const thread_score = find_thread_manual({ thread_holder, good_words: thread_table_good_words, bad_words: thread_table_bad_words, verbose })
					
					// Take the max score for every path category, returns a Map of one element with the max element
					const found_title = thread_score.get(0)?.size ?? 0 > 0 ? mapReduceMax(thread_score.get(0))  : undefined
					const found_description = thread_score.get(1)?.size ?? 0 > 0 ? mapReduceMax(thread_score.get(1)) : undefined
					const found_date = thread_score.get(2)?.size ?? 0 > 0 ? mapReduceMax(thread_score.get(2)) : undefined
					
					// Insert that max element in the results
					results.thread_title_path = found_title ? found_title[0] : undefined,
					results.thread_description_path = found_description ? found_description[0] : undefined,
					results.thread_pubblication_date_path = found_date ? found_date[0] : undefined
					
					results._id_origin = retrieved_origin._id_origin
					
					
					// Show an example of the gathered data and ask if it's fine. If it's not, the operator can choose other selectors or enter a custom one
					const $ = cheerio.load(thread_holder[thread_holder.length-1].html)
					console.log(style.solidLine())
					console.log(style.info("Title: ") + style.data($(results.thread_title_path).text().trim()))
					console.log(style.info("Description: ") + style.data($(results.thread_description_path).text().trim()))
					
					const date = getDateFromRaw($, results.thread_pubblication_date_path ?? '')
					
					console.log(style.info("Data: ") + style.data(date?.toUTCString()))
					
					const confirmed = await confirm({ message: "Operator, does these results look good? ( ^ ^)_/¯", default: true })
					if(!confirmed){
						
						const answers = new Array<string>()
						
						for(var i = 0; i < thread_score.size; i++){
							const title_choices : Array<{ name : string, description? : string, value: string | boolean }> = [{
								name: "Enter a custom path",
								value: true
							}] 
							const score_table = thread_score.get(i)
							
							if(score_table){
								score_table.forEach((score, path) => {
									try {
										if( i==2 ){ //FIXME temporaneo, non mi piace per niente
											const date = getDateFromRaw($, path ?? '')
											title_choices.push({name: score + " - " + path, description: date?.toUTCString() ?? "Can't retrieve the date, text: " + $(path).text().trim(), value: path })	
										}else{
											title_choices.push({name: score + " - " + path, description: $(path).text() ?? '', value: path })	
										}
										
									} catch (error) {
										console.log(style.error("Cannot test the data for the path: " +  style.data(score + " " + path)))
									}
								})
								
								console.log(style.line())
								var selected = await select({
									message: "Select between the found paths or add a custom one",
									choices: title_choices
								})
								
								if(typeof(selected) === 'boolean'){ // Visto che ora come ora false non farebbe nulla
									
									var correct = false
									var custom_path
									do{
										custom_path = await input({ message: 'Enter custom path for the selector: ' });
										
										var preview
										if( i==2 ){ //FIXME temporaneo, non mi piace per niente
											const date = getDateFromRaw($, custom_path ?? '')
											if(date){ console.log(style.info("Selected data can be correctly parsed in Date format"))}
											preview = date?.toUTCString() ?? $(custom_path).text().trim()
										}else{ preview = $(custom_path).text().trim() }
										
										if(preview){
											console.log(style.success("Using the path I found this data [¬°w°]¬ \n") + style.data(preview))
											correct = await confirm({ message: "Operator, does this data look good?", default: true })
										}else{ console.log(style.error("Cannot retrieve the data"))}
										
									}while(!correct)
									
									answers.push(custom_path)
								}else{
									answers.push(selected)
								}
							}
							
						}
						
						results.thread_title_path = answers[0]
						results.thread_description_path = answers[1]
						results.thread_pubblication_date_path = answers[2]
					}
					
					var res
					
					if(retrieved_origin.is_new){
						console.log(style.info("Adding the path for the new origin"))
						res = await insertForumPath(results)
					}else if(retrieved_origin._id_origin){
						const forum_path_check = await selectForumPath(retrieved_origin._id_origin)
						if(!forum_path_check){
							console.log(style.error("Watch out, an origin was inserted without a linked path. Fixing the link"))
							res = await insertForumPath(results)
						}else{
							console.log(style.info("Updating the path for the origin"))
							res = await updateForumPath(results)
						}
					}
					
					if(res){
						console.log(style.success("Successfully updated the database with the paths for the origin: " + style.data(results._id_origin)))
					}else{ console.log(style.error("Error while updating the database"))}

				}
				
				return shouldCrawlerFinish
			},
		},
		
		async requestHandler({ proxyInfo, request, body}) {
			if(verbose){
				console.log(style.line())
				console.log(style.sysinfo(`Analyzing new ${request.label}`))
				console.log(style.info(`Request url: ${request.url}`))
				console.log(style.info(`Using proxy: ${proxyInfo?.url ?? "no proxy"}`));
			}
			
			// First exploration phase, find the different components on the Thread list to move around
			if(request.label === 'EXPLORE'){ 
				if(explore){
					
					const html_stripped = smallizeHTML(body.toString(), verbose)
					
					if(results.next_page_path){	
						const $ = cheerio.load(html_stripped)
						next_page.path = results.next_page_path
						next_page.link = $(next_page.path).attr('href') ?? ''
					}else {		//Prima richiesta
						
						const request_domain = new URL(request.url) 
						const _id_origin = await selectOrigin( is_onion ? 2 : 0, request_domain.href ) // Cateogria a 2 per dark 0 per clear
						
						if(typeof(_id_origin) === 'undefined'){
							var whois : string | WhoisSearchResult = ''
							if(!is_onion && request_domain.hostname !== '127.0.0.1'){ //TODO Qui sarebbe fico trovare un alternativa al WHOIS per i .onion
								whois = await whoiser( request_domain.hostname )
								.catch((err) => {
									console.error(style.error(`Error while trying to retrieve the whois for ${request_domain.hostname}. Error message: "${err}"`))
									return "Can't retrieve whois"
								})
							}
							
							const additional_infos = JSON.stringify( whois )
							
							// Setup dell'ogetto da inviare al db
							const origin : OriginInput = {
								domain: request_domain.href,
								name: null,
								is_dead_score: 0,
								category: is_onion ? 2 : 0, //0 web, 1 telegram, 2 dark
							}
							
							const _id_new_origin = await insertOrigin(origin)
							// Invio al db
							if( _id_new_origin ){
								
								const origin_history : OriginHistoryInput = {
									additional_infos: additional_infos,
									updated_time: Date.now()/1000,
									_id_origin: _id_new_origin
								}
								
								const checkinsert = await insertOriginHistory(origin_history)
								if(checkinsert){
									retrieved_origin._id_origin = _id_new_origin
									retrieved_origin.is_new = true
									console.log(style.success(`New origin identified with domain ${origin.domain}`));
								}
								
							}else{ console.log(style.error(`Unexpected error while adding the new domain ${origin.domain}`)); return}
						}else{
							console.log(style.success(`Origin ${request_domain.href} already present in the origin DB. Exploration will only look for the paths`))
							retrieved_origin._id_origin = _id_origin
							retrieved_origin.is_new = false
						}
						
						next_page = find_next_page(html_stripped, new URL(request.url), 3)
						results.next_page_path = next_page.path
						console.log(style.success("Found the next page button, pretty cool! Now I can look for more pages! ᕕ(⌐■_■)ᕗ ♪♬ --> ") + style.data(next_page.path))
					}
					
					page_holder.push(html_stripped)
					console.log(style.info('Added the page in the page holder. Progress status: ') + style.data(`${page_holder.length}/${page_analyze}`))
					if(page_holder.length < page_analyze){
						if(next_page.path && next_page.link !== ''){
							await crawler.addRequests([{
								url: new URL( next_page.link ?? "", request.url).toString(),
								uniqueKey: randomUUID(),
								label: 'EXPLORE'
							}])
						}else {
							console.log(style.error(`Requested to analyze ${page_analyze} pages, but only found ${page_holder.length} pages`))
							explore = false
						}
					}else { explore = false }
				}
				
				if(!explore){
					
					console.log(style.line())
					console.log(style.success("Exploration ended, analyzing the " + page_holder.length + " loaded pages"))
					
					const tbody = find_thread_table(page_holder, undefined, thread_table_good_words, thread_table_bad_words, verbose) 
					
					if(tbody === undefined){	// Case of first exploration went wrong
						console.log(style.error("Can't find the tbody ;w;"))
					}else{
						const tbody_thread_href = find_thread_href(page_holder, tbody, undefined, thread_table_good_words, thread_table_bad_words, verbose)  ?? ''
						if(tbody_thread_href === undefined){
							console.log(style.error("Can't find the thread links ;w;"))
						}else{
							results.table_body_path = tbody	//assegnamento all'contenitore result
							results.thread_link_path = tbody_thread_href
							
							console.log(style.success("This looks like some juicy data to me (ﾉ◕ヮ◕)ﾉ*:・ﾟ✧"))
							console.log(style.info("Next page path: ") + (results.next_page_path ? style.data(results.next_page_path) : style.error(results.next_page_path)))
							console.log(style.info("Tbody path: ") + (results.table_body_path ? style.data(results.table_body_path) : style.error(results.table_body_path)))
							console.log(style.info("Thread href path(relative to the tbody): ") + (results.thread_link_path ? style.data(results.thread_link_path) : style.error(results.thread_link_path)))
							
							const thread_holder : Array<Request<Dictionary>> = []	// Array of requests to push in the queue
							
							page_holder.forEach((page, _) => {	//TODO Magari mettere un limitatore separato dal limitatore di pageine per il limitatore di threads
								
								const $ = cheerio.load(page)	
								
								$(results.table_body_path + ' ' + results.thread_link_path).each((_, link) => {	// Loads the requests for the different threads
									thread_holder.push(new Request( {
										url: (new URL($(link).attr('href') ?? "", request.url).toString()),
										label: 'EXPLORE_THREAD',
										uniqueKey: randomUUID(),
										userData: { title: $(link).text()}
									}))
								})
							})
							
							await crawler.addRequests(thread_holder)
						}
					}
				}
				// Second exploration phase, find the different components on the Thread get the juicy data
			}else if(request.label === 'EXPLORE_THREAD'){
				const html_stripped = smallizeHTML(body.toString(), verbose)
				thread_holder.push({title: request.userData.title, html: html_stripped})	//Title passed to make the search more accurate with the classifier
				
				shouldCrawlerFinish = true
			}
		},
		async failedRequestHandler() {
			this.proxyConfiguration?.newUrl()

			if(! await confirm({ message: "Do you want to retry? Added timeout and in case of proxy mode, proxy will be rotated ^w^", default: true })){  // La grande truffa, esiste solo tornare al menu)
				shouldCrawlerFinish = true
			}else{
				crawler.run([{url: url, label: 'EXPLORE', uniqueKey: randomUUID() }])
			}
		},
	});
	
	await crawler.run([
		{url: url, label: 'EXPLORE', uniqueKey: randomUUID() }
	]);	
}



