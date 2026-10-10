import { createHash } from 'node:crypto';
import { mark } from './brand.js';
import { html, jsonLdScript, raw } from './html.js';
import { googleFontsUrl } from './theme.js';

// The only inline script on the site. It runs before first paint so the
// mobile menu can start collapsed without a flash, and it switches the
// non-blocking font stylesheet on once loaded. Its hash goes in the CSP.
export const INLINE_SCRIPT =
  "document.documentElement.classList.add('js');var f=document.getElementById('fonts');if(f){if(f.sheet)f.media='all';else f.addEventListener('load',function(){f.media='all'})}";

export const INLINE_SCRIPT_HASH = `sha256-${createHash('sha256').update(INLINE_SCRIPT).digest('base64')}`;

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

function twitterHandle(url) {
  const match = String(url ?? '').match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})\/?$/);
  return match ? `@${match[1]}` : null;
}

/**
 * page: { path, title, description, body, jsonLd: [], noindex, ogType,
 *         article: { published, modified, tags }, turnstile, fullTitle }
 */
export function renderDocument(ctx, page) {
  const { config, copy } = ctx;
  const { business } = config;
  const canonical = ctx.url(page.path);
  const title = page.fullTitle ?? `${page.title} | ${business.shortName}`;
  const fonts = googleFontsUrl(config.brand);
  const ogImage = copy.ogImage ? ctx.url(copy.ogImage) : null;
  const handle = twitterHandle(business.social?.x);
  const article = page.article;

  const doc = html`<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${page.description}">
${!page.noCanonical && html`<link rel="canonical" href="${canonical}">\n`}${page.noindex && raw('<meta name="robots" content="noindex, follow">\n')}<meta property="og:type" content="${page.ogType ?? 'website'}">
<meta property="og:site_name" content="${business.name}">
<meta property="og:title" content="${page.title}">
<meta property="og:description" content="${page.description}">
${!page.noCanonical && html`<meta property="og:url" content="${canonical}">\n`}<meta property="og:locale" content="en_US">
${ogImage && html`<meta property="og:image" content="${ogImage}">\n`}${article && html`<meta property="article:published_time" content="${article.published}">
<meta property="article:modified_time" content="${article.modified}">
${article.tags.map((tag) => html`<meta property="article:tag" content="${tag}">\n`)}`}<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${page.title}">
<meta name="twitter:description" content="${page.description}">
${handle && html`<meta name="twitter:site" content="${handle}">\n`}<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${config.brand.colors.paper}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${config.brand.colors.ink}" media="(prefers-color-scheme: dark)">
<link rel="alternate" type="application/rss+xml" title="${business.shortName} blog" href="${ctx.url('/rss.xml')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${ctx.assets.css}">
<link rel="stylesheet" href="${fonts}" media="print" id="fonts">
<script>${raw(INLINE_SCRIPT)}</script>
<noscript><link rel="stylesheet" href="${fonts}"></noscript>
<script src="${ctx.assets.js}" defer></script>
${page.turnstile && config.site?.turnstileSiteKey && html`<script src="${TURNSTILE_SCRIPT}" async defer></script>\n`}${(page.jsonLd ?? []).filter(Boolean).map((data) => html`${jsonLdScript(data)}\n`)}</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${header(ctx, page)}
<main id="main" tabindex="-1">
${page.body}
</main>
${footer(ctx)}
${config.site?.analyticsToken && html`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="${JSON.stringify({ token: config.site.analyticsToken })}"></script>\n`}</body>
</html>
`;
  return `<!doctype html>\n${doc}`;
}

export function bookLink(ctx) {
  const url = ctx.config.business.calendarUrl;
  return url ? { href: url, external: true } : { href: '/contact/', external: false };
}

function header(ctx, page) {
  const { copy } = ctx;
  const book = bookLink(ctx);
  const items = [...ctx.services.map((s) => ({ label: s.label, path: s.path })), { label: 'Work', path: '/work/' }, { label: 'About', path: '/about/' }, { label: 'Blog', path: '/blog/' }];
  const current = (path) => page.path === path || (path === '/blog/' && page.path.startsWith('/blog/'));
  return html`<header class="site-header">
<div class="wrap header-inner">
<a class="brand" href="/">${mark({ className: 'mark brand-mark' })}<span>${ctx.config.business.shortName}</span></a>
<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="nav-toggle-bars" aria-hidden="true"></span><span class="nav-toggle-label">Menu</span></button>
<nav class="site-nav" id="site-nav" aria-label="Main">
<ul class="nav-list" role="list">
${items.map((item) => html`<li><a href="${item.path}"${current(item.path) && raw(' aria-current="page"')}>${item.label}</a></li>\n`)}</ul>
<a class="btn btn-primary btn-sm nav-cta" href="${book.href}">${copy.cta.book}</a>
</nav>
</div>
</header>`;
}

function footer(ctx) {
  const { config, copy } = ctx;
  const { business } = config;
  const location = [business.city, business.region].filter(Boolean).join(', ');
  const socials = [
    ['GitHub', business.social?.github],
    ['LinkedIn', business.social?.linkedin],
    ['X', business.social?.x],
    ['Instagram', business.social?.instagram],
  ].filter(([, url]) => url);
  const book = bookLink(ctx);
  return html`<footer class="site-footer">
<div class="wrap">
<div class="footer-grid">
<div class="footer-brand">
<a class="brand" href="/">${mark({ className: 'mark brand-mark' })}<span>${business.shortName}</span></a>
<p class="footer-blurb">${business.tagline}</p>
${business.city && html`<p class="footer-blurb">Based in ${location}.</p>\n`}</div>
<nav class="footer-col" aria-labelledby="footer-services">
<h2 class="footer-title" id="footer-services">Services</h2>
<ul role="list">
${ctx.services.map((s) => html`<li><a href="${s.path}">${s.label}</a></li>\n`)}<li><a href="/free-audit/">${copy.footer.audit}</a></li>
</ul>
</nav>
<nav class="footer-col" aria-labelledby="footer-studio">
<h2 class="footer-title" id="footer-studio">Studio</h2>
<ul role="list">
<li><a href="/work/">Work</a></li>
<li><a href="/about/">About</a></li>
<li><a href="/blog/">Blog</a></li>
<li><a href="/contact/">Contact</a></li>
</ul>
</nav>
<div class="footer-col">
<h2 class="footer-title">Get in touch</h2>
<ul role="list">
<li><a href="mailto:${business.email}">${business.email}</a></li>
${business.phone && html`<li><a href="tel:${business.phone.replace(/[^\d+]/g, '')}">${business.phone}</a></li>\n`}${book.external && html`<li><a href="${book.href}">${copy.cta.book}</a></li>\n`}${socials.map(([label, url]) => html`<li><a href="${url}" rel="me">${label}</a></li>\n`)}</ul>
</div>
</div>
<div class="footer-bottom">
<p>© ${ctx.year} ${business.name}</p>
${business.postalAddress && html`<p>${business.postalAddress}</p>\n`}<p><a href="/privacy/">Privacy</a> <span aria-hidden="true">·</span> <a href="/rss.xml">RSS</a></p>
</div>
</div>
</footer>`;
}
