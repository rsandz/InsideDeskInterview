import { exit } from "process";
import puppeteer from "puppeteer";
import { SITE_URL, TIMEOUT } from "./constants.js";
import { Dentist } from "./models/dentist.js"

/**
 * Reloads the page if captcha detected
 * @param {puppeteer.Page} page The page to check
 */
async function catchpaWorkAround(page) {
    while ((await page.$(".high-traffic-captcha-container")) != null) {
        console.warn("Detected captcha. Waiting and realoading...");
        await page.reload();
        await sleep(TIMEOUT);
    }
}

/**
 * Make a page go to a url, but timeout before returning.
 * @param {puppeteer.Page} page The page to invoke goto on
 * @param {String} url The url to goto>
 */
async function throttledGoTo(page, url) {
        await page.goto(url);
        await sleep(TIMEOUT);
        await catchpaWorkAround(page);
}

/**
 * Pause execution for a certain amount of time.
 * @param {number} t Timeout
 */
function sleep(t) {
    return new Promise(resolve => setTimeout(resolve, t));
}

/**
 * Web Scraper for the ADA Dentist finder.
 */
export class FindADentistScraper {
    constructor(zipCode) {
        this.zipCode = zipCode;
        this.browser = null;
        this.page = null;

        this.result = [];
    }

    /**
     * Scrape the results of the provided zip code.
     */
    async scrape() {
        this.browser = await puppeteer.launch({"headless" : false});
        this.page = await this.browser.newPage();
        await throttledGoTo(this.page, SITE_URL);

        await this.enterZipCode();

        // Wait until loading list done
        await this.page.waitForSelector(".dentist-list__item a");

        console.log("Dentist list gotten");
        this.crawlDentistList();

        await this.page.screenshot({ path: 'example.png' });

        // await this.browser.close();
    }

    /**
     * Enters the zip code into the zip search box, accepts terms and 
     * clicks search.
     * Assumes on main landing page.
     */
    async enterZipCode() {
        // TODO: Add Specialty Filter Later
        var zipInputEl = await this.page.$("[title='Address or ZIP Code']");
        if (zipInputEl == null) {
            throw Error("Could not find Zip Code Input.");
        }

        var submitBtnEl = await this.page.$("button[type='submit']");
        if (submitBtnEl == null) {
            throw Error("Could not find submit button.")
        }

        // The website hides the checkbox so that we can't programatically click it.
        // Just click label instead.
        var acceptTermsBtnEl = await this.page.$("label[for='terms']");
        if (acceptTermsBtnEl == null) {
            throw Error("Could not find accept terms label.")
        }

        await zipInputEl.type(this.zipCode);

        // Scroll to the terms label
        await acceptTermsBtnEl.hover();

        // Need to click to the left of label so that we dont click the TOS link.
        var labelBox = await acceptTermsBtnEl.boundingBox();
        await this.page.mouse.click(
            labelBox.x + labelBox.width / 5,
            labelBox.y + labelBox.height / 2
        );

        await submitBtnEl.click()
        await sleep(TIMEOUT);
        await catchpaWorkAround(this.page);
    }

    /**
     * Crawl page for a zip code search result that provides a list of
     * dentists.
     */
    async crawlDentistList() {
        // The dentist links are in a h2 tag.
        // Note that other href links exist like phone number.
        // var dentistList = [await this.page.$(".dentist-list__item h2 > a")];
        var dentistList = await this.page.$$(".dentist-list__item h2 > a");
        var dentistLinksPromises = dentistList.map(item => item.getProperty("href"));
        
        // Crawl each dentist link synchronously
        for (let promise of dentistLinksPromises) {
            let  dentistLink = await (await promise).jsonValue();;
            try {
                await this.crawlDentist(dentistLink)
            }
            catch (err) {
                console.error("Could not crawl %s", dentistLink);
                console.error(err);
                continue; // No need to bail if something goes wrong for one.
            }
        }

        console.log(this.result);
    }

    /**
     * Crawl page for a specific dentist to extract their info.
     * Each link is crawled in a new page.
     * @param {String} link The url for a specific dentist.
     */
    async crawlDentist(link) {
        await throttledGoTo(this.page, link);
        const dentist = new Dentist();

        // Most of the fields are available via definition lists (dl).
        // With exception to name.
        dentist.name = await this.page.$eval("div.name > h1", el => el.textContent);

        // Get the dl lists that describe dentist, except for hours
        var dlList = await this.page.$$(
            "section.dentist-details :not(.dentist-details__open-hours) > dl");
        var dlMapPromises = [];

        for (let dl of dlList) {
            dlMapPromises.push(this.crawlDefinitionList(dl));
        }

        // Aggregate all values in dentist info prop.
        var dlMaps = await Promise.all(dlMapPromises);
        var mergedMaps = dlMaps.reduce(
            (prev, curr) => new Map([...prev, ...curr]), new Map());
        dentist.info = Object.fromEntries(mergedMaps);

        this.result.push(dentist);
    }

    /**
     * Parses a definition list into an array of maps
     * @param {puppeteer.ElementHandle} dl The element handle for definition list
     * @returns {Promise<Map<String, String>>} Map of info field and info data.
     */
    async crawlDefinitionList(dl) {
        var map = new Map();
        
        var dt = null;
        var dd = null;
        var index = 1; // We start at 1 index for CSS selectors

        // Parse through all dt and dd pairs until one becomes null.
        while (true) {
            dt = await dl.$(`dt:nth-of-type(${index})`);
            dd = await dl.$(`dd:nth-of-type(${index})`);

            if (dd != null && dt != null) {
                map.set(
                    (await dt.evaluate(e => e.textContent)).trim().toLowerCase(), 
                    await dd.evaluate(e => e.textContent)
                );
            }
            else {
                break;
            }

            index++; 
        }

        return map;
    }

}
