import Opportunity from '../models/Opportunity.js';
import { compareTwoStrings } from 'string-similarity';
import { logger } from '../utils/logger.js';

const SIMILARITY_THRESHOLD = 0.85;

/**
 * Deduplicates opportunities against existing DB records.
 * Uses exact sourceUrl match + fuzzy title matching for cross-source dedup.
 * Returns only genuinely new opportunities.
 */
export async function deduplicate(normalizedItems) {
  if (!normalizedItems.length) return [];

  const newItems = [];
  const existingUrls = new Set();

  // Fetch all existing sourceUrls in one query
  const existing = await Opportunity.find({}, { sourceUrl: 1, title: 1 }).lean();
  for (const doc of existing) {
    existingUrls.add(doc.sourceUrl);
  }

  const existingTitles = existing.map((d) => d.title.toLowerCase());

  for (const item of normalizedItems) {
    // 1. Exact URL match
    if (existingUrls.has(item.sourceUrl)) {
      continue;
    }

    // 2. Fuzzy title match (cross-source dedup)
    const titleLower = item.title.toLowerCase();
    const isDuplicate = existingTitles.some(
      (t) => compareTwoStrings(titleLower, t) >= SIMILARITY_THRESHOLD
    );

    if (isDuplicate) {
      logger.debug(`[Dedup] Fuzzy duplicate skipped: "${item.title}"`);
      continue;
    }

    newItems.push(item);
    // Also add to in-memory sets so batch doesn't self-duplicate
    existingUrls.add(item.sourceUrl);
    existingTitles.push(titleLower);
  }

  logger.info(
    `[Dedup] ${newItems.length} new items (${normalizedItems.length - newItems.length} duplicates removed)`
  );
  return newItems;
}
