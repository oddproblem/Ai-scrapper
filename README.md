# Startup Aggregator

Scrapes startup opportunities (hackathons, grants, accelerators, programs) from multiple sources, cleans and deduplicates the data, tags them using Gemini AI, and shows everything in a React dashboard.

Built this as a full-stack project using Node/Express + MongoDB on the backend and React with Vite on the frontend.

## Sources

- **Devfolio** — scraped with Puppeteer (headless Chrome), pulls ~16 hackathons per run
- **Unstop** — uses their public API, pulls ~45 items (hackathons, competitions, internships)
- **Startup India** — parsed with Cheerio from multiple sub-pages, gets ~29 government schemes/programs

I originally tried scraping F6S too, but they have Reese84 anti-bot protection that blocks everything. Replaced it with Unstop which has an open API. More details on this and other scraping issues in [`PROJECT_RETROSPECTIVE.md`](./PROJECT_RETROSPECTIVE.md).

## How it works

```
Scrapers → Normalizer → Deduplicator → AI Tagger → MongoDB → REST API → React UI
```

1. Scrapers pull raw data from the 3 sources
2. Normalizer cleans up text (fixes concatenated words from DOM extraction, strips HTML, etc)
3. Deduplicator removes duplicates using URL matching and fuzzy title comparison (0.85 threshold)
4. AI tagger sends items to Gemini for sector/stage classification, falls back to keyword matching when rate limited
5. Everything gets stored in MongoDB and served through Express endpoints
6. React frontend shows a dashboard with filters, search, bookmarks, CSV export

## Setup

You need Node.js 18+, a MongoDB Atlas account, and Chrome installed (for the Puppeteer scraper).

```bash
git clone https://github.com/oddproblem/Ai-scrapper.git
cd Ai-scrapper

npm install
cd client && npm install && cd ..

cp .env.example .env
# fill in your keys - see .env.example for what's needed
```

Main env variables you need to set:
- `MONGODB_URI` — MongoDB connection string
- `GEMINI_API_KEY` — for AI tagging (optional, keyword fallback works without it)
- `SMTP_USER` / `SMTP_PASS` — for email alerts, uses Gmail app passwords
- Google OAuth keys are optional, there's a dev mode that bypasses auth

### Running locally

```bash
# backend (port 5000)
npm run dev

# frontend (port 5173) — separate terminal
npm run client:dev
```

## API endpoints

- `GET /api/opportunities` — paginated list with filters and search
- `GET /api/opportunities/stats` — aggregate stats for the dashboard
- `GET /api/opportunities/export/csv` — download as CSV
- `POST /api/opportunities/scrape` — manually trigger the scrape pipeline
- `POST /api/opportunities/scrape-url` — scrape a specific URL
- `GET /api/health` — health check

## Scraping challenges

See [`PROJECT_RETROSPECTIVE.md`](./PROJECT_RETROSPECTIVE.md) for the full writeup. The short version:

- F6S has anti-bot protection (Reese84) — had to drop it entirely
- Startup India pages return 404 intermittently — handled with graceful fallbacks
- Devfolio's DOM produces concatenated text — built a normalizer with camelCase splitting
- Gemini free tier rate limits at ~15 req/min — keyword fallback tagger handles the overflow

## Tech used

Express, MongoDB, Mongoose, Puppeteer, Cheerio, Google Gemini API, node-cron, Nodemailer, Passport (Google OAuth), React 18, Vite, Winston logger
