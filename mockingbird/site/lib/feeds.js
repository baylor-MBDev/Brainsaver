import { xmlEscape } from './html.js';
import { INLINE_SCRIPT_HASH } from './layout.js';

// Non-HTML files at the root of dist/: sitemap, RSS, robots, llms.txt,
// Cloudflare _headers, and the web manifest.

export function sitemapXml(ctx, pages) {
  const urls = pages
    .filter((p) => !p.noindex && !p.file)
    .map((p) => `  <url><loc>${xmlEscape(ctx.url(p.path))}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function robotsTxt(ctx) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${ctx.url('/sitemap.xml')}\n`;
}

const rfc822 = (iso) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toUTCString();

export function rssXml(ctx) {
  const { business } = ctx.config;
  const posts = ctx.posts.slice(0, 20);
  const items = posts.map(
    (post) => `    <item>
      <title>${xmlEscape(post.title)}</title>
      <link>${xmlEscape(ctx.url(post.path))}</link>
      <guid isPermaLink="true">${xmlEscape(ctx.url(post.path))}</guid>
      <pubDate>${rfc822(post.date)}</pubDate>
${post.description ? `      <description>${xmlEscape(post.description)}</description>\n` : ''}${post.tags.map((t) => `      <category>${xmlEscape(t.label)}</category>\n`).join('')}    </item>`,
  );
  // lastBuildDate follows the newest post (not the clock) so rebuilding
  // unchanged content produces an identical feed.
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(`${business.name} blog`)}</title>
    <link>${xmlEscape(ctx.url('/blog/'))}</link>
    <description>${xmlEscape(ctx.copy.blog.description)}</description>
    <language>en-us</language>
    <atom:link href="${xmlEscape(ctx.url('/rss.xml'))}" rel="self" type="application/rss+xml"/>
${posts.length ? `    <lastBuildDate>${rfc822(posts[0].updated ?? posts[0].date)}</lastBuildDate>\n` : ''}${items.join('\n')}${items.length ? '\n' : ''}  </channel>
</rss>
`;
}

/** llms.txt (llmstxt.org): a plain summary for AI assistants and crawlers. */
export function llmsTxt(ctx) {
  const { business } = ctx.config;
  const location = [business.city, business.region].filter(Boolean).join(', ');
  const lines = [
    `# ${business.name}`,
    '',
    `> ${business.tagline}`,
    '',
    `${business.name} is a software studio that builds three things: websites, AI automations, and mobile and web apps.${business.city ? ` Based in ${location}.` : ''} Contact: ${business.email}.`,
    '',
    '## Services',
    '',
    ...ctx.services.map((s) => `- [${s.label}](${ctx.url(s.path)}): ${s.summary}`),
    `- [Free website check-up](${ctx.url('/free-audit/')}): ${ctx.copy.audit.description}`,
    '',
    '## Studio',
    '',
    `- [Work](${ctx.url('/work/')}): ${ctx.copy.work.description}`,
    `- [About](${ctx.url('/about/')}): ${ctx.copy.about.description}`,
    `- [Contact](${ctx.url('/contact/')}): ${ctx.copy.contact.description}`,
  ];
  if (ctx.posts.length) {
    lines.push('', '## Blog', '', ...ctx.posts.slice(0, 30).map((p) => `- [${p.title}](${ctx.url(p.path)})${p.description ? `: ${p.description}` : ''}`));
  }
  lines.push('', '## Optional', '', `- [Blog index](${ctx.url('/blog/')})`, `- [RSS feed](${ctx.url('/rss.xml')})`, `- [Privacy policy](${ctx.url('/privacy/')})`);
  return `${lines.join('\n')}\n`;
}

const CSP = [
  "default-src 'self'",
  `script-src 'self' '${INLINE_SCRIPT_HASH}' https://challenges.cloudflare.com https://static.cloudflareinsights.com`,
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com https://challenges.cloudflare.com",
  'frame-src https://challenges.cloudflare.com',
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

/** Cloudflare static-asset headers. Applies to every page and asset (not
 * to Worker responses, which set their own). */
export function headersFile() {
  return `/*
  Content-Security-Policy: ${CSP}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()
  X-Frame-Options: DENY
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
}

export function webManifest(ctx) {
  const { business, brand } = ctx.config;
  return `${JSON.stringify(
    {
      name: business.name,
      short_name: business.shortName,
      description: business.tagline,
      start_url: '/',
      display: 'browser',
      background_color: brand.colors.paper,
      theme_color: brand.colors.ink,
      icons: [{ src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' }],
    },
    null,
    2,
  )}\n`;
}
