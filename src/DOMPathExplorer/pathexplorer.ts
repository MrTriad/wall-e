/**
 * @module pathexplorer
 * @description Module containing the functions to find the thread elements via classifier and return the relative DOMpaths
 * @category DOMPathExplorer
 */

// Fecking Dumb Classifier aka DOMPathExplorer
import * as cheerio from 'cheerio';
import { style } from '../modules/style.js';

// Scores user around the code to keep things kinda standard and kinda easy. 
const bIncrement = 100
const mIncrement = 50
const sIncrement = 5

/**
 * @description Calculates the score for thread_title, thread_description, thread_pubblication_date and returns the classified scoring table. Those can be used to manual select between the found options 
 *
 * @param {Object} options - The options for exploration:
 * @param {Object[]} options.thread_holder - Array of the scraped pages to analyze. Title of the thread opened. Scraped from the thread list to help matching the title position htmlpath and smallized html of the scraped page to analyze 
 * @param {string} options.thread_holder.title - Title of the thread opened. Scraped from the thread list to help matching the title position htmlpath 
 * @param {string} options.thread_holder.html - Smallized html of the scraped page to analyze
 * @param {string[]} [options.good_words] - Array containing a dictionary of good words to match with title and description. Used by the classifier to give positive scores
 * @param {string[]} [options.bad_words] - Array containing a dictionary of bad words to match with title and description. Used by the classifier to give negative scores
 * @param {boolean} [options.verbose=config.DEFAULT_VERBOSE] - Whether to enable verbose mode. [default = config.json DEFAULT_VERBOSE]
 * 
 * @returns {Map<number, Map<string, number>>} Returns the 3 classification maps. In order: title, description and date
 */
export function find_thread_manual({ thread_holder, good_words, bad_words, verbose = true }: { thread_holder: Array<{ title: string; html: string; }>; good_words: Array<string>; bad_words: Array<string>; verbose?: boolean; }): Map<number, Map<string, number>> {

    // date and name < cap, desc > cap 
    const text_length_cap = 60;
    // numbers of time that a good word can match the title
    const match_cap = 1;

    // Thread score table initialization
    const thread_score = new Map<number, Map<string, number>>();
    for (var i = 0; i < 3; i++) {
        thread_score.set(i, new Map<string, number>());
    }

    thread_holder.forEach((thread) => {

        const $ = cheerio.load(thread.html);

        const trimmed_title = thread.title.trim();

        // Select multiple tags in a single Cheerio query
        const items = $('h1, h2, p, pre, span, abbr, section, div, article');

        // Iterate over the elements and create a unique list
        const uniqueItems = [...new Set(items.get())];

        // 0 readability tho l'alternativa mi faceva male all'ottimizzazione
        const scoring = [new Array(uniqueItems.length).fill(0), new Array(uniqueItems.length).fill(0), new Array(uniqueItems.length).fill(0)]; //title, desc, date

        uniqueItems.forEach((item, i) => {

            if (item.tagName == "h1" || item.tagName == "h2") { //titolo
                scoring[0][i] += bIncrement;
                scoring[1][i] -= bIncrement;
                scoring[2][i] -= bIncrement;
            } else if (item.tagName == "span") { //titolo data
                scoring[0][i] += mIncrement;
                scoring[1][i] -= mIncrement;
                scoring[2][i] += mIncrement;
            } else if (item.tagName == 'p' || item.tagName == 'pre' || item.tagName == 'section') { //descrizione
                scoring[1][i] += mIncrement;
            } else if (item.tagName == 'abbr') { scoring[2][i] += bIncrement; }

            var text = '';
            if (item.tagName === 'div') {
                const children = $(item).children('p, pre, section');
                if (children.length > 0) {
                    text += children.text();
                }
            } else {
                text = $(item).text();
            }

            text = text.trim();

            //const text = $(item).text().trim()
            if (text.length < text_length_cap) {
                scoring[0][i] += mIncrement;
                scoring[2][i] += mIncrement;
            }

            scoring[0][i] += titleChecker(text, trimmed_title, good_words, bad_words, match_cap);

            const descriptiontext = getSelectChildText($, item, 2);

            scoring[1][i] += descriptionChecker(descriptiontext, trimmed_title, good_words, bad_words);

            const dateText = $(item).contents().filter(function () {
                return this.type === 'text';
            }).text();
            // Test vari specifici su data
            scoring[2][i] += dateChecker(dateText);
        });

        thread_score.forEach((map, i) => {
            const item_found = $(items[scoring[i].indexOf(Math.max.apply(Math, scoring[i]))]);
            const item_path = find_parent_path($, item_found);
            mapIncrement(item_path, map);
        });

    });

    if (verbose) {
        console.log(style.line());
        console.log(style.info('Final title scoring'));
        console.table(thread_score.get(0));
        console.log(style.info('Final description scoring'));
        console.table(thread_score.get(1));
        console.log(style.info('Final date scoring'));
        console.table(thread_score.get(2));
        console.log(style.solidLine());
    }

    return thread_score;
}

