import { extractBrand } from './brand.js';
import { fetchHomepage, fetchSeoFiles, getPage } from './fetchSite.js';
import { visibleText } from './html.js';
import { runPageSpeed } from './pagespeed.js';
import { scoreLead } from './score.js';
import { extractSignals } from './signals.js';
import { isPlatformProfile, normalizeDomain, nowIso, sleep, toHomepageUrl, uniq } from '../lib/util.js';

function looksBlocked(page) {
  if (![401, 403, 406, 429, 503].includes(page.status)) return false;
  const h = page.headers ?? {};
  return Boolean(
    h['cf-ray'] || h['cf-mitigated'] || /cloudflare|sucuri|akamai|incapsula|imperva|ddos-guard/i.test(`${h.server ?? ''} ${h['x-cdn'] ?? ''}`) ||
      /captcha|challenge|access denied|attention required|are you a robot|just a moment/i.test(page.html?.slice(0, 5000) ?? ''),
  );
}

/**
 * Look at a company's website the way a prospective customer would, and
 * collect everything worth knowing. Never throws for site problems; those are
 * findings.
 */
export async function auditSite(company, { pagespeed = false, psiKey, timeoutMs = 20_000, fetch, retryDelayMs = 1500 } = {}) {
  const at = nowIso();
  if (!company.website || isPlatformProfile(company.website)) {
    return { at, noWebsite: true };
  }
  const url = toHomepageUrl(company.website);
  let fetched = await fetchHomepage(url, { fetch, timeoutMs });
  // One patient retry before calling a site unreachable: slow shared hosting
  // and transient DNS hiccups are common, and a false "your site is down"
  // costs the whole lead.
  if (!fetched.page?.ok && !fetched.page?.status && !fetched.sslError) {
    await sleep(retryDelayMs);
    fetched = await fetchHomepage(url, { fetch, timeoutMs: timeoutMs * 2 });
  }
  const page = fetched.page;

  const runPsi = async (target) => {
    if (!pagespeed) return { psi: null, psiError: null };
    try {
      return { psi: await runPageSpeed(target, { apiKey: psiKey, fetch }), psiError: null };
    } catch (err) {
      return { psi: null, psiError: err.message };
    }
  };

  if (!page?.ok) {
    if (page && looksBlocked(page)) {
      return { at, url, finalUrl: page.finalUrl, reachable: null, blocked: true, status: page.status, https: fetched.https, ...(await runPsi(page.finalUrl ?? url)) };
    }
    return {
      at,
      url,
      reachable: false,
      status: page?.status ?? null,
      https: fetched.https,
      sslError: fetched.sslError,
      error: page?.status ? `HTTP ${page.status}` : page?.error ?? 'NO_RESPONSE',
    };
  }

  const finalUrl = page.finalUrl;
  const signals = extractSignals(page.html, { url: finalUrl, headers: page.headers });
  const brand = extractBrand(page.html, signals, { url: finalUrl, fallbackName: company.name, domain: company.domain, text: visibleText(page.html) });
  delete signals.jsonLd;

  // Small businesses often only list an email on the contact page.
  if (!signals.emails.length && signals.contactUrl && normalizeDomain(signals.contactUrl) === normalizeDomain(finalUrl)) {
    const contact = await getPage(signals.contactUrl, { fetch, timeoutMs });
    if (contact.ok) {
      const cs = extractSignals(contact.html, { url: contact.finalUrl });
      signals.emails = cs.emails;
      signals.phones = uniq([...signals.phones, ...cs.phones]).slice(0, 5);
      if (!signals.forms.count) signals.forms = cs.forms;
      for (const key of ['chat', 'booking', 'crm', 'formBuilders']) signals[key] = uniq([...signals[key], ...cs[key]]);
    }
  }

  const [seoFiles, { psi, psiError }] = await Promise.all([fetchSeoFiles(new URL(finalUrl).origin, { fetch, timeoutMs }), runPsi(finalUrl)]);

  return {
    at,
    url,
    finalUrl,
    reachable: true,
    status: page.status,
    https: fetched.https,
    sslError: fetched.sslError,
    redirectsToHttps: fetched.redirectsToHttps,
    ttfbMs: page.ttfbMs,
    totalMs: page.totalMs,
    bytes: page.bytes,
    signals: { ...signals, ...seoFiles },
    brand,
    psi,
    psiError,
  };
}

/** Audit + score, returning the fields to merge into the lead record. */
export async function auditAndScore(company, { config, icpService, ...options }) {
  const audit = await auditSite(company, options);
  const result = scoreLead(company, audit, { icpService, icpBonus: config.scoring.icpBonus });
  return { audit, ...result };
}
