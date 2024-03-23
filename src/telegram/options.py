import argparse

def initialize_options():

    parser = argparse.ArgumentParser("Scrape and scrape and scrape")

    parser.add_argument('-ao', '--AddOrigin', help = "Add a new origin to track", metavar='')

    # Read arguments from command line
    argv = parser.parse_args()

    return argv