/**
 * @module scraperHTTP
 * @description Scraper HTTP that runs a scrape search/update on all the matching category. Core of the scraping loop
 * @category M-O_Scraper
 */


import { Configuration, HttpCrawler, ProxyConfiguration } from 'crawlee';
import { URL } from 'url';
import * as cheerio from 'cheerio'
import whoiser, { WhoisSearchResult } from 'whoiser'

import { ForumPath, OriginHistoryInput, SourceInput, SourceThreadInput } from '../TA-NK_database/dbschemas.js';
import { insertOriginHistory, insertSource, insertSourceThread, updateOriginDeadness, selectOrigin, selectOriginAll, selectSourceThread, updateOriginHistory,selectOrigin_OriginHistory_ForumPath, updateLastUrl, close_pool} from '../TA-NK_database/LFT-R.js';
import { style } from '../modules/style.js';
import { parseCustomDateFormat } from '../DOMPathExplorer/pathexplorer.js';
import { smallizeHTML } from '../DOMPathExplorer/smallizzator2.js';
import {load_configuration} from '../modules/conf_loader.js'
import { randomUUID } from 'crypto';

///////////////////////////////////////////////////////////////////
//// conf.json setup
///////////////////////////////////////////////////////////////////

const config = load_configuration()

if(!config){ 
	console.log(style.error("Error while loading the config.json file"))
	process.exit(-1)
}

////////////////////////////////////////////////////////////////////

const crawlee_log_config = Configuration.getGlobalConfig();
crawlee_log_config.set('logLevel', 'OFF');
let shouldCrawlerFinish = false; // Set at true at end crawling

/**
 * @description Scraper HTTP that runs a scrape search/update on all the matching category. Core of the scraping loop
 *
 * @async
 * @param {Object} options - The options for exploration.
 * @param {boolean} [options.proxymode=config.DEFAULT_PROXYMODE] - Whether to use the proxies for the connection [default = config.json DEFAULT_PROXYMODE]
 * @param {boolean} [options.verbose=config.DEFAULT_VERBOSE] - Whether to enable verbose mode. [default = config.json DEFAULT_VERBOSE]
 * 
 * @returns {Promise<void>}
 */
