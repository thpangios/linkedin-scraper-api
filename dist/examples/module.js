"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const index_1 = require("../index");
(async () => {
    const scraper = new index_1.LinkedInProfileScraper({
        sessionCookieValue: `${process.env.LINKEDIN_SESSION_COOKIE_VALUE}`,
        keepAlive: false,
    });
    await scraper.setup();
    const result = await scraper.run("https://www.linkedin.com/in/someuser/");
    console.log(result);
})();
//# sourceMappingURL=module.js.map