/**
 * @description Finds the htmlpath of the thread_title, thread_description and thread_pubblication_date in the thread context.
 *
 * @param {Object} Options 
 * @param {Array<string>} Options.thread_holder Array of the scraped threads to analyze. Containing the stripped html
 * @param {number} [Options.number_of_parents=3] Precision of the htmlpath to return <wrap> -> <wrap> -> <wrap>
 * @param {Array<string>} Options.good_words Array containing a dictionary of good words to match with title and description. Used by the classifier to give positive scores
 * @param {Array<string>} Options.bad_words Array containing a dictionary of bad words to match with title and description. Used by the classifier to give negative scores
 * @param {boolean} [Options.verbose=true] Whether to enable verbose mode. [default = true]
 * @returns {Object} Paths found or undefined if not found
 * @returns {(string | undefined)} Object.title
 * @returns {(string | undefined)} Object.description
 * @returns {(string | undefined)} Object.date
 */
export function find_thread_title({ thread_holder, number_of_parents = 3, good_words, bad_words, verbose = true }: { thread_holder: Array<{ title: string; html: string; }>; number_of_parents: number; good_words: Array<string>; bad_words: Array<string>; verbose?: boolean; }): { title: string | undefined; description: string | undefined; date: string | undefined; } {

    const text_length_cap = 60;
    const match_cap = 1;

    const thread_score = new Map<number, Map<string, number>>();
    for (var i = 0; i < 3; i++) {
        thread_score.set(i, new Map<string, number>());
    }

    thread_holder.forEach((thread) => {

        const $ = cheerio.load(thread.html);

        const trimmed_title = thread.title.trim();

        // Select multiple tags in a single Cheerio query
        const items = $('h1, h2, p, pre, span, abbr, section, div, article');

        // Iterate over the elements and create a unique list
        const uniqueItems = [...new Set(items.get())];

        // 0 readability tho l'alternativa mi faceva male all'ottimizzazione
        const scoring = [new Array(uniqueItems.length).fill(0), new Array(uniqueItems.length).fill(0), new Array(uniqueItems.length).fill(0)]; //title, desc, date

        uniqueItems.forEach((item, i) => {

            if (item.tagName == "h1" || item.tagName == "h2") { //titolo
                scoring[0][i] += bIncrement;
                scoring[1][i] -= bIncrement;
                scoring[2][i] -= bIncrement;
            } else if (item.tagName == "span") { //titolo data
                scoring[0][i] += mIncrement;
                scoring[1][i] -= mIncrement;
                scoring[2][i] += mIncrement;
            } else if (item.tagName == 'p' || item.tagName == 'pre' || item.tagName == 'section') { //descrizione
                scoring[1][i] += mIncrement;
            } else if (item.tagName == 'abbr') { scoring[2][i] += bIncrement; }

            var text = '';
            if (item.tagName === 'div') {
                const children = $(item).children('p, pre, section');
                if (children.length > 0) {
                    text += children.text();
                }
            } else {
                text = $(item).text();
            }

            text = text.trim();

            //const text = $(item).text().trim()
            if (text.length < text_length_cap) {
                scoring[0][i] += mIncrement;
                scoring[2][i] += mIncrement;
            }

            scoring[0][i] += titleChecker(text, trimmed_title, good_words, bad_words, match_cap);

            const descriptiontext = getSelectChildText($, item, 2);

            scoring[1][i] += descriptionChecker(descriptiontext, trimmed_title, good_words, bad_words);

            const dateText = $(item).contents().filter(function () {
                return this.type === 'text';
            }).text();
            // Test vari specifici su data
            scoring[2][i] += dateChecker(dateText);
        });

        thread_score.forEach((map, i) => {
            const item_found = $(items[scoring[i].indexOf(Math.max.apply(Math, scoring[i]))]);
            const item_path = find_parent_path($, item_found, number_of_parents);
            mapIncrement(item_path, map);
        });

    });

    if (verbose) {
        console.log(style.line());
        console.log(style.info('Final title scoring'));
        console.table(thread_score.get(0));
        console.log(style.info('Final description scoring'));
        console.table(thread_score.get(1));
        console.log(style.info('Final date scoring'));
        console.table(thread_score.get(2));
        console.log(style.solidLine());
    }

    const found_title = thread_score.get(0)?.size ?? 0 > 0 ? mapReduceMax(thread_score.get(0)) : undefined;
    const found_description = thread_score.get(1)?.size ?? 0 > 0 ? mapReduceMax(thread_score.get(1)) : undefined;
    const found_date = thread_score.get(2)?.size ?? 0 > 0 ? mapReduceMax(thread_score.get(2)) : undefined;

    const result: { title: string | undefined; description: string | undefined; date: string | undefined; } = {
        title: found_title ? found_title[0] : undefined,
        description: found_description ? found_description[0] : undefined,
        date: found_date ? found_date[0] : undefined
    };

    return result;
}



