import { requestJson } from '../lib/http.js';

const ENDPOINT = 'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * Google PageSpeed Insights (Lighthouse run by Google, plus real-user Chrome
 * data when the site has enough traffic). Mobile strategy, because that's how
 * customers find local businesses.
 */
export async function runPageSpeed(url, { apiKey, strategy = 'MOBILE', fetch, timeoutMs = 90_000 } = {}) {
  const params = new URLSearchParams({ url, strategy });
  for (const category of ['PERFORMANCE', 'SEO', 'ACCESSIBILITY', 'BEST_PRACTICES']) params.append('category', category);
  if (apiKey) params.set('key', apiKey);

  const data = await requestJson(`${ENDPOINT}?${params}`, { timeoutMs, retries: 2, fetch });
  const lh = data.lighthouseResult ?? {};
  if (lh.runtimeError?.code && lh.runtimeError.code !== 'NO_ERROR') {
    throw new Error(`PageSpeed couldn't test ${url}: ${lh.runtimeError.message ?? lh.runtimeError.code}`);
  }
  const score = (key) => {
    const s = lh.categories?.[key]?.score;
    return typeof s === 'number' ? Math.round(s * 100) : null;
  };
  const metric = (id) => {
    const v = lh.audits?.[id]?.numericValue;
    return typeof v === 'number' ? v : null;
  };
  const round = (v, digits = 0) => (v === null ? null : Number(v.toFixed(digits)));

  return {
    strategy: strategy.toLowerCase(),
    performance: score('performance'),
    seo: score('seo'),
    accessibility: score('accessibility'),
    bestPractices: score('best-practices'),
    lcpMs: round(metric('largest-contentful-paint')),
    fcpMs: round(metric('first-contentful-paint')),
    tbtMs: round(metric('total-blocking-time')),
    speedIndexMs: round(metric('speed-index')),
    cls: round(metric('cumulative-layout-shift'), 3),
    // Real Chrome users over the last 28 days: FAST / AVERAGE / SLOW (null when
    // the site doesn't get enough traffic to be measured).
    fieldSpeed: data.loadingExperience?.overall_category ?? null,
  };
}
