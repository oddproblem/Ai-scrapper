import axios from 'axios';
import { logger } from '../utils/logger.js';
import { HEADERS, dedupeByUrl, sleep } from './utils.js';

const API_BASE = 'https://unstop.com/api/public/opportunity/search-new';

// Opportunity types to fetch from Unstop
const CATEGORIES = [
  { opportunity: 'hackathons', type: 'hackathon' },
  { opportunity: 'competitions', type: 'challenge' },
];

/**
 * Scrapes hackathons, competitions, and internships from Unstop
 * via their public JSON API.
 */
export async function scrape() {
  const results = [];

  try {
    logger.info('[Unstop] Starting API fetch...');

    for (const cat of CATEGORIES) {
      try {
        logger.info(`[Unstop] Fetching ${cat.opportunity}...`);

        const { data: res } = await axios.get(API_BASE, {
          params: {
            opportunity: cat.opportunity,
            per_page: 15,
            oppstatus: 'open',
          },
          headers: HEADERS,
          timeout: 15000,
        });

        const items = res?.data?.data || res?.data || [];

        for (const item of items) {
          try {
            // Strip HTML tags from description
            const rawDesc = (item.details || item.short_desc || '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&[a-z]+;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 500);

            const org = item.organisation || item.organization || {};
            const deadline = item.regnRequirements?.end_regn_dt
              || item.end_date
              || null;

            const region = (item.region || '').toLowerCase();
            let mode = '';
            if (/online|virtual|remote/i.test(region)) mode = 'remote';
            else if (/offline|on[\s-]?site/i.test(region)) mode = 'on-site';
            else if (/hybrid/i.test(region)) mode = 'hybrid';

            const prize = item.prizes?.length
              ? item.prizes.map(p => p.name || p.cash || '').filter(Boolean).join(', ')
              : '';

            results.push({
              title: (item.title || '').trim(),
              description: rawDesc,
              source: 'unstop',
              sourceUrl: `https://unstop.com/${item.public_url || ''}`,
              type: cat.type,
              deadline: deadline ? new Date(deadline) : null,
              location: item.city || item.region || '',
              mode,
              prize,
              organizer: org.name || 'Unstop',
              eligibility: item.eligibility || '',
            });
          } catch (_) {}
        }

        await sleep(1000);
      } catch (err) {
        logger.warn(`[Unstop] Failed to fetch ${cat.opportunity}: ${err.message}`);
      }
    }

    const unique = dedupeByUrl(results);
    logger.info(`[Unstop] Scraped ${unique.length} opportunities`);
    return unique;
  } catch (err) {
    logger.error(`[Unstop] Scraping failed: ${err.message}`);
    return [];
  }
}
