# Project Retrospective — Startup Aggregator

Log of problems I ran into while building this, what caused them, and how I fixed them.

---

## Overview

The goal was to build a platform that pulls startup opportunities (hackathons, grants, accelerators) from multiple websites, tags them using AI, and shows them in a filterable dashboard.

Stack: Node.js (Express), MongoDB, React (Vite), Puppeteer, Cheerio, Gemini API

Final sources: Devfolio, Unstop, Startup India

---

## Scraping Issues

### F6S was completely blocked

F6S uses Reese84 anti-bot protection (JavaScript challenge/fingerprinting). Every approach I tried returned `405 Method Not Allowed` — basic HTTP requests, Cheerio with custom headers, even Puppeteer with user-agent spoofing. Nothing got through.

**Fix:** Dropped F6S entirely and replaced it with Unstop. Unstop has a public API endpoint (`/api/public/opportunity/search-new`) that returns clean JSON with no auth required. Way more reliable than trying to fight anti-bot systems.

**Takeaway:** Should have checked for public APIs before writing HTML scrapers.

### Startup India endpoints kept breaking

The original scraper tried to hit a single API endpoint on Startup India's site, but it returned 404. Turns out they restructured from API-driven to mostly static HTML pages.

**Fix:** Rewrote the scraper to crawl 4 different sub-pages using Cheerio:
- `/content/sih/en/government-schemes.html`
- `/content/sih/en/government-schemes/women_entrepreneurship.html`
- `/content/sih/en/international.html`
- `/content/sih/en/ams-application/startup-india-showcase.html`

Some of these (especially women_entrepreneurship and showcase) return 404 intermittently, so the scraper handles those gracefully instead of crashing.

### Devfolio text came out garbled

Scraped descriptions looked like "buildInnovativesolutions" — words mashed together with no spaces. This happens because Puppeteer's `textContent` concatenates text from sibling DOM nodes without whitespace between them.

**Fix:** Changed extraction to grab each `<p>` tag separately and join with ` | `. Also built a shared normalizer (`pipeline/normalizer.js`) that runs regex patterns to:
- Split camelCase: `([a-z])([A-Z])` → `$1 $2`
- Split digit-to-uppercase: `(\d)([A-Z])` → `$1 $2`
- Collapse multiple spaces

### Unstop items were silently dropped

After adding Unstop, the pipeline said "91 scraped, 86 after dedup" but only 45 ended up in the database. No errors in the logs.

**Root cause:** The Mongoose model for `source` had an enum restricted to `['devfolio', 'f6s', 'startupIndia']`. Items with `source: 'unstop'` failed MongoDB validation silently inside `insertMany({ ordered: false })`.

**Fix:** Added `'unstop'` to the enum. Easy fix, but hard to find since there were no error messages.

---

## Pipeline Issues

### Gemini API rate limiting

The free tier of Gemini has pretty aggressive rate limits (~15 requests/minute, ~1500/day). Most items would hit 429 errors during tagging.

**Fix:** Built a fallback system:
1. Try Gemini API first with a structured JSON prompt
2. If it returns 429, fall back to keyword-based tagging
3. Keyword tagger scans title + description for patterns like "AI", "fintech", "blockchain", etc.
4. Every item gets tagged one way or another — nothing is left untagged

### Cross-source duplicates

Same hackathon showing up from both Devfolio and Unstop with different URLs but basically the same title.

**Fix:** Two-pass dedup in `deduplicator.js`:
1. Exact URL match (fast Set lookup)
2. Fuzzy title match using `string-similarity` library with 0.85 threshold
3. Also tracks in-memory to prevent intra-batch duplicates

Usually catches 5-10 cross-source duplicates per run.

### insertMany partial failures

`insertMany` would throw an error but some documents actually got saved. This happened because `sourceUrl` has a unique index, and duplicate URLs in the batch cause a partial failure.

**Fix:** Used `{ ordered: false }` and caught the error to extract `err.insertedDocs`. The catch block checks for error code 11000 (duplicate key) and returns whatever did get inserted.

---

## Frontend Issues

### Emoji-heavy UI

The first version had emojis everywhere — sidebar nav, status indicators, filter buttons. It looked really unprofessional.

**Fix:** Replaced all emojis with inline SVG icons. Sidebar navigation, stats cards, card metadata, filter bar — everything now uses proper SVGs that look consistent across platforms.

### Sidebar navigation didn't work

Clicking sidebar items did nothing — no page switching, no highlighting.

**Root cause:** Missing `onClick` handlers and no `activePage` state in `App.jsx`.

**Fix:** Added `activePage` state management with `handleNavigate()`. Each sidebar button triggers `onNavigate(pageId)` and gets highlighted with a CSS class when active.

### CSV export button didn't download

The export button triggered a fetch but nothing downloaded in the browser.

**Root cause:** `fetch()` returns data as a response object, it doesn't trigger a browser download.

**Fix:** Used the blob download trick:
1. Fetch the CSV endpoint
2. Convert to `blob()`
3. Create `URL.createObjectURL(blob)`
4. Make a temporary `<a>` element with `download` attribute
5. Click it programmatically, then clean up

---

## Features Added Along the Way

**Save/Bookmark:** localStorage-based. Each card has a bookmark toggle, saved count shows in sidebar badge. Trade-off: device-specific, not synced across accounts, but doesn't require auth.

**Alert Settings:** Form page where you can configure email notifications — keywords, source filters, type filters, frequency (real-time/daily/weekly). Backend sends digests via Nodemailer SMTP.

**Dashboard vs Browse:** Dashboard shows stats cards + 9 recent items. Browse All shows full paginated list (18/page) with filters. Different views for different use cases.

**Custom URL Scraper:** Paste any URL and the system tries to extract opportunity data from it. Uses Puppeteer to render the page and pulls structured data.

---

## Current Numbers

Typical scrape run:
- Total scraped: ~91 items
- After dedup: ~86 unique
- Breakdown: Devfolio 16, Unstop 45, Startup India 29
- Pipeline time: ~80 seconds

---

## Known Issues

1. **Gemini rate limits** — Most items get keyword-based tags instead of AI-generated ones on the free tier. Would need to upgrade for consistent AI tagging.

2. **Startup India 404s** — Two of the four sub-paths frequently return 404. Scraper handles it gracefully but gets fewer results from those sections.

3. **Client-side persistence** — Saved items and alert settings both use localStorage. Not synced across devices. Would need a user collection in MongoDB to fix this.

4. **No auth in dev mode** — When Google OAuth keys aren't configured, there's a "Continue as Developer" bypass. Fine for development, needs to be removed for production.

5. **Chrome dependency** — Devfolio scraper needs Chrome installed. If Chrome isn't found, Devfolio scraping fails (other scrapers still work fine).
