import {FindADentistScraper} from "./webscraper.js"

// For Testing purposes
(async () => {
    let scraper = new FindADentistScraper("39901");
    scraper.scrape().catch(err => {
        console.log(err);
        exit(-1);
    });
})()