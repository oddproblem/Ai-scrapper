import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';
import { fetchPage, dedupeByUrl, detectType, sleep } from './utils.js';

const BASE = 'https://www.startupindia.gov.in';

/**
 * Fetches a detail page and extracts the main body description.
 * Used to enrich bridge/scheme items with real content.
 */
async function fetchDetailDescription(url) {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, .modal, .cookie-banner').remove();

    // Try specific content containers first
    const contentSelectors = [
      '.static-content-section',
      '.content-set',
      '[class*="detail-content"]',
      '[class*="page-content"]',
      'article',
      '.section',
      'main',
    ];

    let description = '';
    for (const sel of contentSelectors) {
      const container = $(sel).first();
      if (container.length) {
        const parts = [];
        container.find('p').each((_, p) => {
          const text = $(p).text().trim();
          if (text && text.length > 20 && !/login|register|cookie|privacy/i.test(text)) {
            parts.push(text);
          }
        });
        if (parts.length > 0) {
          description = parts.slice(0, 4).join(' | ');
          break;
        }
      }
    }

    // Fallback: grab all <p> in body
    if (!description) {
      const parts = [];
      $('body p').each((_, p) => {
        const text = $(p).text().trim();
        if (text && text.length > 30 && !/login|register|cookie|privacy|error|logout/i.test(text)) {
          parts.push(text);
        }
      });
      description = parts.slice(0, 3).join(' | ');
    }

    return description.substring(0, 600);
  } catch (err) {
    logger.debug(`[StartupIndia] Failed to fetch detail: ${err.message}`);
    return '';
  }
}

/**
 * Scrapes the International Bridges page.
 * Structure: .countries-list ul li a  — each has an img + p caption + href to detail page.
 */
async function scrapeInternational() {
  const results = [];
  try {
    const url = `${BASE}/content/sih/en/international.html`;
    logger.info('[StartupIndia] Fetching international bridges page...');
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    // Bridge country links
    $('.countries-list li a').each((_, el) => {
      try {
        const $a = $(el);
        const href = $a.attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : `${BASE}${href}`;
        const caption = $a.find('p').text().trim();
        const title = caption
          .replace(/\s+/g, ' ')
          .replace(/<br\s*\/?>/gi, ' ')
          .trim();

        if (!title || title.length < 5) return;

        results.push({
          title,
          description: '', // will be enriched below
          source: 'startupIndia',
          sourceUrl: fullUrl,
          type: 'program',
          location: 'India',
          organizer: 'Government of India',
          _needsDetail: true,
        });
      } catch (_) {}
    });

    // Also pick up multilateral links (SCO, BRICS, G20)
    $('h3, h4').each((_, el) => {
      try {
        const $heading = $(el);
        const headingText = $heading.text().trim();
        if (/multilateral|SCO|BRICS|startup.?20|G20/i.test(headingText)) {
          const $parent = $heading.parent();
          const link = $parent.find('a[href]').first().attr('href');
          const desc = $parent.find('p').first().text().trim();

          if (headingText.length > 3 && headingText.length < 200) {
            results.push({
              title: headingText,
              description: desc.substring(0, 500),
              source: 'startupIndia',
              sourceUrl: link ? (link.startsWith('http') ? link : `${BASE}${link}`) : url,
              type: 'program',
              location: 'India',
              organizer: 'Government of India',
            });
          }
        }
      } catch (_) {}
    });

    // Delegation visits content
    $('h3, h4').each((_, el) => {
      try {
        const $heading = $(el);
        const text = $heading.text().trim();
        if (/delegation|program|connect|launch|mentorship/i.test(text) && text.length > 10 && text.length < 200) {
          const $parent = $heading.parent();
          const desc = $parent.find('p').text().trim();
          if (!desc || desc.length < 20) return;
          // Skip nav/modal/generic headings
          if (/login|register|logout|error|cookie|contact/i.test(text)) return;

          results.push({
            title: text,
            description: desc.substring(0, 500),
            source: 'startupIndia',
            sourceUrl: url,
            type: 'program',
            location: 'India',
            organizer: 'Government of India',
          });
        }
      } catch (_) {}
    });

    logger.info(`[StartupIndia] Found ${results.length} international items`);
  } catch (err) {
    logger.warn(`[StartupIndia] International page failed: ${err.message}`);
  }
  return results;
}

/**
 * Scrapes the Government Schemes page.
 * Structure: .goverment-scheme blocks (note: their typo) with tab-based sections.
 */
