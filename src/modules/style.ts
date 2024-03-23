/**
 * @module style
 * @description Utility module to keep the import for style. Keeping style consistent among the other modules
 * @category misc
 */

import chalk from "chalk";


/**
 * @constant style
 *
 * @type {{ error: (msg: unknown) => any; sysinfo: (msg: string) => any; success: (msg: string) => any; info: (msg: string) => any; line: () => any; solidLine: () => any; data: (msg: string | number) => any; subprocess: (msg: string) => any; }}
 */
export const style = {
  error: (msg : string | null | undefined | unknown) => chalk.red("[!] " + msg),
  sysinfo: (msg : string | null | undefined) => chalk.magenta("[i] " + msg),
  success: (msg : string | null | undefined) => chalk.green("[!] " + msg),
  info: (msg : string | null | undefined) => chalk.blue("\t[+] " + msg),
  line: () => chalk.white('─'.repeat(process.stdout.columns)),
  solidLine: () => chalk.bgWhite('⠀'.repeat(process.stdout.columns) + '\n'),
  data: (msg : string | number | null | undefined) => chalk.yellow(msg),
  subprocess: (msg : string | null | undefined) => chalk.cyan("\n" + msg + "\n"),
};