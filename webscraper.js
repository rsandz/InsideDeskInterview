import { exit } from "process";
import puppeteer from "puppeteer";
import { SITE_URL } from "./constants.js";
import { Dentist } from "./models/dentist.js"

/**
 * Reloads the page if captcha detected
 * @param {puppeteer.Page} page The page to check
 */
async function catchpaWorkAround(page) {
    while ((await page.$(".high-traffic-captcha-container")) != null) {
        await page.reload({waitUntil : "networkidle0"});
    }
}


/**
 * Web Scraper for the ADA Dentist finder.
 */
class FindADentistScraper {
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
        await this.page.goto(SITE_URL, { waitUntil : "networkidle0" });
        await catchpaWorkAround(this.page);

        await this.enterZipCode();
        await this.page.waitForNavigation({waitUntil : "networkidle0"});
        await catchpaWorkAround(this.page);

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
        
        // Crawl each dentist link asynchronously
        var dentistCrawlPromises = dentistLinksPromises.map(async promise => {
            let dentist_link = await (await promise).jsonValue();
            return this.crawlDentistLink(dentist_link);
        })

        await Promise.all(dentistCrawlPromises).catch(err => {
            console.log("Could not crawl a page:\n %s", err);
        }); // Wait till all dentists crawled

        console.log(this.result);
    }

    /**
     * Crawl page for a specific dentist to extract their info.
     * Each link is crawled in a new page.
     * @param {String} link The url for a specific dentist.
     */
    async crawlDentistLink(link) {
        const localPage = await this.browser.newPage();
        await localPage.goto(link, {
            waitUntil : "networkidle0"
        });
        await catchpaWorkAround(localPage);

        const localDentist = new Dentist();

        // Most of the fields are available via definition lists (dl).
        // With exception to name.
        localDentist.name = await localPage.$eval("div.name > h1", el => el.textContent);

        // Get the dt and dd fields

        await localPage.close();

        this.result.push(localDentist);
    }

}

// For Testing purposes
(async () => {
    let scraper = new FindADentistScraper("39901");
    scraper.scrape().catch(err => {
        console.log(err);
        exit(-1);
    });
})()