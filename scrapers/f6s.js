import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';
import { fetchPage, dedupeByUrl, detectType, sleep } from './utils.js';

const BASE = 'https://www.f6s.com';

/**
 * Scrapes startup programs/accelerators from F6S.
 */
export async function scrape() {
  const results = [];

  try {
    logger.info('[F6S] Fetching programs...');

    // Try multiple listing pages
    const urls = [
      `${BASE}/programs`,
      `${BASE}/programs?type=accelerator`,
      `${BASE}/programs?type=incubator`,
    ];

    for (const url of urls) {
      try {
        logger.info(`[F6S] Fetching ${url}...`);
        const html = await fetchPage(url);
        const $ = cheerio.load(html);

        // F6S uses various card layouts — try multiple selectors
        $('a[href*="/programs/"], a[href*="/apply/"], .card, article, [class*="result"], [class*="listing"], [class*="program"], li').each(
          (_, el) => {
            try {
              const $el = $(el);
              const rawTitle =
                $el.find('h2, h3, h4').first().text().trim() ||
                $el.find('a').first().text().trim() ||
                $el.text().trim().split('\n')[0]?.trim();

              if (!rawTitle || rawTitle.length < 3 || rawTitle.length > 200) return;

              const link =
                $el.attr('href') || $el.find('a').first().attr('href') || '';
              if (!link || link === '#' || link === '/') return;

              const fullUrl = link.startsWith('http') ? link : `${BASE}${link}`;
              const desc = $el.find('p, [class*="desc"]').first().text().trim();
              const allText = $el.text();

              const fundingMatch = allText.match(
                /(?:€|\$|£|₹)\s?[\d,\.]+(?:\s?[KMB])?/i
              );
              const equityMatch = allText.match(/(\d+(?:\.\d+)?)\s*%/i);

              results.push({
                title: rawTitle.substring(0, 200),
                description: desc.substring(0, 500),
                source: 'f6s',
                sourceUrl: fullUrl,
                type: detectType(allText),
                location: '',
                fundingAmount: fundingMatch ? fundingMatch[0] : '',
                equity: equityMatch ? `${equityMatch[1]}%` : '',
                organizer: 'F6S',
              });
            } catch (_) {}
          }
        );

        await sleep(2000);
      } catch (err) {
        logger.warn(`[F6S] Failed to fetch ${url}: ${err.message}`);
      }
    }

    const unique = dedupeByUrl(results);
    logger.info(`[F6S] Scraped ${unique.length} programs`);
    return unique;
  } catch (err) {
    logger.error(`[F6S] Scraping failed: ${err.message}`);
    return [];
  }
}