/**
 * @description Finds the htmlpath of the href pointing to the thread. The path is relative to the tbody_path found
 *
 * @param {Array<string>} page_holder Array of the scraped pages to analyze. Containing the stripped html
 * @param {string} tbody_path Found html path of the table where you should find the thread href
 * @param {number} [number_of_parents=3] Precision of the htmlpath to return <wrap> -> <wrap> -> <wrap>
 * @param {Array<string>} good_words Array containing a dictionary of good words to match with title and description. Used by the classifier to give positive scores
 * @param {Array<string>} bad_words Array containing a dictionary of bad words to match with title and description. Used by the classifier to give negative scores
 * @param {boolean} [verbose=true] Whether to enable verbose mode. [default = true]
 * @returns {(string | undefined)} Relative path found or undefined if not found
 */
export const find_thread_href = (page_holder: Array<string>, tbody_path: string ,number_of_parents = 3, good_words : Array<string>, bad_words : Array<string>, verbose = true) : string | undefined =>{   
    
    const length_cap = 15
    const path_score = new Map<string, number>()
    
    page_holder.forEach((page, i) => {  // Dam iniziano a diventare tanti cicli. Sarebbe carino parallelizzare però boh vediamo
        
        const $ = cheerio.load(page)
        //console.log($(links[scoring.indexOf(Math.max.apply(Math, scoring))]).text())
        var rows 
        if(tbody_path.includes('tbody')){
            rows = $(tbody_path).find('tr')
        }else{
            rows = $(tbody_path).children('div')
        }
        
        const row_score = new Map<string, number>()
        
        rows.each((_, row) => {
            
            const links = $(row).find('a')
            const scoring = new Array(links.length).fill(0)
            
            links.each((z, link) => {
                
                var contained_word_blob = ''
                
                const text = $(link).text()
                
                if(text.length < length_cap){ scoring[z] -= mIncrement}
                
                contained_word_blob += text
                // FIXME se vuoi dare un occhio su perchè pensa che questo sia errato
                // @ts-ignore
                contained_word_blob += Object.values($(link).attr()).join('')
                
                scoring[z] += containsCount(contained_word_blob, good_words, bad_words, sIncrement, -sIncrement)
            })
            
            const link_found = $(links[scoring.indexOf(Math.max.apply(Math, scoring))]) //ottiene item con scoring massimo
            const link_path = find_parent_row($ ,link_found, number_of_parents)
            
            mapIncrement(link_path,row_score)
        })
        if(verbose){
            console.log(style.line())
            console.log(style.info('Row level scoring for page ') + style.data(i) )
            console.table(row_score)
        }
        
        const row_max = row_score.size > 0 ? mapReduceMax(row_score) : undefined
        if (row_max) { mapIncrement(row_max[0], path_score) }
        
    });
    
    if(verbose){
        console.log(style.line())
        console.log(style.info('Table level scoring'))
        console.table(path_score)
        console.log(style.solidLine())
    }
    
    const path_max = path_score.size > 0 ? mapReduceMax(path_score) : undefined
    return path_max ? path_max[0] : undefined
}




/**
 * @description Finds the htmlpath of the thread_table cointaining the thread_list.
 *
 * @param {Array<string>} page_holder Array of the scraped pages to analyze. Containing the stripped html
 * @param {number} [number_of_parents=3] Precision of the htmlpath to return <wrap> -> <wrap> -> <wrap>
 * @param {Array<string>} good_words Array containing a dictionary of good words to match with title and description. Used by the classifier to give positive scores
 * @param {Array<string>} bad_words Array containing a dictionary of bad words to match with title and description. Used by the classifier to give negative scores
 * @param {boolean} [verbose=true] Whether to enable verbose mode. [default = true]
 * @returns {(string | undefined)} Path found or undefined if not found
 */
