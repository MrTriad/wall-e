/**
 * @module smallizzator2
 * @description Cheerio parser and string stripper to make the HTML leaner to analyze and classify
 * @category DOMPathExplorer
 */

import * as cheerio from 'cheerio'
import { style } from '../modules/style.js';

const elementsToRemove = [
    'style',
    'header',
    'footer',
    'option',
    'nav',
    'input',
    'select',
    'img',
    'script',
    'link',
    'noscript',
    'iframe'
];

const attributesToRemove = [
    'id',
    'on',
    'style'
];

/**
 * @description Cheerio parser and string stripper to make the HTML leaner to analyze and classify
 *
 * @param {string} html Raw html to parse
 * @param {boolean} [verbose=true] Verbose mode
 * @returns {string} Stripped html
 */
export const smallizeHTML = ( html : string, verbose: boolean = true ): string => { 
    
    if(verbose){ console.log(style.sysinfo("Smallizzator on the job")) }
    
    const $ = cheerio.load(html)
    $('body').siblings().remove();
    
    for (let element of elementsToRemove) {
        $(element).remove();
    }
    
    for (let attribute of attributesToRemove) {
        $(`[${attribute}]`).removeAttr(attribute);
    }
    
    $('[class*="mobile"]').remove();
    
    const modifiedHtml = $.html('body').replace(/\s+/g, ' ').trim();
    
    if(verbose){ console.log(style.success("Process terminated, data got smalled from " + html.length + " chars to " + modifiedHtml.length)) }

    return modifiedHtml
}