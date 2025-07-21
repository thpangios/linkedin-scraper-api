"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
require("dotenv").config();
const express_1 = tslib_1.__importDefault(require("express"));
const index_1 = require("../index");
const app = (0, express_1.default)();
(async () => {
    const scraper = new index_1.LinkedInProfileScraper({
        sessionCookieValue: `${process.env.LINKEDIN_SESSION_COOKIE_VALUE}`,
        keepAlive: true,
    });
    await scraper.setup();
    app.get("/", (req, res) => {
        res.json({
            status: "LinkedIn Scraper API is running! 🚀",
            usage: "Send GET to /scrape?profileUrl=https://www.linkedin.com/in/username"
        });
    });
    app.get("/scrape", async (req, res) => {
        const profileUrl = req.query.profileUrl;
        if (!profileUrl) {
            return res.status(400).json({ error: "Missing profileUrl parameter" });
        }
        try {
            const result = await scraper.run(profileUrl);
            return res.json(result);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    app.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () => {
        console.log("🚀 LinkedIn Scraper API running on port", process.env.PORT || 3000);
    });
})();
//# sourceMappingURL=server.js.map