/**
* @module walle
* @description Entry point
* @category main
*/

import select from '@inquirer/select'
import confirm from '@inquirer/confirm'
import { style } from "./src/modules/style.js";
import { input } from '@inquirer/prompts';
import checkbox from '@inquirer/checkbox';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import path from "path";

import { load_configuration } from "./src/modules/conf_loader.js";
import { exploreHTTP } from "./src/M-O_Scraper/explorerHTTP.js";
import { cleandb } from './devScripts/cleandb.js';
import { scraperHTTP } from './src/M-O_Scraper/scraperHTTP.js';
import { close_pool, search, search_source_thread } from './src/TA-NK_database/LFT-R.js';

// http://127.0.0.1/siti_baddies/new_nulled_5pages/www.nulled.to/forum/184-dumps-databases/index5ac3.html
// http://breachedu76kdyavc6szj6ppbplfqoz3pgrk3zw57my4vybgblpfeayd.onion/Forum-Databases

////////////////////////////////////////////////////////////////////
//// conf.json setup
////////////////////////////////////////////////////////////////////

const config = load_configuration()


if(!config){
    console.log(style.error("Error while loading the config.json file"))
    process.exit(-1)
}


////////////////////////////////////////////////////////////////////

var option : number | undefined
var keepgoing = true // giusto per separarlo da option altrimenti diventa confusionale

