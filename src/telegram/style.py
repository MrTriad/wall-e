from colorama import Fore, Back, Style
import os


class LogStyle:
    def error(self, msg): return (Fore.RED + f"[!] {msg}" + Fore.RESET) 
    def sysinfo(self, msg): return (Fore.MAGENTA + f"[i] {msg}" + Fore.RESET)
    def success(self, msg): return (Fore.GREEN + f"[!] {msg}" + Fore.RESET)
    def info(self, msg): return (Fore.BLUE + f"\t[+] {msg}" + Fore.RESET)
    def line(self): return ('─' * os.get_terminal_size().columns)
    def solidLine(self): return (Back.WHITE + '⠀' * os.get_terminal_size().columns + '\n' + Back.RESET)
    def data(self, msg): return (Fore.YELLOW + str(msg) + Fore.RESET)
    def subprocess(self, msg): return (Fore.CYAN + '\n' + str(msg) + Fore.RESET)

style = LogStyle()

