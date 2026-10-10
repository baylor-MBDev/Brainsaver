import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { hostOf } from '../lib/util.js';

export const AUDIT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 MockingbirdSiteAudit/1.0';

const MAX_BYTES = 3 * 1024 * 1024;

function charsetFrom(contentType, head) {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader;
  return head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? 'utf-8';
}

async function readCapped(res) {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    if (size >= MAX_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk.subarray(0, Math.min(chunk.byteLength, size - offset)), offset);
    offset += chunk.byteLength;
  }
  return out;
}

function decode(bytes, contentType) {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  const label = charsetFrom(contentType, head);
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

function isPrivateIp(ip) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
    return v === '::1' || v === '::' || /^f[cd]/.test(v) || v.startsWith('fe80');
  }
  return false;
}

/**
 * Website URLs can come from strangers (the free-audit form on our site), so
 * never fetch loopback, private-network, or link-local addresses, including
 * via DNS or a redirect. The DNS step is skipped when a fetch implementation
 * is injected (tests use fake hosts).
 */
export async function isPublicHost(host, { resolve = true } = {}) {
  if (!host) return false;
  const h = host.replace(/^\[|\]$/g, '');
  if (isIP(h)) return !isPrivateIp(h);
  if (!h.includes('.') || /(?:^|\.)(?:localhost|local|internal|lan|home\.arpa)$/i.test(h)) return false;
  if (!resolve) return true;
  try {
    const addresses = await lookup(h, { all: true });
    return addresses.every((a) => !isPrivateIp(a.address));
  } catch {
    return true; // unresolvable: let the fetch report ENOTFOUND
  }
}

/** One GET with timings. Never throws: failures come back as { ok: false, error }. */
export async function getPage(url, { fetch: fetchImpl, timeoutMs = 20_000 } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  const started = performance.now();
  try {
    // Follow redirects by hand so every hop gets the public-host check.
    let current = url;
    let res;
    for (let hop = 0; ; hop++) {
      if (!(await isPublicHost(hostOf(current), { resolve: !fetchImpl }))) {
        return { ok: false, url, error: 'BLOCKED_HOST', message: `Refusing to fetch a private or local address: ${current}`, totalMs: 0 };
      }
      res = await doFetch(current, {
        redirect: 'manual',
        headers: {
          'user-agent': AUDIT_USER_AGENT,
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location && hop < 6) {
        await res.body?.cancel().catch(() => {});
        current = new URL(location, current).href;
        continue;
      }
      break;
    }
    const ttfbMs = Math.round(performance.now() - started);
    const bytes = await readCapped(res);
    const contentType = res.headers.get('content-type') ?? '';
    return {
      ok: res.ok,
      status: res.status,
      url,
      finalUrl: current,
      headers: Object.fromEntries(res.headers.entries()),
      contentType,
      html: /html|xml|text\/plain/i.test(contentType) || !contentType ? decode(bytes, contentType) : '',
      bytes: bytes.byteLength,
      ttfbMs,
      totalMs: Math.round(performance.now() - started),
    };
  } catch (err) {
    const code = err.cause?.code ?? (err.name === 'TimeoutError' ? 'TIMEOUT' : err.name);
    return { ok: false, url, error: code, message: err.cause?.message ?? err.message, totalMs: Math.round(performance.now() - started) };
  }
}

const TLS_ERRORS = /CERT|SSL|TLS|ERR_TLS|UNABLE_TO_VERIFY|SELF_SIGNED|ALTNAME|EPROTO/i;

/**
 * Fetch a homepage the way a visitor would: https first, then plain http.
 * Also records whether plain http redirects to https.
 */
export async function fetchHomepage(homepageUrl, options = {}) {
  const host = hostOf(homepageUrl);
  if (!host) return { ok: false, error: 'BAD_URL', message: `Not a URL: ${homepageUrl}` };
  const httpsUrl = `https://${host}/`;
  const httpUrl = `http://${host}/`;

  const result = { host, https: null, sslError: null, redirectsToHttps: null, page: null, attempts: [] };

  let page = await getPage(httpsUrl, options);
  if (page.ok || page.status) {
    result.https = true;
  } else {
    result.attempts.push(page);
    if (TLS_ERRORS.test(`${page.error} ${page.message}`)) result.sslError = page.error;
    page = await getPage(httpUrl, options);
    result.https = false;
  }
  // Some hosts only answer on www.
  if (!page.ok && !page.status && !host.startsWith('www.')) {
    result.attempts.push(page);
    const www = await getPage(`https://www.${host}/`, options);
    if (www.ok || www.status) {
      page = www;
      result.https = true;
    }
  }
  result.page = page;
  result.ok = Boolean(page.ok);

  if (result.https && page.ok) {
    try {
      if (!(await isPublicHost(host, { resolve: !options.fetch }))) throw new Error('private host');
      const res = await (options.fetch ?? globalThis.fetch)(httpUrl, {
        redirect: 'manual',
        headers: { 'user-agent': AUDIT_USER_AGENT },
        signal: AbortSignal.timeout(Math.min(options.timeoutMs ?? 20_000, 10_000)),
      });
      const location = res.headers.get('location') ?? '';
      result.redirectsToHttps = res.status >= 300 && res.status < 400 ? /^https:/i.test(new URL(location, httpUrl).href) : false;
      await res.body?.cancel().catch(() => {});
    } catch {
      result.redirectsToHttps = null;
    }
  }
  if (page.finalUrl && /^https:/i.test(page.finalUrl)) result.https = true;
  return result;
}

/** robots.txt and sitemap.xml presence. */
export async function fetchSeoFiles(origin, options = {}) {
  const opts = { ...options, timeoutMs: Math.min(options.timeoutMs ?? 20_000, 8000) };
  const [robots, sitemap] = await Promise.all([getPage(`${origin}/robots.txt`, opts), getPage(`${origin}/sitemap.xml`, opts)]);
  const robotsOk = robots.ok && !/<html/i.test(robots.html.slice(0, 500));
  return {
    robotsTxt: robotsOk,
    sitemap: (sitemap.ok && /<(?:urlset|sitemapindex)/i.test(sitemap.html)) || (robotsOk && /^sitemap:/im.test(robots.html)),
  };
}