async function scrapeSchemes() {
  const results = [];
  try {
    const url = `${BASE}/content/sih/en/government-schemes.html`;
    logger.info('[StartupIndia] Fetching government schemes page...');
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    $('script, style').remove();

    // Primary: .goverment-scheme blocks
    $('.goverment-scheme').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, a, strong').first().text().trim();
        if (!title || title.length < 5 || title.length > 300) return;
        if (/login|register|error|cookie|logout/i.test(title)) return;

        const descParts = [];
        $el.find('p, li').each((_, p) => {
          const t = $(p).text().trim();
          if (t && t.length > 15 && t !== title) descParts.push(t);
        });
        const description = descParts.slice(0, 3).join(' | ').substring(0, 500);

        const link = $el.find('a[href]').first().attr('href') || '';
        const fullUrl = link ? (link.startsWith('http') ? link : `${BASE}${link}`) : url;

        const allText = $el.text();
        const fundingMatch = allText.match(
          /(?:₹|Rs\.?|INR)\s?[\d,\.]+\s?(?:crore|lakh|lakhs|Cr|L)?/i
        );

        results.push({
          title,
          description,
          source: 'startupIndia',
          sourceUrl: fullUrl,
          type: detectType(allText),
          location: 'India',
          fundingAmount: fundingMatch ? fundingMatch[0] : '',
          organizer: 'Government of India',
          _needsDetail: !description && link,
        });
      } catch (_) {}
    });

    // Tab content sections (ministry/department schemes)
    $('.tab-content .tab-pane, .ministryDepartments-content').each((_, el) => {
      try {
        const $el = $(el);
        $el.find('a[href*="content/sih"], a[href*="scheme"]').each((_, a) => {
          const $a = $(a);
          const title = $a.text().trim();
          if (!title || title.length < 8 || title.length > 200) return;
          if (/menu|nav|login|home|back|contact/i.test(title)) return;

          const href = $a.attr('href') || '';
          const fullUrl = href.startsWith('http') ? href : `${BASE}${href}`;

          // Get context from parent row/li
          const $parent = $a.closest('li, tr, div');
          const desc = $parent.find('p, td:nth-child(2)').text().trim().substring(0, 300);

          results.push({
            title,
            description: desc,
            source: 'startupIndia',
            sourceUrl: fullUrl,
            type: 'program',
            location: 'India',
            organizer: 'Government of India',
            _needsDetail: !desc,
          });
        });
      } catch (_) {}
    });

    // Fallback: general meaningful links not yet captured
    $('a[href*="/content/sih/"], a[href*="/scheme"]').each((_, el) => {
      try {
        const $a = $(el);
        const title = $a.text().trim();
        if (!title || title.length < 10 || title.length > 200) return;
        if (/menu|nav|home|back|login|contact|read more|know more|click here/i.test(title)) return;

        const href = $a.attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : `${BASE}${href}`;

        // Check if we already have this URL
        if (results.some(r => r.sourceUrl === fullUrl)) return;

        results.push({
          title,
          description: '',
          source: 'startupIndia',
          sourceUrl: fullUrl,
          type: 'program',
          location: 'India',
          organizer: 'Government of India',
          _needsDetail: true,
        });
      } catch (_) {}
    });

    logger.info(`[StartupIndia] Found ${results.length} scheme items`);
  } catch (err) {
    logger.warn(`[StartupIndia] Schemes page failed: ${err.message}`);
  }
  return results;
}

/**
 * Main scrape function — combines international + schemes,
 * then enriches items that need detail-page descriptions.
 */
export async function scrape() {
  try {
    logger.info('[StartupIndia] Starting scrape...');

    const [international, schemes] = await Promise.all([
      scrapeInternational(),
      scrapeSchemes(),
    ]);

    const all = [...international, ...schemes];
    const unique = dedupeByUrl(all);

    // Enrich items missing descriptions by following their detail links
    const needsDetail = unique.filter(item => item._needsDetail && item.sourceUrl);
    logger.info(`[StartupIndia] Enriching ${needsDetail.length} items with detail pages...`);

    // Process in batches of 3 to avoid overloading
    for (let i = 0; i < needsDetail.length; i += 3) {
      const batch = needsDetail.slice(i, i + 3);
      const descriptions = await Promise.all(
        batch.map(item => fetchDetailDescription(item.sourceUrl))
      );
      batch.forEach((item, idx) => {
        if (descriptions[idx]) {
          item.description = descriptions[idx];
        }
      });
      if (i + 3 < needsDetail.length) await sleep(1000);
    }

    // Clean up internal flags
    unique.forEach(item => delete item._needsDetail);

    logger.info(`[StartupIndia] Scraped ${unique.length} opportunities`);
    return unique;
  } catch (err) {
    logger.error(`[StartupIndia] Scraping failed: ${err.message}`);
    return [];
  }
}
