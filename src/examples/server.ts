require("dotenv").config();
import express from "express";
import { LinkedInProfileScraper } from "../index";
const app = express();
(async () => {
  const scraper = new LinkedInProfileScraper({
    sessionCookieValue: `${process.env.LINKEDIN_SESSION_COOKIE_VALUE}`,
    keepAlive: true,
  });
  await scraper.setup();
  
  // Health check route
  app.get("/", (req, res) => {
    res.json({ 
      status: "LinkedIn Scraper API is running! 🚀",
      usage: "Send GET to /scrape?profileUrl=https://www.linkedin.com/in/username"
    });
  });
  
  // Scraping route
  app.get("/scrape", async (req, res) => {
    const profileUrl = req.query.profileUrl as string;
    
    if (!profileUrl) {
      return res.status(400).json({ error: "Missing profileUrl parameter" });
    }
    
    try {
      const result = await scraper.run(profileUrl);
      return res.json(result);
    } catch (error: unknown) {
      return res.status(500).json({ error: (error as Error).message });
    }
  });
  
  app.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () => {
    console.log("🚀 LinkedIn Scraper API running on port", process.env.PORT || 3000);
  });
})();
