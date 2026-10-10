import { labelFor } from './fingerprints.js';
import { describeFailure } from './network.js';

/*
 * Turns audit signals into an opportunity score (0-100) for each service line
 * plus "findings": specific, verifiable observations that the pitch can use.
 *
 * Every finding has a `point`: one plain sentence a stranger could check by
 * opening the site. Those are what make cold email feel researched instead of
 * templated. Findings never insult anyone's work; they describe what a
 * customer experiences.
 */

// Industries where an AI receptionist / instant follow-up pays for itself:
// revenue arrives by phone or form and an unanswered lead is a lost job.
const AUTOMATION_INDUSTRIES = /dent|orthodont|medical|clinic|health|chiropract|physical therap|med ?spa|aesthetic|dermatolog|veterin|optom|law|legal|attorney|real estate|realty|mortgage|insurance|accounting|cpa|tax|property management|hvac|plumb|roof|electric|pest|landscap|remodel|contractor|construction|auto repair|mechanic|salon|spa|clean|moving|storage|logistic|freight|staffing|home service/i;

// Industries where customers come back often enough to keep an app installed.
const APP_INDUSTRIES = /fitness|gym|yoga|pilates|crossfit|martial|boxing|dance|church|ministr|restaurant|cafe|coffee|bakery|food|car wash|salon|barber|spa|retail|boutique|club|golf|sports|school|academy|tutor|daycare|childcare|pet|grooming|franchise|startup|saas|software|marketplace|app\b|events|venue|hotel|travel/i;

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

// `kind` is 'observed' (anyone can verify it on the site or listing) or
// 'context' (inferred from industry or company size). Pitches lead with
// observed findings.
function finding(service, id, weight, title, point, kind = 'observed') {
  return { service, id, weight, title, point, kind };
}

function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'social media';
  }
}

export function industryText(company) {
  return [company.industry, ...(company.keywords ?? []), company.categories?.join(' '), company.name].filter(Boolean).join(' ');
}

/**
 * @param {object} company  lead record (industry, employees, rating, reviewCount, …)
 * @param {object} audit    output of auditSite(): { reachable, https, signals, psi, … }
 * @param {object} opts     { icpService, icpBonus, now }
 */
