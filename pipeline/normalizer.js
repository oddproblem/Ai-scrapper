import { logger } from '../utils/logger.js';

/**
 * Normalizes raw scraped data into a consistent format matching the Opportunity schema.
 */
export function normalize(rawItems) {
  const normalized = [];

  for (const item of rawItems) {
    try {
      const opp = {
        title: cleanText(item.title),
        description: cleanDescription(item.description || ''),
        source: item.source,
        sourceUrl: cleanUrl(item.sourceUrl),
        type: normalizeType(item.type),
        deadline: parseDate(item.deadline),
        location: cleanText(item.location || ''),
        mode: normalizeMode(item.mode || '', item.location || '', item.description || ''),
        tags: item.tags || [],
        sector: item.sector || [],
        stage: item.stage || [],
        fundingAmount: cleanText(item.fundingAmount || ''),
        equity: cleanText(item.equity || ''),
        isActive: true,
        organizer: cleanText(item.organizer || ''),
        prize: cleanText(item.prize || ''),
        eligibility: cleanText(item.eligibility || ''),
        scrapedAt: new Date(),
      };

      if (opp.title && opp.sourceUrl) {
        normalized.push(opp);
      }
    } catch (err) {
      logger.warn(`[Normalizer] Failed to normalize item: ${err.message}`);
    }
  }

  logger.info(`[Normalizer] Normalized ${normalized.length}/${rawItems.length} items`);
  return normalized;
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cleans description text — fixes concatenated words from bad scraping.
 */
function cleanDescription(text) {
  if (!text) return '';
  let cleaned = text;

  // Fix common concatenation patterns:
  // "2026HackathonTheme" → "2026 Hackathon Theme"
  cleaned = cleaned.replace(/(\d)([A-Z])/g, '$1 $2');
  // "hackathonTheme" → "hackathon Theme"
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
  // "ThemeNo" is fine, but "Restrictions+250" → "Restrictions +250"
  cleaned = cleaned.replace(/([a-zA-Z])(\+\d)/g, '$1 $2');
  // "participatingOffline" → "participating Offline"
  cleaned = cleaned.replace(/(ing|ed|tion|ment|ness)([A-Z])/g, '$1 $2');
  // "OpenStarts" → "Open Starts"
  cleaned = cleaned.replace(/([a-z]{2,})(Starts?|Open|Close|Apply|Submit|Register|Join|View)/g, '$1 $2');

  // Remove "Apply now" artifacts at end
  cleaned = cleaned.replace(/\s*Apply\s*now\s*$/i, '');

  return cleanText(cleaned);
}

function cleanUrl(url) {
  if (!url) return '';
  try {
    return new URL(url).href;
  } catch {
    return url.trim();
  }
}

function normalizeType(type) {
  if (!type) return 'other';
  const map = {
    hackathon: 'hackathon', hack: 'hackathon',
    accelerator: 'accelerator', incubator: 'incubator',
    grant: 'grant', funding: 'grant',
    challenge: 'challenge', competition: 'challenge',
    program: 'program', programme: 'program', scheme: 'program',
    conference: 'conference', summit: 'conference',
  };
  return map[type.toLowerCase().trim()] || 'other';
}

function normalizeMode(mode, location, description) {
  const combined = `${mode} ${location} ${description}`.toLowerCase();
  if (/hybrid/i.test(combined)) return 'hybrid';
  if (/remote|online|virtual/i.test(combined)) return 'remote';
  if (/on[\s-]?site|offline|in[\s-]?person/i.test(combined)) return 'on-site';
  return '';
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;

  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2020) return parsed;
  } catch {}

  // DD-MMM-YYYY or DD/MM/YYYY patterns
  const m1 = dateStr.match(/(\d{1,2})[\/\-\s](\w{3,9})[\/\-\s](\d{2,4})/);
  if (m1) {
    try {
      const d = new Date(`${m1[2]} ${m1[1]}, ${m1[3]}`);
      if (!isNaN(d.getTime())) return d;
    } catch {}
  }

  return null;
}