do{
    banner()
    
    option = await select({
        message: 'Choose an option to continue:',
        choices: [
            {
                name: 'Insert a new origin',
                value: 1,
                description: 'Insert a new clearweb/telegram/darkweb origin to be sourced'
            },
            {
                name: 'Source manually',
                value: 2,
                description: 'Source manually the clearweb/telegram/darkweb origins'
            },
            {
                name: 'Search the data',
                value: 3,
                description: 'Search in the database'
            },
            {
                name: 'Settings',
                value: -1,
                description: 'Configurations and dev thingies!'
            },
            {
                name: 'Exit',
                value: 0,
                description: "I'm gonna miss ya ;w;"
            }
        ]
    })
    
    switch (option) {
        case 1:
        switch (await choose_origin_category()) {
            case 0: case 2: // ClearWeb, DarkWeb
            await exploreHTTP({
                url: await input({ message: 'Enter the url to setup: '})
            })
            keepgoing = await confirm({ message: "Do you want to return to the main menu? ^w^", default: true }) // La grande truffa, esiste solo tornare al menu
            break;
            case 1: // Telegram
            keepgoing = await tginsert( 
                await input({ message: 'Enter the telegram tag to setup: '})
                )
                break;
                default:
                break;
            }
            break;
            case 2:
            switch (await choose_origin_category()) {
                case 0: // ClearWeb
                await scraperHTTP({
                    is_onion: false,
                    proxymode: config.DEFAULT_PROXYMODE,
                    verbose: config.DEFAULT_VERBOSE
                })
                keepgoing = await confirm({ message: "Do you want to return to the main menu? ^w^", default: true })
                break;
                case 1: // Telegram
                keepgoing = await tgscrape()
                break;
                case 2: // Dark
                await scraperHTTP({
                    is_onion: true,
                    proxymode: config.DEFAULT_PROXYMODE,
                    verbose: config.DEFAULT_VERBOSE
                })
                keepgoing = await confirm({ message: "Do you want to return to the main menu? ^w^", default: true })
                break;
                default:
                break;
            }
            break;
            case 3:
            await searchData( await input({ message: 'Enter the search Term: '}) )
            keepgoing = await confirm({ message: "Do you want to return to the main menu? ^w^", default: true }) // La grande truffa, esiste solo tornare al menu
            break;
            case -1:
            await settings()
            break;
            case 0:
            close_pool()
            console.log("Byeeeeeeee!")
            break;
            default:
            break;
        }
        //console.clear()
    }while(option != 0 && keepgoing)
    
    async function searchData(searchTerm : string){
        const searchFields_data = ["email_address", "phone_number", "ip_address", "username", "misc"]
        const searchFields_thread = ["title", "description"]
        
        const inputFields = await checkbox({ message: 'What kind of fields would you like to look search?', choices: searchFields_data.concat(searchFields_thread).map(field => ({ value: field })) })
        
        const input_data : Array<string> = []
        const input_thread : Array<string> = []

        inputFields.forEach((item) => {
            if (searchFields_data.includes(item)) {
                input_data.push(item);
            } else if (searchFields_thread.includes(item)) {
                input_thread.push(item);
            }
        });    
        
        const search_result_data = await search(input_data ,searchFields_data, searchTerm)
        const search_result_thread = await search_source_thread(input_thread, searchFields_thread, searchTerm)
        
        if(search_result_data || search_result_thread ){
            if(search_result_data){
                console.log(style.success(`Found ${search_result_data.length} data results:\n`))
                search_result_data.forEach((res,_) => console.log(res))
            }
            if(search_result_thread){
                console.log(style.success(`Found ${search_result_thread.length} thread results:\n`))
                search_result_thread.forEach((res,_) => console.log(res))
            }
        }else{
            console.log(style.info("No result matching with the search query found"))
        }
    }
    
    async function tginsert(telgram_tag : string) {
        
        //@ts-ignore controllato già a inizio file
        process.chdir(path.join(config.ROOT_PATH, "/src/telegram/")) 
        
        const py = spawn("python", ["tginsert.py", "--AddOrigin" , telgram_tag])
        py.stdout.on('data', async (data) => {
            const line = data.toString()
            console.log('\n' + line)
            if(line.includes("Please enter the code you received:") || line.includes("Please enter your password:")) {
                py.stdin.write((await input({ message: ''})) + '\n')
            }
        })
        py.stderr.on('data', function (data) {
            console.log('Error: ' + data);
        });
        
        await promiseFromChildProcess(py);
        
        return await confirm({ message: "Do you want to return to the main menu? ^w^", default: true })
    }
    
    async function tgscrape() {
        
        //@ts-ignore controllato già a inizio file
        process.chdir(path.join(config.ROOT_PATH, "/src/telegram/")) 
        
        const py = spawn("python", ["tgscraper.py"])
        py.stdout.on('data', (data) => {
            console.log('\n' + data.toString())
        })
        py.stderr.on('data', function (data) {
            console.log('Error: ' + data);
        });
        
        await promiseFromChildProcess(py);
        
        return await confirm({ message: "Do you want to return to the main menu? ^w^", default: true })
    }
    
    
    async function choose_origin_category() : Promise<number | undefined> {
        return await select({
            message: 'Select the category of the origin:',
            choices: [
                {
                    name: 'ClearWeb Forum',
                    value: 0
                },
                {
                    name: 'Telegram channel',
                    value: 1,
                },
                {
                    name: 'DarkWeb Forum',
                    value: 2,
                },
                {
                    name: 'Return to the menu',
                    value: undefined
                }
            ]
        })
    }
    
    async function settings() {
        const settings = await select({
            message: 'Settings:',
            choices: [
                {
                    name: 'ResetDB',
                    value: 1
                },
                {
                    name: 'Return to the menu',
                    value: undefined
                }
            ]
        })
        
        switch (settings) {
            case 1:
            await cleandb()
            await confirm({ message: "Do you want to return to the main menu? ^w^", default: true })
            break;
            
            default:
            break;
        }
    }
    
    function promiseFromChildProcess(child : ChildProcessWithoutNullStreams ) {
        return new Promise(function (resolve, reject) {
            child.addListener("error", reject);
            child.addListener("exit", resolve);
        });
    }
    
    function banner(){
        console.clear()
        console.log(`
        .:-====-                 
      :*+%%##%%==                ░██╗░░░░░░░██╗░█████╗░██╗░░░░░██╗░░░░░░░░░░░███████╗
      .+==#*::::                 ░██║░░██╗░░██║██╔══██╗██║░░░░░██║░░░░░░░░░░░██╔════╝
          *#:        :.:-:       ░╚██╗████╗██╔╝███████║██║░░░░░██║░░░░░█████╗█████╗░░
    ::::-*%+:..     :#+=+-       ░░████╔═████║░██╔══██║██║░░░░░██║░░░░░╚════╝██╔══╝░░
    *###***++===+= =#.:.         ░░╚██╔╝░╚██╔╝░██║░░██║███████╗███████╗░░░░░░███████╗
   +####%#=**+===-+#=            ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚══════╝╚══════╝░░░░░░╚══════╝
   %######***==--+#-             ░ Powered by CybergON ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 ==*####*+**+*+==+.              
*%######%%#+++**##*:             
-%#%##%%%%##%%@@@%###.            
:%#%%##*#*++*####%#*=             
..+%%%%%%%+-:..                    
  :=+==:                         
`)
    }