import { Router } from 'express';
import Opportunity from '../models/Opportunity.js';
import { runNow } from '../scheduler/cron.js';
import { ensureAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { scrapeUrl } from '../scrapers/customUrl.js';
import { normalize } from '../pipeline/normalizer.js';

const router = Router();

/** Build a filter object from query params */
function buildFilter(query) {
  const filter = {};
  if (query.source) filter.source = { $in: query.source.split(',') };
  if (query.type) filter.type = { $in: query.type.split(',') };
  if (query.sector) filter.sector = { $in: query.sector.split(',') };
  if (query.stage) filter.stage = { $in: query.stage.split(',') };
  if (query.mode) filter.mode = query.mode;
  if (query.active !== undefined) filter.isActive = query.active === 'true';
  if (query.search) filter.$text = { $search: query.search };

  // Deadline filter
  if (query.deadline) {
    const now = new Date();
    if (query.deadline === 'week') {
      filter.deadline = { $gte: now, $lte: new Date(now.getTime() + 7 * 864e5) };
    } else if (query.deadline === 'month') {
      filter.deadline = { $gte: now, $lte: new Date(now.getTime() + 30 * 864e5) };
    } else if (query.deadline === 'expired') {
      filter.deadline = { $lt: now };
    }
  }

  return filter;
}

/**
 * GET /api/opportunities — List with pagination, filtering, search
 */
router.get('/', ensureAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = req.query;
    const filter = buildFilter(req.query);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: order === 'asc' ? 1 : -1 };

    const [opportunities, total] = await Promise.all([
      Opportunity.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      Opportunity.countDocuments(filter),
    ]);

    res.json({
      opportunities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    logger.error(`[API] GET /opportunities: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

/**
 * GET /api/opportunities/stats — Aggregate statistics
 */
router.get('/stats', ensureAuth, async (req, res) => {
  try {
    const now = new Date();
    const [total, active, bySource, byType, closingSoon] = await Promise.all([
      Opportunity.countDocuments(),
      Opportunity.countDocuments({ isActive: true }),
      Opportunity.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]),
      Opportunity.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
      Opportunity.countDocuments({
        deadline: { $gte: now, $lte: new Date(now.getTime() + 7 * 864e5) },
      }),
    ]);

    res.json({
      total,
      active,
      closingSoon,
      bySource: Object.fromEntries(bySource.map((s) => [s._id, s.count])),
      byType: Object.fromEntries(byType.map((t) => [t._id, t.count])),
    });
  } catch (err) {
    logger.error(`[API] GET /stats: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/opportunities/export/csv — Download all opportunities as CSV
 */
router.get('/export/csv', ensureAuth, async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const opps = await Opportunity.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const headers = [
      'Title', 'Type', 'Source', 'Organizer', 'Location', 'Mode',
      'Deadline', 'Funding', 'Prize', 'Sectors', 'Stages', 'Tags',
      'Description', 'Source URL',
    ];

    const escape = (val) => {
      const str = String(val || '').replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str}"`
        : str;
    };

    const rows = opps.map((o) =>
      [
        o.title, o.type, o.source, o.organizer, o.location, o.mode,
        o.deadline ? new Date(o.deadline).toLocaleDateString('en-IN') : '',
        o.fundingAmount, o.prize,
        (o.sector || []).join('; '), (o.stage || []).join('; '), (o.tags || []).join('; '),
        (o.description || '').substring(0, 200), o.sourceUrl,
      ].map(escape).join(',')
    );

    const BOM = '\uFEFF';
    const csv = BOM + [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="opportunities_${Date.now()}.csv"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(csv);
  } catch (err) {
    logger.error(`[API] CSV export: ${err.message}`);
    res.status(500).json({ error: 'Export failed' });
  }
});

/**
 * GET /api/opportunities/:id
 */
router.get('/:id', ensureAuth, async (req, res) => {
  try {
    const opp = await Opportunity.findById(req.params.id).lean();
    if (!opp) return res.status(404).json({ error: 'Not found' });
    res.json(opp);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch opportunity' });
  }
});

/**
 * POST /api/opportunities/scrape — Trigger manual scrape
 */
router.post('/scrape', ensureAuth, async (req, res) => {
  try {
    logger.info('[API] Manual scrape triggered');
    runNow().catch((err) => logger.error(`[API] Scrape failed: ${err.message}`));
    res.json({ message: 'Scrape pipeline started', status: 'running' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start scrape' });
  }
});

/**
 * POST /api/opportunities/scrape-url — Scrape a custom URL and save results to DB
 */
router.post('/scrape-url', ensureAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try { new URL(url); } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    logger.info(`[API] Custom scrape requested: ${url}`);
    const rawItems = await scrapeUrl(url);

    if (rawItems.length === 0) {
      return res.json({ message: 'No opportunities found on this page', items: [], saved: 0 });
    }

    // Normalize the scraped items
    const normalized = normalize(rawItems);

    // Save to DB (skip duplicates)
    let saved = 0;
    try {
      const result = await Opportunity.insertMany(normalized, { ordered: false });
      saved = result.length;
    } catch (err) {
      if (err.code === 11000 || err.insertedDocs) {
        saved = err.insertedDocs?.length || 0;
      } else {
        throw err;
      }
    }

    logger.info(`[API] Custom scrape: ${rawItems.length} found, ${saved} saved`);
    res.json({
      message: `Found ${rawItems.length} opportunities, saved ${saved} new items`,
      items: normalized,
      saved,
    });
  } catch (err) {
    logger.error(`[API] Custom scrape failed: ${err.message}`);
    res.status(500).json({ error: err.message || 'Scrape failed' });
  }
});

/**
 * DELETE /api/opportunities/:id
 */
router.delete('/:id', ensureAuth, async (req, res) => {
  try {
    const result = await Opportunity.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
