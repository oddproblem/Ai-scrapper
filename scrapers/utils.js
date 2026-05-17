import axios from 'axios';

export const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export async function fetchPage(url, opts = {}) {
  const { data } = await axios.get(url, {
    headers: { ...HEADERS, ...opts.headers },
    timeout: opts.timeout || 30000,
  });
  return data;
}

export function dedupeByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.sourceUrl || seen.has(item.sourceUrl)) return false;
    seen.add(item.sourceUrl);
    return true;
  });
}

export function detectType(text) {
  const t = (text || '').toLowerCase();
  if (/hackathon|hack\b/i.test(t)) return 'hackathon';
  if (/accelerat/i.test(t)) return 'accelerator';
  if (/incubat/i.test(t)) return 'incubator';
  if (/grant|funding|fund\b/i.test(t)) return 'grant';
  if (/challenge|competition|contest/i.test(t)) return 'challenge';
  if (/program|programme|scheme/i.test(t)) return 'program';
  if (/conference|summit|meet/i.test(t)) return 'conference';
  return 'other';
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chrome path detection for puppeteer-core */
export function findChrome() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    process.env.CHROME_PATH || '',
  ].filter(Boolean);
  return paths[0];
}
