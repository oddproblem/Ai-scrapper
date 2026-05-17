import puppeteer from 'puppeteer-core';
import { logger } from '../utils/logger.js';
import { findChrome, dedupeByUrl } from './utils.js';

/**
 * Scrapes hackathon listings from Devfolio.
 * Uses Puppeteer because Devfolio is a JS-rendered SPA.
 */
export async function scrape() {
  let browser;
  try {
    const chromePath = findChrome();
    if (!chromePath) {
      logger.warn('[Devfolio] Chrome not found. Set CHROME_PATH env var.');
      return [];
    }

    logger.info('[Devfolio] Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 900 });

    logger.info('[Devfolio] Navigating to hackathons page...');
    await page.goto('https://devfolio.co/hackathons', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await page.waitForSelector('a[href*="devfolio.co"]', { timeout: 15000 }).catch(() => {});

    // Scroll to load more cards
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Extract data — use innerText to preserve visual spacing
    const raw = await page.evaluate(() => {
      const cards = [];
      const links = document.querySelectorAll('a[href*=".devfolio.co"]');

      links.forEach((el) => {
        try {
          const href = el.href || '';
          if (!href || href === 'https://devfolio.co/' || href.includes('/projects')) return;

          // Get title from heading elements
          const heading = el.querySelector('h3, h2, h4');
          const title = heading ? heading.innerText.trim() : '';

          // Get description parts separately to avoid concatenation
          const paragraphs = el.querySelectorAll('p, span, div');
          const textParts = [];
          paragraphs.forEach((p) => {
            const t = p.innerText?.trim();
            if (t && t !== title && t.length > 2 && t.length < 200) {
              textParts.push(t);
            }
          });
          const description = textParts.join(' | ');

          // Extract specific data points
          const fullText = el.innerText || '';
          const dateMatch = fullText.match(
            /(\w{3,9}\s+\d{1,2}(?:,?\s*\d{4})?)\s*[-–]\s*(\w{3,9}\s+\d{1,2}(?:,?\s*\d{4})?)/i
          );
          const prizeMatch = fullText.match(/(?:₹|INR|\$|USD)\s?[\d,\.]+\s?(?:K|L|Cr|M)?/i);
          const isOnline = /online|virtual|remote/i.test(fullText);
          const isOffline = /offline|in[\s-]?person|on[\s-]?site/i.test(fullText);
          const participantsMatch = fullText.match(/(\d[\d,]*)\+?\s*participat/i);

          if (title && href) {
            cards.push({
              title,
              sourceUrl: href,
              description,
              deadline: dateMatch ? dateMatch[2]?.trim() : '',
              prize: prizeMatch ? prizeMatch[0] : '',
              mode: isOnline ? 'remote' : isOffline ? 'on-site' : '',
              participants: participantsMatch ? participantsMatch[1] : '',
            });
          }
        } catch (_) {}
      });
      return cards;
    });

    const opportunities = dedupeByUrl(raw).map((item) => ({
      title: item.title,
      description: item.description,
      source: 'devfolio',
      sourceUrl: item.sourceUrl,
      type: 'hackathon',
      deadline: item.deadline || null,
      prize: item.prize,
      mode: item.mode,
      organizer: 'Devfolio',
      location: item.mode === 'remote' ? 'Online' : '',
    }));

    logger.info(`[Devfolio] Scraped ${opportunities.length} hackathons`);
    return opportunities;
  } catch (err) {
    logger.error(`[Devfolio] Scraping failed: ${err.message}`);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}