export function scoreLead(company, audit, { icpService, icpBonus = 10, now = new Date() } = {}) {
  const findings = [];
  const add = (...args) => findings.push(finding(...args));
  const s = audit?.signals;
  const psi = audit?.psi;
  const industry = industryText(company);
  const year = now.getFullYear();

  // ---------------- Websites ----------------
  if (!audit || audit.noWebsite) {
    add('websites', 'no-website', 60, 'No website', company.socialUrl
      ? `the only web presence is a ${hostLabel(company.socialUrl)} page`
      : 'there’s no website, so a Google search ends at the map listing');
    if ((company.reviewCount ?? 0) >= 20) {
      add('websites', 'reviews-no-site', 15, 'Strong reviews, no site', `you have ${company.reviewCount} Google reviews (${company.rating}★) but no website to send people to`);
    }
  } else if (audit.blocked) {
    // The site turned our fetch away (bot protection). Only Google's own
    // PageSpeed run tells us anything, and "your site is down" would be wrong.
    if (psi?.performance != null) speedFindings(psi, add);
  } else if (!audit.reachable) {
    const failure = describeFailure(audit.error);
    add('websites', 'site-down', 55, audit.sslError ? 'Certificate error' : failure.title, audit.sslError
      ? 'the site throws a security certificate error, so browsers warn visitors away'
      : `when I tried to open ${company.domain ?? 'the website'}, ${failure.phrase}`);
  } else {
    if (audit.sslError) add('websites', 'ssl-error', 25, 'Certificate error', 'the https version shows a certificate warning');
    else if (!audit.https) add('websites', 'no-https', 22, 'No HTTPS', 'the site loads without https, so Chrome labels it “Not secure”');
    else if (audit.redirectsToHttps === false) add('websites', 'no-https-redirect', 6, 'No HTTPS redirect', 'the plain http:// address doesn’t forward to the secure version');

    if (!s.viewport) add('websites', 'not-mobile', 24, 'Not mobile-friendly', 'the site isn’t set up for phones, so it shows up shrunken and hard to tap on mobile');

    if (psi?.performance != null) {
      speedFindings(psi, add);
    } else if (audit.ttfbMs > 2500) {
      add('websites', 'slow-server', 10, 'Slow server response', `the server took ${seconds(audit.ttfbMs)} just to start responding`);
    }

    const legacy = s.tech.legacy;
    if (legacy.includes('flash')) add('websites', 'flash', 20, 'Uses Flash', 'parts of the site still rely on Flash, which no browser runs anymore');
    if (legacy.includes('frames')) add('websites', 'frames', 15, 'Frame-based layout', 'the site is built with frames, an approach browsers and Google stopped supporting well years ago');
    if (legacy.includes('table-layout') || legacy.includes('font-tags')) add('websites', 'legacy-markup', 10, 'Dated build', 'the page is built with table layouts and font tags from the early 2000s');
    if (s.tech.jquery && /^1\./.test(s.tech.jquery)) add('websites', 'old-jquery', 5, `jQuery ${s.tech.jquery}`, `it runs jQuery ${s.tech.jquery}, a version that’s over a decade old`);

    if (s.copyrightYear && s.copyrightYear <= year - 2) {
      add('websites', 'stale-copyright', s.copyrightYear <= year - 4 ? 10 : 6, `Footer says © ${s.copyrightYear}`, `the footer still says © ${s.copyrightYear}, which makes the business look less active than it is`);
    }

    const builder = s.tech.builder[0];
    if (builder) add('websites', `builder-${builder}`, 6, `Built on ${labelFor(builder)}`, `it’s built on ${labelFor(builder)}, which caps how fast and how custom it can get`);

    const seoGaps = [];
    if (!s.title) seoGaps.push('no page title');
    else if (s.title.length < 15 || /^(home|welcome|untitled|homepage)\b/i.test(s.title)) seoGaps.push(`a page title of just “${s.title}”`);
    if (!s.metaDescription) seoGaps.push('no meta description');
    if (s.h1Count === 0) seoGaps.push('no main heading');
    if (s.noindex) seoGaps.push('a noindex tag telling Google not to list it');
    if (!s.hasLocalBusinessSchema) seoGaps.push('no business schema markup');
    if (seoGaps.length) {
      const weight = s.noindex ? 20 : Math.min(12, seoGaps.length * 4);
      add('websites', 'seo-basics', weight, 'Missing SEO basics', `the homepage has ${listify(seoGaps.slice(0, 3))}, which makes it harder to show up on Google`);
    }
    if (psi?.seo != null && psi.seo < 80) add('websites', 'psi-seo', 5, `SEO score ${psi.seo}/100`, `Google’s Lighthouse SEO check scores it ${psi.seo}/100`);
    if (psi?.accessibility != null && psi.accessibility < 70) add('websites', 'a11y', 4, `Accessibility ${psi.accessibility}/100`, `the accessibility check scores it ${psi.accessibility}/100`);

    if (!s.ctas.call && !s.ctas.book && !s.ctas.quote) add('websites', 'no-cta', 10, 'No clear next step', 'there’s no tap-to-call, booking, or quote button on the homepage');
    else if (!s.ctas.call && s.phones.length) add('websites', 'phone-not-tappable', 5, 'Phone not tappable', 'the phone number isn’t tap-to-call on mobile');

    if (s.mixedContent > 0) add('websites', 'mixed-content', 5, 'Insecure assets', `${s.mixedContent} file(s) load over plain http on the secure page`);
    if (s.images.total >= 5 && s.images.missingAlt / s.images.total > 0.5) add('websites', 'alt-text', 3, 'Images missing alt text', `${s.images.missingAlt} of ${s.images.total} images have no alt text`);
    if (s.analytics.includes('universal-analytics') && !s.analytics.includes('ga4') && !s.analytics.includes('gtm')) {
      add('websites', 'dead-analytics', 6, 'Analytics stopped working', 'it still runs Universal Analytics, which Google shut off in 2023, so traffic isn’t being measured');
    } else if (!s.analytics.length) {
      add('websites', 'no-analytics', 3, 'No analytics', 'there’s no analytics installed, so there’s no way to see where visitors come from');
    }

    // A recently rebuilt, fast site on a modern stack is a weak website lead.
    if (s.tech.framework.length && (psi?.performance ?? 0) >= 80) add('websites', 'modern-site', -25, 'Modern, fast site', 'the site is already modern and fast');
  }

  // ---------------- AI automations ----------------
  const autoFit = AUTOMATION_INDUSTRIES.test(industry);
  if (autoFit) add('automation', 'industry-fit', 22, 'Lead-driven industry', 'new business arrives by phone and web forms, so every missed one is lost revenue', 'context');
  if (s && audit.reachable) {
    if (!s.chat.length) add('automation', 'no-chat', 16, 'No instant answers', 'there’s no chat or instant reply on the site, so after-hours visitors have to wait or call back');
    if (autoFit && !s.booking.length && !s.ctas.book) add('automation', 'no-online-booking', 18, 'No online booking', 'there’s no way to book online; it’s call or fill out a form and wait');
    if (s.forms.count && !s.crm.length && !s.chat.length) add('automation', 'form-to-inbox', 10, 'Form goes nowhere fast', 'the contact form looks like it drops into an inbox with no instant follow-up');
    if (s.crm.length) add('automation', 'has-crm', 6, `Uses ${labelFor(s.crm[0])}`, `you already use ${labelFor(s.crm[0])}, so automations can plug straight into it`);
    if (s.chat.length && !s.chat.includes('ai-chatbot')) add('automation', 'human-chat', 4, `Uses ${labelFor(s.chat[0])}`, `your ${labelFor(s.chat[0])} still needs a person to answer it`);
  }
  if ((company.reviewCount ?? 0) >= 100) add('automation', 'high-volume', 10, 'High customer volume', `${company.reviewCount} Google reviews suggests a lot of inbound calls to keep up with`, 'context');
  const employees = company.employees ?? null;
  if (employees && employees >= 8 && employees <= 250) add('automation', 'team-size', 10, `${employees} employees`, `a team of about ${employees}, big enough that repetitive admin adds up`, 'context');
  if (company.hiringFor?.length) add('automation', 'hiring-admin', 14, 'Hiring for admin roles', `you’re hiring for ${listify(company.hiringFor.slice(0, 2))}, work an automation could take on`);

  // ---------------- Apps ----------------
  const appFit = APP_INDUSTRIES.test(industry);
  if (appFit) add('apps', 'industry-fit', 22, 'Repeat-customer business', 'customers come back often enough to keep an app on their phone', 'context');
  if (s && audit.reachable) {
    const hasApp = s.appStore || s.playStore;
    if (hasApp) add('apps', 'has-app', -20, 'Already has an app', 'you already have an app');
    if (!hasApp && (s.login || s.membership || s.loyalty || s.ordering || s.booking.length)) {
      const what = [s.membership && 'memberships', s.loyalty && 'a rewards program', s.ordering && 'online ordering', s.booking.length && 'bookings', s.login && 'a customer login'].filter(Boolean);
      add('apps', 'web-only-engagement', 22, 'Repeat engagement, no app', `${listify(what.slice(0, 2))} run through the website, with no app`);
    }
    if (!hasApp && appFit) add('apps', 'no-app', 12, 'No app', 'there’s no app for regulars to book, reorder, or get notified');
    if (s.ecommerce.length) add('apps', 'ecommerce', 8, `Sells online (${labelFor(s.ecommerce[0])})`, `you already sell online through ${labelFor(s.ecommerce[0])}`);
    if (s.multiLocation) add('apps', 'multi-location', 10, 'Multiple locations', 'with multiple locations, one app can tie the whole customer experience together');
    if (s.booking.some((b) => ['mindbody', 'gym-software', 'vagaro', 'booksy', 'fresha', 'church-center'].includes(b))) {
      add('apps', 'third-party-app', 8, 'Customers use a generic app', 'customers book through a generic third-party app instead of one with your name on it');
    }
  }
  if (company.fundingStage || company.totalFunding) add('apps', 'funded', 18, 'Funded', `you raised ${company.fundingStage ?? 'outside funding'}, so shipping product fast matters`, 'context');
  if (employees && employees >= 20) add('apps', 'size', 6, `${employees} employees`, `around ${employees} people, enough to justify internal tools`, 'context');

  // ---------------- Totals ----------------
  const scores = { websites: 0, automation: 0, apps: 0 };
  for (const f of findings) scores[f.service] += f.weight;
  if (icpService && scores[icpService] !== undefined) scores[icpService] += icpBonus;
  for (const key of Object.keys(scores)) scores[key] = clamp(scores[key]);

  const primaryService = Object.entries(scores).sort((a, b) => b[1] - a[1] || (a[0] === icpService ? -1 : 1))[0][0];
  const talkingPoints = findings
    .filter((f) => f.service === primaryService && f.weight > 0)
    .sort((a, b) => (a.kind === b.kind ? b.weight - a.weight : a.kind === 'observed' ? -1 : 1))
    .slice(0, 4);

  return { scores, primaryService, findings: findings.sort((a, b) => b.weight - a.weight), talkingPoints };
}

function speedFindings(psi, add) {
  if (psi.performance < 30) add('websites', 'very-slow', 22, `Mobile speed ${psi.performance}/100`, `Google’s PageSpeed test scores the homepage ${psi.performance}/100 on mobile`);
  else if (psi.performance < 50) add('websites', 'slow', 14, `Mobile speed ${psi.performance}/100`, `Google’s PageSpeed test scores the homepage ${psi.performance}/100 on mobile`);
  if (psi.lcpMs != null && psi.lcpMs > 4000) add('websites', 'slow-lcp', 10, `Main content loads in ${seconds(psi.lcpMs)}`, `on a phone the main content takes about ${seconds(psi.lcpMs)} to appear`);
}

function listify(items) {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}
