require("dotenv").config();

import express from "express";
import { LinkedInProfileScraper } from "../index";

const app = express();

(async () => {
  // Setup environment variables to fill the sessionCookieValue
  const scraper = new LinkedInProfileScraper({
    sessionCookieValue: `${process.env.LINKEDIN_SESSION_COOKIE_VALUE}`,
    keepAlive: false,
  });

  // Prepare the scraper
  // Loading it in memory
  await scraper.setup();

  // Usage: http://localhost:3000/?url=https://www.linkedin.com/in/someuser/
  app.get("/", async (req, res) => {
    const urlToScrape = req.query.url as string;

    const result = await scraper.run(urlToScrape);

    return res.json(result);
  });

 app.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () => {
  console.log("🚀 LinkedIn Scraper API running on port", process.env.PORT || 3000);
});
})(); // ← This closes the (async () => { function