export const find_thread_table = (page_holder: Array<string>, number_of_parents: number = 3, good_words : Array<string>, bad_words : Array<string>, verbose: boolean = true) : string | undefined =>{   
    
    const tr_min = 15, tr_max = 40
    
    const path_score = new Map<string, number>()
    
    page_holder.forEach((page, _) => {
        const $ = cheerio.load(page)    // Valuto se utilizzare come item le tabelle oppure i div nel caso non vi siano presenti tabelle
        var items = $('tbody')
        if(items.length == 0){
            items = $('div')
        }
        
        const scoring = new Array(items.length).fill(0)
        
        items.each((j, item) => {
            if($(item).children().length !== 0){
                const rows = item.tagName == 'tbody' ? $(item).find('tr') : $(item).children('div')
                // Check per vedere se le tr sono tra min e max
                //
                if (rows.length > tr_min && rows.length < tr_max) { scoring[j] += bIncrement } else { scoring[j] -= bIncrement }
                
                // Check word su text blob
                //
                var contained_word_blob = ''
                rows.each( (_, row) => {
                    const children = $(row).children() 
                    contained_word_blob += children.text()
                    const child_attributes = $(children).attr() 
                    if(child_attributes){
                        contained_word_blob += Object.values(child_attributes).join('');}
                    })
                    // Check dizionario per vedere se nelle righe ci sono parole good/bad e scoring di conseguenza
                    //
                    scoring[j] += containsCount(contained_word_blob, good_words, bad_words, sIncrement, -sIncrement)  
                }else{
                    scoring[j] -= bIncrement
                }
            })
            
            const item_found = $(items[scoring.indexOf(Math.max.apply(Math, scoring))]) //ottiene item con scoring massimo
            const parent_path = find_parent_path($ ,item_found, number_of_parents)
            
            mapIncrement(parent_path,path_score)
        });
        
        if(verbose){
            console.log(style.line())
            console.log(style.info('Final scoring'))
            console.table(path_score)
            console.log(style.solidLine())
        }
        
        const path_max = path_score.size > 0 ? mapReduceMax(path_score) : undefined    
        return path_max ? path_max[0] : undefined
    }
    
    function containsCount(to_test : string, good_words : string[] = [], bad_words : string[] = [], good_word_points : number = sIncrement , bad_word_points : number = -sIncrement, match_cap : number|null = null ) : number {
        var out = 0
        
        if(to_test.length === 0){
            
            to_test = to_test.toLowerCase()
            
            if(good_words){
                good_words.forEach( good_word => { 
                    const matches = (to_test.match(new RegExp(escapeRegExp(good_word), 'g') ) || []).length
                    if(match_cap){
                        if( matches < match_cap ) { out += (matches * good_word_points) }
                    }else{ out += (matches * good_word_points); }
                })
            }
            if(bad_words){
                bad_words.forEach( bad_word => { out += (((to_test.match(new RegExp(bad_word, 'g') ) || []).length) * bad_word_points) } )
            }
        }
        
        return out
    }
    
    function escapeRegExp(regex : string) {
        return regex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }
    
    /**
    * @description Gathers the htmlpath to the next_page button in a forum scenario
    * 
    * @param {string} html Html of the page to analyze 
    * @param {string} url_path Path of the request/origin url
    * @param {number} number_of_parents Number of parent element to return in the CSS path
    * @returns {Object} An Object containing the CSS path with tagname.class format of the [number_of_parents] length and the url link to the next page
    * @returns {string} Object.path the CSS path with tagname.class format of the [number_of_parents] length
    * @returns {string} Object.link the url link to the next page
    */
    export const find_next_page = (html : string, url_path : URL | null = null, number_of_parents : number = 3) : { path: string; link: string } => {
        
        const $ = cheerio.load(html)    // Load the page
        
        const next_page_dict = [ //spaventosamente barebone
        "next",
        "avanti",
        "pagenav"
    ]
    
    // Look for all the a link and prepare an array to score the items
    const items = $('a')    
    const scoring = new Array(items.length).fill(0) 
    
    items.each((i, item) => {
        
        // Check per vedere se i sibling sono numeri crescenti
        //
        var sibling_text_blob = ''
        $(item).siblings().each((_, sibling) => { 
            sibling_text_blob += $(sibling).text().trim() 
        })
        if(containOrderedNumbers( 2, 8, sibling_text_blob)) { scoring[i] += sIncrement }
        
        // Check per vedere se il testo contiene la parola Next e amici vari
        //
        next_page_dict.forEach( test => {
            if($(item).text().toLowerCase().includes(test)){ scoring[i] += bIncrement }else{ scoring[i] -= mIncrement }
        })
        
        // Check per vedere se l'href contiene il path del percorso attuale
        //
        const link = $(item).attr('href')
        if(link && url_path){
            if(!link.includes(url_path.hostname)) { scoring[i] -= bIncrement }
        }
    })
    
    const item_found = $(items[scoring.indexOf(Math.max.apply(Math, scoring))]) //ottiene item con scoring massimo
    
    const item_path = find_parent_path($ ,item_found, number_of_parents)
    return {path: item_path, link: $(item_path).attr('href') ?? ''}
}

