import cron from 'node-cron';
import { scrape as scrapeDevfolio } from '../scrapers/devfolio.js';
import { scrape as scrapeUnstop } from '../scrapers/unstop.js';
import { scrape as scrapeStartupIndia } from '../scrapers/startupIndia.js';
import { normalize } from '../pipeline/normalizer.js';
import { deduplicate } from '../pipeline/deduplicator.js';
import { tagOpportunities } from '../pipeline/aiTagger.js';
import Opportunity from '../models/Opportunity.js';
import { sendAlertDigest } from '../alerts/alertEngine.js';
import { logger } from '../utils/logger.js';

let isRunning = false;

/**
 * Full scrape → normalize → dedup → tag → save → alert pipeline.
 */
export async function runNow() {
  if (isRunning) {
    logger.warn('[Cron] Pipeline already running, skipping...');
    return { skipped: true };
  }

  isRunning = true;
  const startTime = Date.now();
  const stats = { devfolio: 0, unstop: 0, startupIndia: 0, total: 0, saved: 0 };

  try {
    logger.info('═══════════════════════════════════════════');
    logger.info('[Cron] Starting scrape pipeline...');

    // 1. Scrape all sources in parallel
    const [devfolioRaw, unstopRaw, startupIndiaRaw] = await Promise.allSettled([
      scrapeDevfolio(),
      scrapeUnstop(),
      scrapeStartupIndia(),
    ]);

    const devfolioData = devfolioRaw.status === 'fulfilled' ? devfolioRaw.value : [];
    const unstopData = unstopRaw.status === 'fulfilled' ? unstopRaw.value : [];
    const startupIndiaData = startupIndiaRaw.status === 'fulfilled' ? startupIndiaRaw.value : [];

    stats.devfolio = devfolioData.length;
    stats.unstop = unstopData.length;
    stats.startupIndia = startupIndiaData.length;

    if (devfolioRaw.status === 'rejected') logger.error(`[Cron] Devfolio failed: ${devfolioRaw.reason}`);
    if (unstopRaw.status === 'rejected') logger.error(`[Cron] Unstop failed: ${unstopRaw.reason}`);
    if (startupIndiaRaw.status === 'rejected') logger.error(`[Cron] StartupIndia failed: ${startupIndiaRaw.reason}`);

    const allRaw = [...devfolioData, ...unstopData, ...startupIndiaData];
    stats.total = allRaw.length;
    logger.info(`[Cron] Total scraped: ${allRaw.length} items (Devfolio: ${stats.devfolio}, Unstop: ${stats.unstop}, StartupIndia: ${stats.startupIndia})`);

    if (allRaw.length === 0) {
      logger.info('[Cron] No items scraped. Pipeline complete.');
      return stats;
    }

    // 2. Normalize
    const normalized = normalize(allRaw);

    // 3. Deduplicate
    const unique = await deduplicate(normalized);

    if (unique.length === 0) {
      logger.info('[Cron] No new items after dedup. Pipeline complete.');
      return stats;
    }

    // 4. AI Tag
    const tagged = await tagOpportunities(unique);

    // 5. Save to DB
    const saved = await Opportunity.insertMany(tagged, { ordered: false }).catch((err) => {
      if (err.code === 11000 && err.insertedDocs) return err.insertedDocs;
      logger.warn(`[Cron] Bulk insert partial failure: ${err.message}`);
      return [];
    });

    stats.saved = Array.isArray(saved) ? saved.length : 0;
    logger.info(`[Cron] Saved ${stats.saved} new opportunities to DB`);

    // 6. Send email alerts for new items
    if (stats.saved > 0) {
      await sendAlertDigest(tagged.slice(0, stats.saved)).catch((err) => {
        logger.error(`[Cron] Alert email failed: ${err.message}`);
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`[Cron] Pipeline complete in ${duration}s`);
    logger.info('═══════════════════════════════════════════');

    return stats;
  } catch (err) {
    logger.error(`[Cron] Pipeline error: ${err.message}`);
    throw err;
  } finally {
    isRunning = false;
  }
}

/**
 * Initialize cron scheduler.
 */
export function initCron() {
  const schedule = process.env.SCRAPE_CRON || '0 * * * *';

  if (!cron.validate(schedule)) {
    logger.error(`[Cron] Invalid cron expression: ${schedule}`);
    return;
  }

  cron.schedule(schedule, async () => {
    try {
      await runNow();
    } catch (err) {
      logger.error(`[Cron] Scheduled run failed: ${err.message}`);
    }
  });

  logger.info(`[Cron] Scheduler initialized — schedule: "${schedule}"`);
}
