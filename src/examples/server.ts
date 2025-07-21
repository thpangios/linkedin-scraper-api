// src/examples/server.ts

import "dotenv/config";
import express, { Request, Response } from "express";
import { LinkedInProfileScraper } from "../index";

const app = express();

// Parse PORT as a number
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = "0.0.0.0";

let scraper: LinkedInProfileScraper | null = null;

// 1) Kick off scraper setup in the background
(async () => {
  try {
    scraper = new LinkedInProfileScraper({
      sessionCookieValue: process.env.LINKEDIN_SESSION_COOKIE_VALUE!,
      keepAlive: false,
    });
    await scraper.setup();
    console.log("✅ Scraper initialized");
  } catch (err) {
    console.error("❌ Failed to initialize scraper:", err);
    process.exit(1); // fatal
  }
})();

// 2) Health-check / basic root route
app.get("/", (_req: Request, res: Response) => {
  res.send("⚡️ LinkedIn Scraper API is up. Use /scrape?url=…");
});

// 3) Scrape endpoint
app.get("/scrape", async (req: Request, res: Response) => {
  if (!scraper) {
    return res.status(503).send({ error: "Scraper is not ready yet" });
  }

  const urlToScrape = req.query.url;
  if (typeof urlToScrape !== "string" || !urlToScrape.startsWith("http")) {
    return res
      .status(400)
      .send({ error: "Missing or invalid `?url` query parameter" });
  }

  try {
    const result = await scraper.run(urlToScrape);
    return res.json(result);
  } catch (err: any) {
    console.error("❌ Error during scraping:", err);
    return res.status(500).send({ error: "Scraping failed", details: err.message });
  }
});

// 4) Start listening immediately
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server listening at http://${HOST}:${PORT}`);
});
