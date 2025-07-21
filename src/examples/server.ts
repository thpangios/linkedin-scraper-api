require("dotenv").config();
import express from "express";
import { LinkedInProfileScraper } from "../index";

const app = express();
const PORT = process.env.PORT || 3000;

let scraper: LinkedInProfileScraper | null = null;

// Async init of scraper
(async () => {
  scraper = new LinkedInProfileScraper({
    sessionCookieValue: `${process.env.LINKEDIN_SESSION_COOKIE_VALUE}`,
    keepAlive: false,
  });

  await scraper.setup();
  console.log("✅ Scraper initialized");
})();

// Default route to check server
app.get("/", async (req, res) => {
  if (!scraper) {
    return res.status(503).send("Scraper not ready yet.");
  }

  const urlToScrape = req.query.url as string;

  if (!urlToScrape) {
    return res.status(400).send("Missing ?url parameter.");
  }

  try {
    const result = await scraper.run(urlToScrape);
    res.json(result);
  } catch (err) {
    console.error("❌ Error during scraping:", err);
    res.status(500).send("Scraping failed.");
  }
});

// Start server right away
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