/**
* 
* @param {cheerio.CheerioAPI} $ Parser cheerio with loaded page
* @param {cheerio.Cheerio<cheerio.Element>} item_found The item who will get the path returned
* @param {number} number_of_parents Number of parent element to return in the CSS path
* @returns {string} CSS path with tagname.class format of the [number_of_parents] length
*/
function find_parent_path($ : cheerio.CheerioAPI , item_found : cheerio.Cheerio<cheerio.Element> , number_of_parents: number = 3 ) : string {
    
    const parents = item_found.parents().addBack()                                  //prende parents dell'item
    const filtered_parents = parents.slice(parents.length >= number_of_parents ? parents.length - number_of_parents : 0)      //taglia in base al number of parents richiesto
    
    const css_path_selector = filtered_parents.map((_, el) => {                     //genera css selector prendendo classe e tag
        // @ts-ignore
        const tagName = el.tagName;
        const classes = $(el).attr('class');
        
        return classes ? `${tagName}.${classes.trim().replace(/\s+/g, '.')}` : tagName;
    }).get().join(' ');
    return css_path_selector
    
}

function find_parent_row($ : cheerio.CheerioAPI , item_found : cheerio.Cheerio<cheerio.Element>, number_of_parents: number = 3 ) : string {
    
    const parents = item_found.parentsUntil('tr').addBack()                                  //prende parents dell'item
    const filtered_parents = parents.slice(parents.length >= number_of_parents ? parents.length - number_of_parents : 0)
    
    const css_path_selector = filtered_parents.map((_, el) => {                     //genera css selector prendendo classe e tag
        // @ts-ignore
        const tagName = el.tagName;
        const classes = $(el).attr('class');
        
        return classes ? `${tagName}.${classes.trim().replace(/\s+/g, '.')}` : tagName;
    }).get().join(' ');
    return css_path_selector
    
}

/**
* 
* @param {number} min Min length of the ordered number substring
* @param {number} max Max length of the ordered number substring
* @param {string} string String to analyze
* @returns {boolean} Boolean result of the request
*/
function containOrderedNumbers(min : number, max : number, string : string) : boolean {
    const regex =/(0?1?2?3?4?5?6?7?8?9?)/gm
    var out = false, i = 0;
    
    const res = string.match(regex)
    if(res){
        do{
            if(res[i].length >= min && res[i].length <= max){ out = true }
            i++
        } while(i < res.length && !out)
    }
    
    return out
}

function mapIncrement(key : string, map : Map<string, number>, increment = 1) {
    if(key){   
        const current_path_score = map.get(key)
        if(current_path_score !== undefined){
            map.set(key, current_path_score + increment)
        }else{
            map.set(key, increment)
        }
    }
}



/**
 * @description Simple parser method that tries to parse raw text gathered from HTMLpath in a Date object
 *
 * @param {cheerio.CheerioAPI} $ Cheerio api
 * @param {string} date_path HTMLpath of the date to analyze 
 * @returns {(Date | undefined)} Date parsed object or undefined if not found
 */
export const getDateFromRaw = ($ : cheerio.CheerioAPI ,  date_path : string) : Date | undefined => {
    
    const extracted_time = $(date_path).contents()
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
    
    var date_found = undefined
    if(timecheck_extractor.length > 0){
        date_found = timecheck_extractor[0]
    }

    return date_found
}


/**
 * @description Reduce a Map returning the only the max value object
 *
 * @param {(Map<string,number> | null | undefined)} map Map to reduce. In case of undefined/null map the function will return undefined
 * @returns {([string, number] | undefined)} Max value object or undefined in case of wrong map insert
 */
