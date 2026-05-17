import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger.js';

let ai = null;

function getClient() {
  if (!ai && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

/**
 * Uses Gemini AI to auto-tag opportunities with structured metadata.
 * Falls back to keyword-based tagging if Gemini is unavailable.
 */
export async function tagOpportunities(items) {
  const client = getClient();

  if (!client) {
    logger.warn('[AI Tagger] No Gemini API key — using keyword fallback');
    return items.map(keywordTag);
  }

  const tagged = [];

  // Process in batches of 3
  for (let i = 0; i < items.length; i += 3) {
    const batch = items.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map((item) => tagSingle(client, item))
    );

    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') {
        tagged.push(results[j].value);
      } else {
        tagged.push(keywordTag(batch[j]));
      }
    }

    // Rate limit
    if (i + 3 < items.length) await new Promise((r) => setTimeout(r, 2000));
  }

  logger.info(`[AI Tagger] Tagged ${tagged.length} items`);
  return tagged;
}

async function tagSingle(client, item) {
  try {
    const prompt = `You are a startup opportunity classifier. Analyze this opportunity and respond with ONLY a JSON object, no markdown fences.

Title: ${item.title}
Description: ${(item.description || '').substring(0, 300)}
Type: ${item.type || 'unknown'}
Source: ${item.source}

Respond with this exact JSON structure:
{"type":"hackathon","sector":["AI/ML"],"stage":["Idea"],"tags":["Remote","Prize Money"],"fundingRange":"","mode":"remote"}

Valid types: hackathon, accelerator, grant, challenge, incubator, program, conference, other
Valid modes: remote, on-site, hybrid, (empty string if unknown)
Pick 1-3 sectors from: AI/ML, FinTech, HealthTech, EdTech, CleanTech, SaaS, E-Commerce, AgriTech, IoT, Web3, DeepTech, Social Impact, General
Pick 1-2 stages from: Idea, Prototype, Pre-Seed, Seed, Series A, Growth, All Stages
Pick 2-4 tags like: Remote, On-site, Equity-free, Government, Prize Money, Mentorship, Women-focused, Student-friendly, Open Source`;

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    let text = response.text.trim();
    // Strip markdown fences
    text = text.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(text);

    return {
      ...item,
      type: parsed.type || item.type,
      sector: Array.isArray(parsed.sector) ? parsed.sector.slice(0, 3) : item.sector || [],
      stage: Array.isArray(parsed.stage) ? parsed.stage.slice(0, 2) : item.stage || [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4) : item.tags || [],
      fundingAmount: parsed.fundingRange || item.fundingAmount || '',
      mode: parsed.mode || item.mode || '',
    };
  } catch (err) {
    logger.debug(`[AI Tagger] Gemini error for "${item.title}": ${err.message}`);
    return keywordTag(item);
  }
}

/** Keyword-based fallback tagger */
function keywordTag(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();

  const sectorMap = {
    'AI/ML': ['ai', 'machine learning', 'deep learning', 'artificial intelligence', 'nlp', 'llm'],
    FinTech: ['fintech', 'finance', 'banking', 'payment', 'blockchain', 'crypto'],
    HealthTech: ['health', 'medical', 'biotech', 'pharma', 'wellness'],
    EdTech: ['education', 'edtech', 'learning', 'school', 'university'],
    CleanTech: ['clean', 'climate', 'sustainability', 'renewable', 'green', 'energy'],
    SaaS: ['saas', 'software', 'cloud', 'platform', 'b2b'],
    Web3: ['web3', 'blockchain', 'crypto', 'defi', 'nft', 'ethereum'],
    IoT: ['iot', 'hardware', 'sensor', 'embedded'],
    AgriTech: ['agri', 'agriculture', 'farming', 'food'],
  };

  const sectors = [];
  for (const [sector, kws] of Object.entries(sectorMap)) {
    if (kws.some((kw) => text.includes(kw))) sectors.push(sector);
  }

  const stages = [];
  if (/idea|ideation|concept/i.test(text)) stages.push('Idea');
  if (/prototype|mvp/i.test(text)) stages.push('Prototype');
  if (/seed/i.test(text)) stages.push('Seed');
  if (/early[\s-]?stage/i.test(text)) stages.push('Early Stage');
  if (/growth|scale/i.test(text)) stages.push('Growth');

  const tags = [];
  if (/remote|online|virtual/i.test(text)) tags.push('Remote');
  if (/on[\s-]?site|offline|in[\s-]?person/i.test(text)) tags.push('On-site');
  if (/equity[\s-]?free|no equity/i.test(text)) tags.push('Equity-free');
  if (/government|govt/i.test(text)) tags.push('Government');
  if (/prize|reward|cash/i.test(text)) tags.push('Prize Money');
  if (/mentor/i.test(text)) tags.push('Mentorship');
  if (/women|female/i.test(text)) tags.push('Women-focused');
  if (/student|college/i.test(text)) tags.push('Student-friendly');

  return {
    ...item,
    sector: sectors.length ? sectors : ['General'],
    stage: stages.length ? stages : ['All Stages'],
    tags: tags.length ? tags : ['General'],
  };
}