export const scraperHTTP = async ({proxymode = config.DEFAULT_PROXYMODE, 
	verbose = config.DEFAULT_VERBOSE, is_onion} : {proxymode?: boolean; verbose?: boolean, is_onion: boolean} ): Promise<void> => {
		
		var category = 0 // 0 Clean, 1 TG, 2 Dark
		var proxyConfiguration = undefined	// undefined -> no proxy used
		
		///////////////////////////////////////////////////////////////////
		//// Proxy Setup
		///////////////////////////////////////////////////////////////////
		
		if(is_onion){
			category = 2
			proxyConfiguration = new ProxyConfiguration({
				proxyUrls: [
					config.TOR_PROXY_ADDRESS+':'+config.TOR_PROXY_PORT,
				]
			})	
		}else if(proxymode){
			try {
				proxyConfiguration = new ProxyConfiguration({
					proxyUrls: [
						''// TODO mettere/importare da file esterno proxy fichi per vedere il mondo
						//`http://${process.env.PROXY_USERNAME_PASSWORD}@176.118.37.17:5432`,
					]
				})
			} catch (e) {
				console.log(style.error(`Error in the proxy configuration: ${e}\nExiting the program execution with status code -1`))
				process.exit(-1)
			}
		}
		
		///////////////////////////////////////////////////////////////////
		//// Crawler conf and logic
		///////////////////////////////////////////////////////////////////
		
		const crawler = new HttpCrawler({
			
			useSessionPool: true,
			ignoreSslErrors: true,
			persistCookiesPerSession: true,
			sessionPoolOptions: { maxPoolSize: 5 },
			/*
			maxConcurrency: 2,
			maxRequestsPerMinute: 20,
			requestHandlerTimeoutSecs: 30,
			*/
			proxyConfiguration: proxyConfiguration,
			autoscaledPoolOptions: {
				isFinishedFunction: async () => {
					//close_pool()
					return shouldCrawlerFinish
				}
			},
			
			async requestHandler({ proxyInfo, request, enqueueLinks,  body }) {
				// Uso cheerio separato visto che quello di crawlee è tarocco. Se si riscrive sta roba crawlee va fuori. Tho poco tempo tante funzionalita, it helps ¯\_(ツ)_/¯
				const $ = cheerio.load(smallizeHTML(body.toString(), verbose)) 
				
				if(verbose){
					console.log(style.line())
					console.log(style.sysinfo(`Analyzing new ${request.label}`))
					console.log(style.info(`Request url: ${request.url}`))
					console.log(style.info(`Using proxy: ${proxyInfo?.url ?? "no proxy"}`));
				}
				if(request.label === 'THREAD_LIST'){
					
					let forum_path : ForumPath | undefined = undefined // Dichiarata qua in quanto la prima richiesta lo prende dal DB mentre le altre lo prendono come attributo richiesta
					let last_url : string | undefined = undefined
					let explore : boolean = true
					
					if(request.userData.forum_path){	// Imposta le info passate da first req etc...
						forum_path = request.userData.forum_path
						last_url = request.userData.last_url
						explore = request.userData.explore
					}else{	// First req info gather
						
						const request_domain = new URL(request.url)				
						
						const origin = await selectOrigin_OriginHistory_ForumPath(category, request_domain.toString())
						
						if(origin){ // Check che l'origin sia presente
							
							last_url = origin.last_url		// URL dell'ultimo thread controllato(- offset)
							
							forum_path = {
								next_page_path: origin.next_page_path, 
								table_body_path: origin.table_body_path,
								thread_link_path: origin.thread_link_path,
								thread_title_path: origin.thread_title_path,
								thread_description_path: origin.thread_description_path,
								thread_pubblication_date_path: origin.thread_pubblication_date_path,
								_id_origin: origin._id_origin
							}
							
							if (new Date(origin.updated_time ) < new Date(Date.now() - config.CHECK_HISTORY_OFFSET)) { // se le informazioni salvate sono più vecchie di CHECK_HISTORY_OFFSET
								console.info(style.info(`Origin identified with id: ${forum_path._id_origin} and domain: ${request_domain.href} already present. Refreshing the data`));
								
								var whois : string | WhoisSearchResult = ''
								if(!is_onion && request_domain.hostname !== '127.0.0.1'){	// Skip whois per onion e localhost
									whois = await whoiser( request_domain.hostname )
									.catch((err) => {
										console.error(style.error(`Error while trying to retrieve the whois for ${request_domain.hostname}. Error message: "${err}"`))
										return "Can't retrieve whois"
									})
								}
								
								const additional_infos = JSON.stringify( whois )
								
								const new_dead_score = await updateOriginDeadness({_id_origin: forum_path._id_origin, set: 0}) // Azzera la deadness dell'origine
								
								if(new_dead_score){
									console.log(style.info(`Deadness of origin with ID: ${forum_path._id_origin} updated at ${new_dead_score}`))
								}
								if(origin.additional_infos === additional_infos ){
									const history_refresh : OriginHistoryInput = {
										updated_time: Date.now()/1000,
										_id_origin: forum_path._id_origin
									}
									updateOriginHistory(history_refresh, origin.updated_time)
								}else{
									const history_refresh : OriginHistoryInput = {
										additional_infos: additional_infos,
										updated_time: Date.now()/1000,
										_id_origin: forum_path._id_origin
									}
									insertOriginHistory(history_refresh)
								}
								
							} else { // se invece non è più vecchia di CHECK_HISTORY_OFFSET non refresho l'origin
								
								console.log(style.info(`Origin identified with id: ${forum_path._id_origin} and domain: ${request_domain.href} already present. Data already fresh, skipping`))
							}
							
						}else{ // in alternativa, se l'origin non esiste richiamo errore
							console.error(style.error("Sources should be inserted by the explorer before scraping! Please fix: ") + style.data(request_domain.href))
							explore = false
						}
					}
					
					
					if(forum_path && explore){
						
						// Array di link da passare al crawler
						const links : string[] = []  
						
						const thread_list_links = $(forum_path.table_body_path + ' ' + forum_path.thread_link_path)	// Lista di nodi con indirizzo thread
						
						if(typeof(request.userData.last_url) === "undefined" && forum_path._id_origin){ // First req update con nuovo last_url
							const new_last_url = $(thread_list_links[config.LINK_SCAN_OFFSET]).attr('href') // Prendo il link numero x, prendere il primo può crerare problemi di thread pinnati Es. Formato thread che saranno sempre lì
							if(new_last_url){
								await updateLastUrl(forum_path._id_origin, (new URL(new_last_url ?? "", request.url).toString()))
							}
						}
						
						let i = 0	// Iteratore per ciclare i diversi threads
						while(i < thread_list_links.length && explore){
							const thread_link = (new URL($(thread_list_links[i]).attr('href') ?? "", request.url).toString())
							if(thread_link === last_url){
								explore = false
								console.log(style.info(`Reached last checked link: ${last_url}`))
							}else{
								links.push(thread_link)
								//additionalData[thread_link]["replies_count"] = $(row).find('td.col_c_stats:nth-child(3) ul li').text().replace(/\D/g,'')
								//additionalData[thread_link]["views_count"] = $(row).find('td.col_c_stats:nth-child(4) ul li').text().replace(/\D/g,'')
								i++
							}
						}
						
						const nextPage = $(forum_path.next_page_path).attr('href')
						if(nextPage) {
							await enqueueLinks({
								urls: [new URL( nextPage ?? "", request.url).toString()],
								label: "THREAD_LIST",
								userData: { forum_path: forum_path, explore: explore, last_url: last_url}
							});	
						}
						
						// Accodamento delle richieste e dati associati
						console.log(style.info(`Found ${links.length} thread links, cool!`))
						await enqueueLinks({
							urls: links,
							label: "THREAD",
							userData: { forum_path: forum_path }
						});
					}//else{ console.log(style.error("Cannot retrieve the scrape paths for the origin: " + style.data(request.url)))}
				}else if(request.label === 'THREAD'){ //TODO Da pulire sto pezzo
					
					const extracted_title = $(request.userData.forum_path.thread_title_path).text().trim() ?? null
					
					const extracted_time = $(request.userData.forum_path.thread_pubblication_date_path).contents()
					.filter(function () {
						return this.type === 'text';
					})
					.map(function () {
						return $(this).text();
					})
					.get() ?? null
					
					if (extracted_time.length === 0) {
						extracted_time.push('');
					}
					
					const timecheck_extractor = new Array<Date>
					extracted_time.forEach((time, _) => {
						var date_found = new Date(time) 
						
						if(isNaN(date_found.getTime())){
							const parsedate = parseCustomDateFormat(time) 
							if(parsedate){ date_found = parsedate }
						}
						
						if(!isNaN(date_found.getTime())){
							timecheck_extractor.push(date_found)
						}
					})
					
					var date_found = null
					if(timecheck_extractor.length > 0){
						date_found = timecheck_extractor[0]
					}
					
					const extracted_description = $(request.userData.forum_path.thread_description_path).text().trim() ?? null
					
					if(extracted_title && extracted_time && extracted_description){
						
						if( typeof(await selectSourceThread(request.url)) !== 'number' ){	// TODO gestire casi update(bel casino il cambio di DB)
							const source : SourceInput = {
								spam_score: 0,
								published_time: date_found ? + date_found/1000 : null,	//Se extracted time è diverso da 0(assegnato in caso di undefined durante il find)
								crawled_time: Date.now()/1000,
								updated_time: Date.now()/1000,
								_id_origin: request.userData.forum_path._id_origin,
								_id_author: null
							}
							
							const _id_source = await insertSource(source)
							if(_id_source){
								
								const source_thread : SourceThreadInput = {
									url: request.url,
									title: extracted_title,
									description: extracted_description,
									replies_count: null,
									views_count: null,
									_id_source: _id_source
								}
								
								const _id_source_thread = await insertSourceThread(source_thread)
								
								if(_id_source_thread){
									console.log(style.success(`Successfully added a new source_thread with ID: ${_id_source_thread}`))
								}else{
									console.log(style.error(`Unexpected error while adding the source_thread for source with ID: ${_id_source}`))
								}
							}else{
								console.log(style.error(`Unexpected error while adding the source for origin with ID: ${source._id_origin}`))
							}
						}else{
							console.log(style.info('Skipping already present url: ') + style.data(request.url))
						}
					}
				}
				shouldCrawlerFinish = true
			},
			async failedRequestHandler({ request }) {
				var _id_origin = undefined 
				
				if( ! request.userData._id_origin ){
					const request_domain = new URL(request.url).hostname 
					_id_origin = await selectOrigin(category, request_domain )
				}else { _id_origin = request.userData._id_origin }
				
				if(_id_origin){
					updateOriginDeadness({_id_origin, raise: config.ORIGIN_DEADNESS_RAISE})
				}else{console.error(style.error(`Error while retrieving _id_origin to raise deadness for domain ${request.url}`))}
				
				this.proxyConfiguration?.newUrl()
				
			},
		});
		
		await crawler.run(await getStartOrigins(category));
		
	}
	
	async function getStartOrigins(category : number) : Promise<Array<{ url: string; label: string; }>> {
		const out : Array<{ url: string; label: string; uniqueKey: string }> = new Array()
		
		const origins = await selectOriginAll(category)
		if(origins){
			origins.forEach((domain) => {
				out.push({url: domain,label: 'THREAD_LIST', uniqueKey: randomUUID()})
			})
		}
		
		return out
	}
	
	