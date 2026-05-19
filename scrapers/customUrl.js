import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';
import { fetchPage, detectType } from './utils.js';

/**
 * Generic opportunity extractor for any given URL.
 * Tries multiple strategies to find structured data on the page.
 */
export async function scrapeUrl(url) {
  const results = [];

  try {
    logger.info(`[CustomScraper] Fetching ${url}...`);
    const html = await fetchPage(url, { timeout: 20000 });
    const $ = cheerio.load(html);

    // Remove noise
    $('script, style, nav, footer, header, .modal, .cookie-banner, [class*="cookie"], [class*="popup"]').remove();

    const baseUrl = new URL(url);
    const resolveUrl = (href) => {
      if (!href || href === '#' || href.startsWith('javascript:')) return '';
      try { return new URL(href, baseUrl.origin).href; } catch { return ''; }
    };

    // Strategy 1: Look for card-like elements
    const cardSelectors = [
      '[class*="card"]',
      '[class*="opportunity"]',
      '[class*="event"]',
      '[class*="hackathon"]',
      '[class*="program"]',
      '[class*="listing"]',
      '[class*="result"]',
      '[class*="item"]',
      'article',
    ];

    const cardEls = $(cardSelectors.join(', '));

    if (cardEls.length > 0) {
      cardEls.each((_, el) => {
        try {
          const $el = $(el);
          // Skip tiny elements (likely sub-components)
          if ($el.text().trim().length < 20) return;
          // Skip if nested inside another card
          if ($el.parents(cardSelectors.join(', ')).length > 0) return;

          const heading = $el.find('h1, h2, h3, h4, h5, a').first();
          const title = heading.text().trim();
          if (!title || title.length < 5 || title.length > 300) return;
          if (/menu|nav|footer|cookie|login|sign|close|modal/i.test(title)) return;

          const link = $el.find('a[href]').first().attr('href') || heading.attr('href') || '';
          const sourceUrl = resolveUrl(link) || url;

          const descParts = [];
          $el.find('p, [class*="desc"], [class*="summary"], [class*="content"]').each((_, p) => {
            const text = $(p).text().trim();
            if (text && text.length > 10 && text !== title) descParts.push(text);
          });
          const description = descParts.slice(0, 3).join(' | ').substring(0, 500);

          const allText = $el.text();

          // Extract deadline
          const deadlineMatch = allText.match(
            /(?:deadline|last date|apply by|closes?|ends?)\s*[:\-]?\s*(\d{1,2}[\s\/\-]\w{3,9}[\s\/\-]\d{2,4})/i
          ) || allText.match(
            /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})/i
          );

          // Extract funding/prize
          const fundingMatch = allText.match(
            /(?:₹|Rs\.?|INR|\$|€|£)\s?[\d,\.]+\s?(?:crore|lakh|lakhs|Cr|L|K|M|B)?/i
          );

          // Extract location
          const locationMatch = allText.match(
            /(?:location|venue|city|place)\s*[:\-]?\s*([A-Z][\w\s,]{3,40})/i
          );

          results.push({
            title,
            description,
            source: 'custom',
            sourceUrl,
            type: detectType(allText),
            location: locationMatch ? locationMatch[1].trim() : '',
            deadline: deadlineMatch ? deadlineMatch[1] : null,
            fundingAmount: fundingMatch ? fundingMatch[0] : '',
            organizer: extractDomain(url),
          });
        } catch (_) {}
      });
    }

    // Strategy 2: If no cards found, try table rows
    if (results.length === 0) {
      $('table tbody tr, table tr').each((_, el) => {
        try {
          const $tr = $(el);
          const cells = $tr.find('td');
          if (cells.length < 2) return;

          const title = cells.first().text().trim();
          if (!title || title.length < 5 || title.length > 300) return;
          if (/header|#|no\./i.test(title) && title.length < 10) return;

          const link = $tr.find('a[href]').first().attr('href') || '';
          const sourceUrl = resolveUrl(link) || url;

          const descParts = [];
          cells.each((i, td) => {
            if (i === 0) return;
            const text = $(td).text().trim();
            if (text && text.length > 5) descParts.push(text);
          });

          results.push({
            title,
            description: descParts.join(' | ').substring(0, 500),
            source: 'custom',
            sourceUrl,
            type: detectType($tr.text()),
            location: '',
            organizer: extractDomain(url),
          });
        } catch (_) {}
      });
    }

    // Strategy 3: Structured heading + content blocks
    if (results.length === 0) {
      $('h2, h3, h4').each((_, el) => {
        try {
          const $heading = $(el);
          const title = $heading.text().trim();
          if (!title || title.length < 5 || title.length > 300) return;
          if (/menu|nav|footer|cookie|login|contact|error|modal/i.test(title)) return;

          const $parent = $heading.parent();
          const link = $parent.find('a[href]').first().attr('href') || $heading.find('a').attr('href') || '';
          const sourceUrl = resolveUrl(link) || url;

          const descParts = [];
          $heading.nextAll('p, ul, ol').slice(0, 3).each((_, p) => {
            const text = $(p).text().trim();
            if (text && text.length > 15) descParts.push(text);
          });
          // Also check parent
          if (descParts.length === 0) {
            $parent.find('p').each((_, p) => {
              const text = $(p).text().trim();
              if (text && text.length > 15 && text !== title) descParts.push(text);
            });
          }

          results.push({
            title,
            description: descParts.slice(0, 3).join(' | ').substring(0, 500),
            source: 'custom',
            sourceUrl,
            type: detectType(`${title} ${descParts.join(' ')}`),
            location: '',
            organizer: extractDomain(url),
          });
        } catch (_) {}
      });
    }

    // Strategy 4: Last resort — meaningful links
    if (results.length === 0) {
      $('a[href]').each((_, el) => {
        try {
          const $a = $(el);
          const title = $a.text().trim();
          if (!title || title.length < 10 || title.length > 200) return;
          if (/menu|nav|home|login|back|contact|privacy|terms/i.test(title)) return;

          const href = $a.attr('href') || '';
          const sourceUrl = resolveUrl(href);
          if (!sourceUrl) return;

          const $parent = $a.parent();
          const desc = $parent.find('p, span').not($a).text().trim().substring(0, 300);

          results.push({
            title,
            description: desc,
            source: 'custom',
            sourceUrl,
            type: detectType(title),
            location: '',
            organizer: extractDomain(url),
          });
        } catch (_) {}
      });
    }

    // Deduplicate by URL
    const seen = new Set();
    const unique = results.filter(r => {
      if (!r.sourceUrl || seen.has(r.sourceUrl)) return false;
      seen.add(r.sourceUrl);
      return true;
    });

    logger.info(`[CustomScraper] Extracted ${unique.length} items from ${url}`);
    return unique.slice(0, 50); // cap at 50
  } catch (err) {
    logger.error(`[CustomScraper] Failed to scrape ${url}: ${err.message}`);
    throw new Error(`Failed to scrape: ${err.message}`);
  }
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}
