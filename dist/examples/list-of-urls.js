"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const index_1 = require("../index");
(async () => {
    const scraper = new index_1.LinkedInProfileScraper({
        sessionCookieValue: `${process.env.LINKEDIN_SESSION_COOKIE_VALUE}`,
        keepAlive: true,
    });
    await scraper.setup();
    const [someuser, natfriedman, williamhgates] = await Promise.all([
        scraper.run("https://www.linkedin.com/in/someuser/"),
        scraper.run("https://www.linkedin.com/in/natfriedman/"),
        scraper.run("https://www.linkedin.com/in/williamhgates/"),
    ]);
    await scraper.close();
    console.log(someuser, natfriedman, williamhgates);
})();
//# sourceMappingURL=list-of-urls.js.map