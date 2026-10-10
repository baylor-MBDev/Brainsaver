// Small helpers shared across the engine. No dependencies.

export const nowIso = () => new Date().toISOString();

export function slugify(text, max = 60) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

// Hosts that are profiles on someone else's platform, not a website the
// business owns. A business whose "website" is one of these has no site.
const PLATFORM_HOSTS = [
  'facebook.com', 'fb.com', 'instagram.com', 'linktr.ee', 'yelp.com',
  'nextdoor.com', 'business.site', 'google.com', 'g.page', 'goo.gl',
  'tiktok.com', 'x.com', 'twitter.com', 'linkedin.com', 'youtube.com',
  'angi.com', 'homeadvisor.com', 'thumbtack.com', 'houzz.com', 'bbb.org',
  'yellowpages.com', 'mapquest.com', 'doordash.com', 'ubereats.com',
  'grubhub.com', 'opentable.com', 'booksy.com', 'vagaro.com', 'linkin.bio',
];

export function hostOf(urlOrDomain) {
  if (!urlOrDomain) return null;
  let raw = String(urlOrDomain).trim();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `http://${raw}`;
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/\.$/, '');
    if (!host.includes('.') || /\s/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

/** "https://www.Acme.com/about" -> "acme.com" */
export function normalizeDomain(urlOrDomain) {
  const host = hostOf(urlOrDomain);
  return host ? host.replace(/^www\d?\./, '') : null;
}

export function isPlatformProfile(urlOrDomain) {
  const host = hostOf(urlOrDomain);
  if (!host) return false;
  return PLATFORM_HOSTS.some((p) => host === p || host.endsWith(`.${p}`));
}

/** Turn whatever a data source gave us into a homepage URL. The audit tries
 * https first and falls back to http on its own. */
export function toHomepageUrl(urlOrDomain) {
  const host = hostOf(urlOrDomain);
  return host ? `https://${host}/` : null;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(text, max) {
  const s = String(text ?? '');
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

export function wordCount(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
}

export function titleCase(text) {
  return String(text ?? '').replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export function uniq(values) {
  return [...new Set(values.filter((v) => v !== undefined && v !== null && v !== ''))];
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run `fn` over `items` with at most `concurrency` in flight. Keeps order. */
export async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// --- CSV (RFC 4180) -------------------------------------------------------

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = Array.isArray(value) ? value.join('; ') : String(value);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows, columns) {
  const cols = columns ?? uniq(rows.flatMap((r) => Object.keys(r)));
  const lines = [cols.map(csvCell).join(',')];
  for (const row of rows) lines.push(cols.map((c) => csvCell(row[c])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text).replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}
