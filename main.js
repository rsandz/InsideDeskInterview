import {Command} from "commander";
import {FindADentistScraper} from "./webscraper.js";
import * as fs from "fs";
import { exit } from "process";
import puppeteer from "puppeteer";


// Paser cmd line options
const program = new Command();
program
    .option("-f, --file <path>", "Input file", "zipcodes.json")
    .option("-s, --specialty <spec>", "Specialty Filter", "General Practice");

program.parse(process.argv);
const opts = program.opts();

// Input read
try {
    const input = fs.readFileSync(opts.file);
    var inputJSON = JSON.parse(input);
} catch (error) {
    console.error("Could not read input file.");
    console.error(error);
    exit(-1);
}

if (inputJSON.zipcodes == null) {
    console.error("Malformed input file is missing zipcodes.");
    exit(-1);
}

const zipcodes = inputJSON.zipcodes;

// Launch Async crawler
(async () => {
    const browser = await puppeteer.launch({"headless" : false});
    var scraper = null;

    // Crawl each zipcode
    for (let zipcode of zipcodes) {
        console.log(`Crawling ${zipcode}.`);
        scraper = new FindADentistScraper(zipcode, browser, opts.specialty);
        const dentistObjs = await scraper.scrape().catch(err => {
            console.error("Error while scraping zipcode %s", zipcode);
            console.error(err);
            exit(-1);
        });

        console.log(`Done crawling ${zipcode}.`);

        // Write each zip code result to a different JSON file.
        const objs = dentistObjs.map(dentist => dentist.toJSON());
        fs.writeFileSync(`${zipcode}.json`, JSON.stringify(objs));
    }

    browser.close();

})()