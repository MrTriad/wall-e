/**
 * @module FIX-IT
 * @description Eats a JSON classifies fields like email, phone number, etc. Sets the recognized fields to standard names
 * @category misc
 */


//Base Level Classifier
//Mangia un JSON riconosce campi come email, numero di cell, etc. Imposta i nomi standard al posto dei field originali



//Ora come ora tenuto separato dai convertitori per modularità


import chalk from 'chalk';

const regexClassifier = {
    email_address: new RegExp(/[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/),
    phone_number: new RegExp(/^((\+?\d{1,2}\s)?\(?\d{2,3}\)?[\s.-]\d{3,4}[\s.-]\d{4}|\+?\d{10,12})$/),
    ip_address: new RegExp(/\b(?:(?:2(?:[0-4][0-9]|5[0-5])|[0-1]?[0-9]?[0-9])\.){3}(?:(?:2([0-4][0-9]|5[0-5])|[0-1]?[0-9]?[0-9]))\b/),
    username: new RegExp(/^[a-z,A-Z]{3,12}([0-9]{0,8})$/) //kinda for test only
};

/**
* @description Tests the file against a different regex test(for now). Generates fixes to apply in the future
*
* @param {JSON} jsonedDB Original database standardized in JSON format 
* @param {number} max_tests Cap of the number of entry to test(less is quicker, more is more accurate)
* @return {Map<string, string> | undefined} Map standard field name -> inputted db field name
*/
export const test_file = (jsonedDB : any[], max_tests : number) : Map<string,string> | undefined => {
    console.log("\nWelcome in the Base Level Classifier!\n");
    
    try {
        
        /**
        * Scoring è un oggetto contenente 
        * regexClassifier[0]: [0, 0, ...fields.length]
        * regexClassifier[1]: [0, 0, ...fields.length]
        * ...
        * regexClassifier[RegexClassifier.length]: [0, 0, ...fields.length] 
        * 
        * Permette per ogni test di avere uno score di quanti match ottiene il test sul dato field
        */
        const scoring = new Object(); 
        const fields = Object.keys(jsonedDB[0]); //Prendi i fields dalla prima entry. L'indice buffo è per fat star zitto ts
        
        for (var regex_test in regexClassifier) {
            // @ts-ignore
            scoring[regex_test] = new Array(fields.length).fill(0);
        }
        
        var test_cycle=0
        while (test_cycle < max_tests && jsonedDB[test_cycle]){
            const entry = jsonedDB[test_cycle]
            for (var i = 0; i < fields.length; i++) {
                for (regex_test in regexClassifier) {
                    // @ts-ignore
                    if (regexClassifier[regex_test].test(entry[fields[i]]))
                    // @ts-ignore
                    scoring[regex_test][i]++;
                }
            }
            test_cycle++
        }
        
        console.log(`[+] Test ended, checked ${test_cycle} entries here's the results:\n`);
        
        const fixes_out = new Map()
        
        for (var key in regexClassifier) {
            // @ts-ignore
            const index = findIndex(scoring[key]);
            if (index >= 0) {
                console.log(chalk.green(`[-->] Matches! Test ${key} matches with the field: ${fields[index]}`));
                fixes_out.set(key, fields[index])
            } else if (index === -1) {
                console.log(`[-->] Undecided :/ There are multiple even matches for the test ${key}`);
                fixes_out.set(key, null)
            } else if (index === -2) {
                console.log(chalk.red(`[-->] Not found ;w; There are no matches for the test ${key}`));
                fixes_out.set(key, null)
            } else {
                console.log(chalk.red(`[!] Error during the test ${key}`));
            }
            
        }
        return fixes_out
    } catch (err) {
        // @ts-ignore
        if (err.code === 'ENOENT') {
            console.error('File not found!');
            return undefined
        } else {
            throw err;
        }
    }
    
};






/*  findIndex prende in ingresso un vettore di numeri. 
In out, restituisce:
-2 nel caso non vi sia un valore massimo > 0
-1 nel caso vi siano due indici con lo stesso valore
nIndice nel caso vi sia un unico indice di valore massimo > 0
*/

function findIndex(arr : Array<number>) {  
    const indices = [];
    const max = Math.max.apply(Math, arr);
    if(max === 0){
        return -2
    }else{
        let idx = arr.indexOf(max);
        do  {
            indices.push(idx);
            idx = arr.indexOf(max, idx + 1);
        } while(idx !== -1)
        
        return indices.length > 1 ? -1 : indices[0]
    }
}