export const mapReduceMax = (map : Map<string,number> | null | undefined) : [string, number] | undefined => {
    if( map === null || map === undefined ){
        return undefined
    }else{
        return [...map.entries()].reduce((accumulator, element) => {
            return element[1] > accumulator[1] ? element : accumulator;
        });
    }
}

function dateChecker(test_string : string) : number{
    var out = 0
    
    if(test_string.length < 15){ out -= mIncrement
    }else{ out += mIncrement}
    
    const date_found = new Date(test_string) 
    
    if(!isNaN(date_found.getTime())){
        
        if(date_found < new Date()){
            out += mIncrement
        }else{ out -= bIncrement }
    }else{
        const parsedate = parseCustomDateFormat(test_string)
        if(parsedate && parsedate < new Date()){
            out += mIncrement
        }else{ out -= bIncrement }
    }
    
    const number_of_numbers = (test_string.match(/\d/g) || []).length
    
    if( number_of_numbers > test_string.length - number_of_numbers ){
        out += mIncrement
    }else{ out -= mIncrement }
    
    return out
}

function titleChecker(test_string: string, trimmed_title: string, good_words : string[] = [], bad_words : string[] = [], match_cap = 2){
    var out = 0
    
    out += containsCount(test_string, good_words.concat(trimmed_title.split(' ')), bad_words, undefined, undefined, match_cap)
    //if(out != 0){console.log(test_string + ' ' + out)}
    //spazio ad altra roba
    return out
}

function descriptionChecker(test_string: string, trimmed_title: string, good_words : string[] = [], bad_words : string[] = []){
    const dumb_add = ["hidden", "content", "must", "view", "content"]
    var out = 0
    
    if(test_string.length > 300){
        out += bIncrement 
    }else{ out -= bIncrement }
    
    out += containsCount(test_string, good_words.concat(dumb_add).concat(trimmed_title.split(' ')), bad_words, sIncrement, sIncrement)
    // spazio ad altra roba
    return out
}


/**
 * @description Very temporary raw text to Date object parser
 *
 * @param {string} test_string string to parse
 * @returns {Date | undefined} Date object or undefined in case of parsing error
 */
export const parseCustomDateFormat = (test_string : string) : Date | undefined => { // FIXME I mean, questa funzione è un po' un test fallito, solo che diventa alquanto complessa se fatta bene
    const regex = /(\d{1,2})\s+([A-Za-z]+),\s+(\d{4})\s+-\s+(\d{1,2}):(\d{2})\s+(AM|PM)/;
    const match = test_string.match(regex);
    
    var date
    
    if (match) {
        const day = parseInt(match[1], 10);
        const monthName = match[2];
        const year = parseInt(match[3], 10);
        var hour = parseInt(match[4], 10);
        const minute = parseInt(match[5], 10);
        const amPm = match[6].toUpperCase();
        
        // Mappa il nome del mese a un numero di mese
        const monthMap = {
            January: 0,
            February: 1,
            March: 2,
            April: 3,
            May: 4,
            June: 5,
            July: 6,
            August: 7,
            September: 8,
            October: 9,
            November: 10,
            December: 11
        };
        
        
        // @ts-ignore
        const month = monthMap[monthName];
        
        // Aggiungi 12 ore se l'orario è PM
        if (amPm === 'PM' && hour !== 12) {
            hour += 12;
        }
        
        date = new Date(year, month, day, hour, minute);
    }
    
    if( !date || isNaN(date.getTime())){
        
        const dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{1,2})/;
        const match = test_string.match(dateRegex);
        
        if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1; // Mese inizia da 0
            const year = parseInt(match[3], 10);
            const hour = parseInt(match[4], 10);
            const minute = parseInt(match[5], 10);
            
            // Crea e restituisci l'istanza di classe Date
            date = new Date(year, month, day, hour, minute);
        }
    }
    
    if( !date || isNaN(date.getTime())){
        return undefined
    }else{ 
        return date 
    }
}


function getSelectChildText($ : cheerio.CheerioAPI ,element : cheerio.Element ,number_of_child = 3){
    
    var blobtext = $(element).contents().filter(function () {
        return this.type === 'text';
    }).text();
    
    for(var i=0; i<number_of_child; i++){
        const children = $(element).children()
        if(children.length > 0){
            children.each((_, child) => {
                blobtext += $(child).contents().filter(function () {
                    return this.type === 'text';
                }).text();
            })
        }
    }
    
    return blobtext
}