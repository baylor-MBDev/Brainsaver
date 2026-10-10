import { detectTech } from './fingerprints.js';
import {
  decodeEntities,
  extractJsonLd,
  metaContent,
  resolveUrl,
  scanElements,
  scanTags,
  stripNonContent,
  textOf,
  visibleText,
} from './html.js';
import { normalizeDomain, uniq } from '../lib/util.js';

const SOCIAL = {
  facebook: /facebook\.com\/(?!sharer|share|dialog|plugins|tr\?)[^"'\s?#]+/i,
  instagram: /instagram\.com\/(?!p\/|explore)[^"'\s?#]+/i,
  linkedin: /linkedin\.com\/(?:company|in)\/[^"'\s?#]+/i,
  tiktok: /tiktok\.com\/@[^"'\s?#]+/i,
  youtube: /youtube\.com\/(?:channel|c|user|@)[^"'\s?#]*/i,
  x: /(?:twitter|x)\.com\/(?!intent|share|home)[A-Za-z0-9_]{2,}/i,
};

const GENERIC_NAV = new Set([
  'home', 'about', 'about us', 'contact', 'contact us', 'blog', 'news', 'reviews', 'testimonials', 'careers', 'jobs',
  'faq', 'faqs', 'gallery', 'privacy', 'privacy policy', 'terms', 'login', 'log in', 'sign in', 'menu', 'search',
  'more', 'services', 'our services', 'shop', 'cart', 'team', 'our team', 'locations', 'resources', 'get started',
  'call now', 'book now', 'learn more', 'read more', 'skip to content', 'accessibility', 'sitemap', 'portfolio',
  'financing', 'specials', 'coupons', 'request service', 'schedule service', 'free estimate', 'get a quote',
]);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})\b/g;
const JUNK_EMAIL = /\.(png|jpe?g|gif|svg|webp|avif)$|@(?:example|domain|email|yourdomain|sentry|wixpress|sentry-next)\.|^(?:name|you|your|user|email)@/i;

function formatPhone(a, b, c) {
  return `(${a}) ${b}-${c}`;
}

export function extractEmails(html, text) {
  const fromMailto = [...html.matchAll(/mailto:([^"'?\s>]+)/gi)].map((m) => decodeURIComponent(m[1]));
  const fromText = text.match(EMAIL_RE) ?? [];
  return uniq([...fromMailto, ...fromText].map((e) => e.trim().toLowerCase().replace(/[.,;:]+$/, '')))
    .filter((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e) && !JUNK_EMAIL.test(e))
    .slice(0, 10);
}

export function extractPhones(html, text) {
  const out = [];
  for (const m of html.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)) {
    const digits = m[1].replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (digits.length === 10) out.push(formatPhone(digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)));
  }
  for (const m of text.matchAll(PHONE_RE)) out.push(formatPhone(m[1], m[2], m[3]));
  return uniq(out).slice(0, 5);
}

function copyrightYear(text) {
  let year = null;
  const re = /(?:©|\(c\)|copyright)\s*(?:[^0-9]{0,40}?)((?:19|20)\d{2})(?:\s*[-–—]\s*((?:19|20)\d{2}))?/gi;
  for (const m of text.matchAll(re)) {
    const y = Number(m[2] ?? m[1]);
    if (y >= 1995 && y <= new Date().getFullYear() + 1) year = Math.max(year ?? 0, y);
  }
  return year;
}

function jqueryVersion(html) {
  const m =
    html.match(/jquery[.-](\d+\.\d+(?:\.\d+)?)(?:\.min|\.slim)?\.js/i) ??
    html.match(/jquery(?:\.min)?\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i) ??
    html.match(/ajax\/libs\/jquery\/(\d+\.\d+(?:\.\d+)?)\//i) ??
    html.match(/code\.jquery\.com\/jquery-(\d+\.\d+(?:\.\d+)?)/i);
  return m ? m[1] : null;
}

function legacyMarkup(html) {
  const flags = [];
  const doctype = html.trimStart().slice(0, 200);
  if (!/^<!doctype html>/i.test(doctype) && /^<!doctype/i.test(doctype)) flags.push('pre-html5-doctype');
  if (/<frameset|<frame\s/i.test(html)) flags.push('frames');
  if (/\.swf\b|application\/x-shockwave-flash/i.test(html)) flags.push('flash');
  if ((html.match(/<font[\s>]/gi) ?? []).length >= 3) flags.push('font-tags');
  if (/<center>/i.test(html)) flags.push('center-tags');
  if (/<marquee|<blink/i.test(html)) flags.push('marquee');
  const tables = (html.match(/<table/gi) ?? []).length;
  if (tables >= 3 && /\b(?:cellpadding|bgcolor)\s*=/i.test(html)) flags.push('table-layout');
  return flags;
}

function hasText(re, ...sources) {
  return sources.some((s) => re.test(s));
}

/**
 * Pull every signal the scorer and the pitch writer care about out of a
 * homepage. Pure function: no network.
 */
export function extractSignals(html, { url, headers = {} } = {}) {
  const raw = String(html ?? '');
  const content = stripNonContent(raw);
  const tags = scanTags(raw, ['html', 'meta', 'link', 'img', 'script', 'form', 'input', 'a', 'iframe', 'button']);
  const text = visibleText(raw);
  const pageHost = normalizeDomain(url);

  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : null;
  const metaDescription = metaContent(tags, 'description');
  const viewport = metaContent(tags, 'viewport');
  const robots = metaContent(tags, 'robots');
  const h1s = scanElements(content, 'h1').map((e) => textOf(e.inner)).filter(Boolean);
  const subheads = [...scanElements(content, 'h2'), ...scanElements(content, 'h3')]
    .sort((a, b) => a.index - b.index)
    .map((e) => textOf(e.inner))
    .filter((t) => t && t.length <= 80)
    .slice(0, 30);

  const anchors = scanElements(content, 'a').map((a) => ({
    href: a.attrs.href ?? '',
    text: textOf(a.inner),
    abs: a.attrs.href ? resolveUrl(a.attrs.href, url) : null,
  }));
  const buttonsText = scanElements(content, 'button').map((b) => textOf(b.inner));
  const actionText = [...anchors.map((a) => a.text), ...buttonsText].join(' | ');
  const hrefs = anchors.map((a) => a.href).join(' ');

  const links = { internal: 0, external: 0 };
  for (const a of anchors) {
    if (!a.abs || !/^https?:/i.test(a.abs)) continue;
    if (normalizeDomain(a.abs) === pageHost) links.internal++;
    else links.external++;
  }

  const imgs = tags.filter((t) => t.name === 'img');
  const scripts = tags.filter((t) => t.name === 'script');
  const stylesheets = tags.filter((t) => t.name === 'link' && /stylesheet/i.test(t.attrs.rel ?? ''));
  const forms = scanElements(raw, 'form');
  const inputs = tags.filter((t) => t.name === 'input');
  const jsonLd = extractJsonLd(raw);
  const jsonLdTypes = uniq(jsonLd.flatMap((item) => [].concat(item['@type'] ?? [])).map(String));
  const tech = detectTech(raw, headers);

  const isHttps = /^https:/i.test(url ?? '');
  const mixedContent = isHttps
    ? tags.filter((t) => ['img', 'script', 'iframe'].includes(t.name) && /^http:\/\//i.test(t.attrs.src ?? '')).length +
      stylesheets.filter((t) => /^http:\/\//i.test(t.attrs.href ?? '')).length
    : 0;

  const social = {};
  for (const [network, re] of Object.entries(SOCIAL)) {
    // Anchor on "//" so the network's domain has to start the host.
    const m = raw.match(new RegExp(`//((?:[a-z0-9-]+\\.)?${re.source})`, 'i'));
    if (m) social[network] = `https://${m[1]}`;
  }

  const contactLink = anchors.find((a) => /contact/i.test(a.href) || /^contact/i.test(a.text));
  const ctas = {
    call: /href\s*=\s*["']tel:/i.test(raw) || hasText(/\bcall (?:us|now|today)\b/i, actionText),
    book: hasText(/\b(?:book (?:now|online|an? (?:appointment|consultation|visit|call|class|table))|schedule (?:now|online|an? (?:appointment|visit|service|consultation|call))|request (?:an )?appointment|reserve)\b/i, actionText),
    quote: hasText(/\b(?:free (?:quote|estimate|inspection|consultation)|get (?:a |your )?(?:quote|estimate)|request (?:a )?(?:quote|estimate))\b/i, actionText),
    contact: Boolean(contactLink) || forms.length > 0,
  };

  const emailFields = inputs.filter((i) => /email/i.test(`${i.attrs.type ?? ''} ${i.attrs.name ?? ''} ${i.attrs.id ?? ''}`)).length;
  const phoneFields = inputs.filter((i) => /tel|phone/i.test(`${i.attrs.type ?? ''} ${i.attrs.name ?? ''} ${i.attrs.id ?? ''}`)).length;

  return {
    title,
    metaDescription,
    h1s: h1s.slice(0, 5),
    h1Count: h1s.length,
    subheads,
    lang: tags.find((t) => t.name === 'html')?.attrs.lang ?? null,
    viewport: Boolean(viewport && /width\s*=\s*device-width/i.test(viewport)),
    viewportBlocksZoom: Boolean(viewport && /user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:\.0)?\b/i.test(viewport)),
    canonical: tags.find((t) => t.name === 'link' && /\bcanonical\b/i.test(t.attrs.rel ?? ''))?.attrs.href ?? null,
    noindex: Boolean(robots && /noindex/i.test(robots)),
    og: {
      title: metaContent(tags, 'og:title'),
      description: metaContent(tags, 'og:description'),
      image: metaContent(tags, 'og:image'),
      siteName: metaContent(tags, 'og:site_name'),
    },
    themeColor: metaContent(tags, 'theme-color'),
    favicon: tags.some((t) => t.name === 'link' && /\bicon\b/i.test(t.attrs.rel ?? '')),
    jsonLdTypes,
    hasLocalBusinessSchema: jsonLdTypes.some((t) => /LocalBusiness|Organization|Store|Restaurant|Dentist|Physician|LegalService|Attorney|HomeAndConstructionBusiness|MedicalBusiness|Plumber|Electrician|HVACBusiness|RoofingContractor/i.test(t)),
    images: { total: imgs.length, missingAlt: imgs.filter((i) => !('alt' in i.attrs) || !i.attrs.alt.trim()).length },
    links,
    scripts: scripts.length,
    externalScripts: scripts.filter((s) => s.attrs.src).length,
    stylesheets: stylesheets.length,
    htmlBytes: Buffer.byteLength(raw),
    wordCount: text ? text.split(/\s+/).length : 0,
    forms: { count: forms.length, emailFields, phoneFields },
    tech: {
      builder: tech.builder ?? [],
      cms: tech.cms ?? [],
      framework: tech.framework ?? [],
      jquery: jqueryVersion(raw),
      legacy: legacyMarkup(raw),
    },
    analytics: tech.analytics ?? [],
    chat: tech.chat ?? [],
    booking: tech.booking ?? [],
    ecommerce: tech.ecommerce ?? [],
    reviews: tech.reviews ?? [],
    crm: tech.crm ?? [],
    formBuilders: tech.forms ?? [],
    appStore: /apps\.apple\.com\/[a-z-]*\/?app\/|itunes\.apple\.com\/[a-z-]*\/?app\//i.test(raw),
    playStore: /play\.google\.com\/store\/apps\/details/i.test(raw),
    social,
    ctas,
    login: hasText(/\b(?:log ?in|sign ?in|member (?:login|portal|area)|client portal|patient portal|customer portal|my account)\b/i, actionText) || /\/(?:login|signin|my-account|portal)\b/i.test(hrefs),
    loyalty: /\b(?:loyalty|rewards? program|earn points|reward points|punch card|vip club)\b/i.test(text),
    membership: /\b(?:memberships?|become a member|join (?:now|today|the club)|unlimited classes|class packs?)\b/i.test(text),
    ordering: /\b(?:order online|order now|online ordering|order (?:for )?pickup|order delivery)\b/i.test(`${text} ${actionText}`),
    multiLocation: /\b(?:our locations|find a location|all locations|\d+ locations)\b/i.test(`${text} ${actionText}`),
    copyrightYear: copyrightYear(text),
    mixedContent,
    emails: extractEmails(raw, text),
    phones: extractPhones(raw, text),
    contactUrl: contactLink?.abs ?? null,
    navItems: uniq(
      anchors
        .map((a) => a.text)
        .filter((t) => t && t.length >= 3 && t.length <= 32 && !GENERIC_NAV.has(t.toLowerCase()) && !/^\(?\d/.test(t)),
    ).slice(0, 25),
    jsonLd: jsonLd.slice(0, 5),
  };
}
