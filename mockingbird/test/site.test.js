import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import config from '../mockingbird.config.js';
import { buildSite } from '../site/build.js';
import { memoryD1 } from '../site/dev.js';
import { parseFrontmatter } from '../site/lib/frontmatter.js';
import worker, { routes } from '../site/worker/index.js';
import { tempDir } from './helpers.js';

const POST = `---
title: "How much does a custom app cost for a small business?"
description: "What drives the cost of a custom app, and how to get a real number before you commit."
date: 2026-10-10
updated: 2026-10-12
slug: custom-app-cost-small-business
service: apps
keyword: "custom app cost"
tags: [apps, pricing]
draft: false
---
Intro paragraph about what an app costs.

## What drives the cost

Features, platforms, and integrations.

### Platforms

iPhone, Android, and web.

## How to get a real number

Start with a [scoping call](/apps/).

## Frequently asked questions

### Is a web app cheaper than a mobile app?

Usually, because there's one platform to build and no app store review.

### Can I start small?

Yes. Launch the core features first and add the rest later.
`;

const DRAFT = `---
title: Unfinished thoughts on automation
date: 2026-10-11
service: automation
draft: true
---
Not ready yet.
`;

const HYPE = /\b(leverage|cutting-edge|seamless(ly)?|elevate|unlock|revolutioni[sz]e|game-changer|world-class)\b/i;

let tmp;
let outDir;
let contentDir;
let result;
let pages; // [{ urlPath, file, html }]

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

async function readPages(dir) {
  const htmlFiles = (await walk(dir)).filter((f) => f.endsWith('.html'));
  return Promise.all(
    htmlFiles.map(async (file) => {
      const rel = `/${path.relative(dir, file).split(path.sep).join('/')}`;
      return { file, urlPath: rel.replace(/index\.html$/, ''), html: await readFile(file, 'utf8') };
    }),
  );
}

const read = (rel) => readFile(path.join(outDir, rel), 'utf8');
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const visibleText = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<head>[\s\S]*?<\/head>/, ' ').replace(/<[^>]+>/g, ' ');
const attr = (html, re) => html.match(re)?.[1];

before(async () => {
  tmp = await tempDir('mb-site-');
  outDir = path.join(tmp, 'dist');
  contentDir = path.join(tmp, 'blog');
  await mkdir(contentDir, { recursive: true });
  await writeFile(path.join(contentDir, '2026-10-10-custom-app-cost.md'), POST);
  await writeFile(path.join(contentDir, 'automation-notes.md'), DRAFT);
  result = await buildSite({ config, outDir, contentDir });
  pages = await readPages(outDir);
});

after(() => rm(tmp, { recursive: true, force: true }));

// --- frontmatter ---------------------------------------------------------------

test('frontmatter: quoted and bare strings, numbers, booleans, dates, inline arrays, lists', () => {
  const { data, body } = parseFrontmatter(`---
title: "How much does a custom app cost? \\"Real\\" numbers"
description: 'It''s a fair question'
date: 2026-10-10
updated: 2026-10-12        # optional
slug: custom-app-cost   # trailing comment
service: apps
draft: false
featured: TRUE
priority: 3
ratio: -1.5
tags: [apps, "pricing, budgets", 'small business']
keywords:
  - custom app cost
  - "app # budget"
empty:
none: []
---
Body starts here.

## Heading
`);
  assert.deepEqual(data, {
    title: 'How much does a custom app cost? "Real" numbers',
    description: "It's a fair question",
    date: '2026-10-10',
    updated: '2026-10-12',
    slug: 'custom-app-cost',
    service: 'apps',
    draft: false,
    featured: true,
    priority: 3,
    ratio: -1.5,
    tags: ['apps', 'pricing, budgets', 'small business'],
    keywords: ['custom app cost', 'app # budget'],
    empty: null,
    none: [],
  });
  assert.equal(body, 'Body starts here.\n\n## Heading\n');
});

test('frontmatter: no block means no data; malformed blocks fail loudly', () => {
  assert.deepEqual(parseFrontmatter('# Just markdown\n'), { data: {}, body: '# Just markdown\n' });
  assert.throws(() => parseFrontmatter('---\ntitle: x\n'), /never closes/);
  assert.throws(() => parseFrontmatter('---\ntitle: x\nnot a pair\n---\n'), /line 3/);
  assert.throws(() => parseFrontmatter('---\ntitle: "open\n---\n'), /unterminated/);
  assert.throws(() => parseFrontmatter('---\n- orphan\n---\n'), /without a key/);
});

// --- build --------------------------------------------------------------------

test('build: writes every page and site file', () => {
  const expected = [
    'index.html',
    'websites/index.html',
    'ai-automation/index.html',
    'apps/index.html',
    'work/index.html',
    'about/index.html',
    'contact/index.html',
    'free-audit/index.html',
    'thanks/index.html',
    'privacy/index.html',
    'blog/index.html',
    'blog/custom-app-cost-small-business/index.html',
    'blog/tag/pricing/index.html',
    '404.html',
    'sitemap.xml',
    'robots.txt',
    'rss.xml',
    'llms.txt',
    '_headers',
    'favicon.svg',
    'site.webmanifest',
  ];
  for (const rel of expected) assert.ok(existsSync(path.join(outDir, rel)), `missing ${rel}`);
  assert.ok(result.pages.includes('/free-audit/'));
  assert.ok(result.pages.includes('/404.html'));
  const assets = pages[0].html.match(/\/assets\/site\.[0-9a-f]{10}\.(css|js)/g);
  assert.ok(assets?.length >= 2, 'hashed CSS and JS are linked');
  for (const asset of assets) assert.ok(existsSync(path.join(outDir, asset)), `missing ${asset}`);
});

test('build: drafts stay out unless asked for', async () => {
  assert.deepEqual(result.posts, ['custom-app-cost-small-business']);
  assert.ok(!existsSync(path.join(outDir, 'blog/automation-notes')));
  assert.ok(!(await read('sitemap.xml')).includes('automation-notes'));
  assert.ok(!(await read('rss.xml')).includes('Unfinished thoughts'));

  const withDrafts = await buildSite({ config, outDir: path.join(tmp, 'drafts'), contentDir, includeDrafts: true });
  assert.deepEqual(withDrafts.posts, ['automation-notes', 'custom-app-cost-small-business'], 'newest first');
});

test('build: sitemap lists service pages and posts, never noindex pages', async () => {
  const sitemap = await read('sitemap.xml');
  for (const p of ['/', '/websites/', '/ai-automation/', '/apps/', '/work/', '/about/', '/contact/', '/free-audit/', '/blog/', '/privacy/']) {
    assert.ok(sitemap.includes(`<loc>https://mockingbird.dev${p}</loc>`), `sitemap missing ${p}`);
  }
  assert.match(sitemap, /<loc>https:\/\/mockingbird\.dev\/blog\/custom-app-cost-small-business\/<\/loc><lastmod>2026-10-12<\/lastmod>/);
  assert.ok(!sitemap.includes('/thanks/'));
  assert.ok(!sitemap.includes('404'));
  assert.ok(!sitemap.includes('/blog/tag/'));
  assert.match(await read('robots.txt'), /^User-agent: \*\nAllow: \/\n\nSitemap: https:\/\/mockingbird\.dev\/sitemap\.xml\n$/);
  const llms = await read('llms.txt');
  assert.match(llms, /^# Mockingbird Software Development\n\n> /);
  assert.match(llms, /\[Free website check-up\]\(https:\/\/mockingbird\.dev\/free-audit\/\)/);
  assert.match(llms, /\[How much does a custom app cost/);
  const rss = await read('rss.xml');
  assert.match(rss, /<guid isPermaLink="true">https:\/\/mockingbird\.dev\/blog\/custom-app-cost-small-business\/<\/guid>/);
});

test('post page: canonical, BlogPosting, BreadcrumbList, FAQPage, and a table of contents', async () => {
  const html = await read('blog/custom-app-cost-small-business/index.html');
  assert.equal(attr(html, /<link rel="canonical" href="([^"]+)">/), 'https://mockingbird.dev/blog/custom-app-cost-small-business/');
  assert.match(html, /<meta property="og:type" content="article">/);

  const ld = jsonLd(html);
  const byType = Object.fromEntries(ld.map((d) => [d['@type'], d]));
  assert.ok(byType.BlogPosting, 'BlogPosting');
  assert.equal(byType.BlogPosting.headline, 'How much does a custom app cost for a small business?');
  assert.equal(byType.BlogPosting.datePublished, '2026-10-10');
  assert.equal(byType.BlogPosting.dateModified, '2026-10-12');
  assert.equal(byType.BlogPosting.mainEntityOfPage['@id'], 'https://mockingbird.dev/blog/custom-app-cost-small-business/');
  assert.deepEqual(byType.BreadcrumbList.itemListElement.map((i) => i.name), ['Home', 'Blog', 'How much does a custom app cost for a small business?']);
  assert.deepEqual(
    byType.FAQPage.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]),
    [
      ['Is a web app cheaper than a mobile app?', "Usually, because there's one platform to build and no app store review."],
      ['Can I start small?', 'Yes. Launch the core features first and add the rest later.'],
    ],
  );

  for (const id of ['what-drives-the-cost', 'how-to-get-a-real-number', 'frequently-asked-questions']) {
    assert.match(html, new RegExp(`<h2 id="${id}">`));
    assert.match(html, new RegExp(`<a href="#${id}">`), `TOC links to #${id}`);
  }
  assert.match(html, /<section class="post-faq" aria-labelledby="frequently-asked-questions">/);
  assert.match(html, /1 min read/);
  assert.match(html, /class="post-meta">[^\n]*<a href="\/apps\/">Apps<\/a>/, 'links to its service page');
});

test('every page: one h1, unique title and description, canonical, no leaked placeholders', () => {
  const titles = new Map();
  const descriptions = new Map();
  for (const { urlPath, html } of pages) {
    assert.match(html, /^<!doctype html>\n<html lang="en">/, urlPath);
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1, `${urlPath} should have exactly one <h1>`);
    const title = attr(html, /<title>([^<]+)<\/title>/);
    const description = attr(html, /<meta name="description" content="([^"]+)">/);
    assert.ok(title && description, `${urlPath} has a title and description`);
    assert.ok(!titles.has(title), `${urlPath} repeats the title of ${titles.get(title)}`);
    assert.ok(!descriptions.has(description), `${urlPath} repeats the description of ${descriptions.get(description)}`);
    titles.set(title, urlPath);
    descriptions.set(description, urlPath);
    if (urlPath !== '/404.html') assert.equal(attr(html, /<link rel="canonical" href="([^"]+)">/), `https://mockingbird.dev${urlPath}`);
    assert.match(html, /<meta property="og:title" content="[^"]+">/);
    assert.match(html, /<meta name="twitter:card" content="summary">/);
    for (const bad of [/\bundefined\b/, /\bnull\b/, /\bNaN\b/, /\[object Object\]/, /based in\s*,/i, /\bBased in\s*\./]) {
      assert.ok(!bad.test(html), `${urlPath} contains ${bad}`);
    }
    assert.ok(!HYPE.test(visibleText(html)), `${urlPath} uses a hype word: ${visibleText(html).match(HYPE)?.[0]}`);
    for (const block of jsonLd(html)) assert.equal(block['@context'], 'https://schema.org');
  }
  assert.ok(pages.length >= 15);
});

test('every internal link and asset resolves to a built file', () => {
  const missing = [];
  for (const { urlPath, html } of pages) {
    for (const [, rawHref] of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      const href = rawHref.replace(/&amp;/g, '&');
      if (/^(https?:|mailto:|tel:|data:)/.test(href) || href.startsWith('//')) continue;
      if (href.startsWith('#')) {
        if (!html.includes(`id="${href.slice(1)}"`)) missing.push(`${urlPath} -> ${href} (no such id)`);
        continue;
      }
      const { pathname } = new URL(href, `https://mockingbird.dev${urlPath}`);
      const file = path.join(outDir, decodeURIComponent(pathname), pathname.endsWith('/') ? 'index.html' : '');
      if (!existsSync(file)) missing.push(`${urlPath} -> ${href}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('home page: structured data from config, services, proof, and the free audit', async () => {
  const html = await read('index.html');
  const org = jsonLd(html).find((d) => d['@type'] === 'ProfessionalService');
  assert.equal(org.name, 'Mockingbird Software Development');
  assert.equal(org.url, 'https://mockingbird.dev/');
  assert.equal(org.email, 'hello@mockingbird.dev');
  assert.deepEqual(org.sameAs, ['https://github.com/baylor-MBDev']);
  assert.ok(org.areaServed);
  assert.ok(!('telephone' in org), 'empty phone is left out');
  assert.ok(jsonLd(html).some((d) => d['@type'] === 'FAQPage'));
  assert.ok(html.includes(config.business.tagline));
  for (const s of Object.values(config.services)) {
    assert.ok(html.includes(`href="/${s.slug}/"`), `links to /${s.slug}/`);
    assert.ok(html.includes(s.headline));
  }
  assert.match(html, /DOOMTYPE/);
  assert.match(html, /href="\/free-audit\/"/);
  assert.match(html, /<a class="btn btn-primary" href="\/contact\/">Book a free call/, 'no calendar configured, so the call CTA goes to /contact/');

  const websites = await read('websites/index.html');
  assert.match(websites, /href="\/free-audit\/"/, 'websites page links the free audit');
  assert.match(websites, /Get a free homepage concept built from your current site/);
  assert.equal(jsonLd(websites).find((d) => d['@type'] === 'Service').name, 'Websites');
  assert.ok(!(await read('apps/index.html')).includes('/free-audit/">Get a free website check-up instead'));
  assert.match(await read('apps/index.html'), /DOOMTYPE/, 'apps page shows apps proof');
  assert.ok(!websites.includes('DOOMTYPE'), 'no unrelated proof on the websites page');

  const audit = await read('free-audit/index.html');
  assert.match(audit, /<input type="hidden" name="type" value="audit">/);
  assert.match(audit, /name="website" required/);
  assert.match(await read('contact/index.html'), /<input type="hidden" name="type" value="contact">/);
});

test('optional config fields show up when set and leave no trace when empty', async () => {
  const defaults = await read('contact/index.html');
  assert.ok(!defaults.includes('challenges.cloudflare.com/turnstile'), 'no Turnstile without a site key');
  assert.ok(!defaults.includes('cloudflareinsights'), 'no analytics without a token');
  assert.ok(!defaults.includes('tel:'));

  const full = structuredClone(config);
  Object.assign(full.business, { city: 'Waco', phone: '(254) 555-0100', calendarUrl: 'https://cal.example.com/mockingbird', postalAddress: '1 Example St, Waco, TX 76701' });
  full.business.social.linkedin = 'https://www.linkedin.com/company/example';
  Object.assign(full.site, { analyticsToken: 'test-token', turnstileSiteKey: '1x00000000000000000000AA' });
  const dir = path.join(tmp, 'full');
  await buildSite({ config: full, outDir: dir, contentDir });
  const get = (rel) => readFile(path.join(dir, rel), 'utf8');

  const home = await get('index.html');
  assert.match(home, /Based in Waco, TX\./);
  assert.match(home, /href="tel:2545550100"/);
  assert.match(home, /<a class="btn btn-primary" href="https:\/\/cal\.example\.com\/mockingbird">Book a free call/);
  assert.match(home, /1 Example St, Waco, TX 76701/);
  assert.match(home, /static\.cloudflareinsights\.com\/beacon\.min\.js" data-cf-beacon="\{&quot;token&quot;:&quot;test-token&quot;\}"/);
  assert.ok(!home.includes('turnstile/v0/api.js'), 'Turnstile only loads on form pages');
  const org = jsonLd(home).find((d) => d['@type'] === 'ProfessionalService');
  assert.equal(org.telephone, '(254) 555-0100');
  assert.equal(org.address.addressLocality, 'Waco');
  assert.equal(org.sameAs.length, 2);

  for (const rel of ['contact/index.html', 'free-audit/index.html']) {
    const page = await get(rel);
    assert.match(page, /<script src="https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js" async defer><\/script>/);
    assert.match(page, /<div class="cf-turnstile" data-sitekey="1x00000000000000000000AA"/);
  }
  const privacy = await get('privacy/index.html');
  assert.match(privacy, /Cloudflare Turnstile/);
  assert.match(privacy, /Cloudflare Web Analytics/);
  assert.ok(!(await read('privacy/index.html')).includes('Cloudflare Web Analytics'), 'default build makes no analytics claim');
});

test('a missing content folder builds an empty blog', async () => {
  const dir = path.join(tmp, 'empty');
  const empty = await buildSite({ config, outDir: dir, contentDir: path.join(tmp, 'does-not-exist') });
  assert.deepEqual(empty.posts, []);
  const blog = await readFile(path.join(dir, 'blog/index.html'), 'utf8');
  assert.match(blog, /No posts yet/);
  assert.ok(!(await readFile(path.join(dir, 'rss.xml'), 'utf8')).includes('<item>'));
  assert.ok(!(await readFile(path.join(dir, 'index.html'), 'utf8')).includes('From the blog'));
});

test('_headers: CSP allows fonts, Turnstile, and analytics, and pins the inline script', async () => {
  const headers = await read('_headers');
  const csp = attr(headers, /Content-Security-Policy: (.+)/);
  assert.match(csp, /script-src 'self' 'sha256-[A-Za-z0-9+/=]+' https:\/\/challenges\.cloudflare\.com https:\/\/static\.cloudflareinsights\.com/);
  assert.match(csp, /style-src 'self' https:\/\/fonts\.googleapis\.com/);
  assert.match(csp, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
  assert.match(csp, /frame-src https:\/\/challenges\.cloudflare\.com/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
  assert.match(headers, /Permissions-Policy: /);
  assert.match(headers, /\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);

  // The CSP hash must match the inline script actually on the page.
  const html = await read('index.html');
  const inline = html.match(/<script>([^<]+)<\/script>/)[1];
  const hash = createHash('sha256').update(inline).digest('base64');
  assert.ok(csp.includes(`'sha256-${hash}'`));
  assert.ok(!/\sstyle="/.test(html) && !/\son[a-z]+="/.test(html), 'no inline styles or handlers the CSP would block');
});

// --- worker -----------------------------------------------------------------

const VALID = { type: 'contact', name: 'Dana Example', email: 'dana@example.com', company: 'Example Plumbing', website: 'example.com', service: 'websites', budget: 'Not sure yet', message: 'Our site is slow on phones.' };
const AUDIT = { type: 'audit', website: 'example.com', name: 'Sam Example', email: 'sam@example.com', business_type: 'plumbing' };

function makeEnv(overrides = {}) {
  const sent = [];
  return {
    DB: memoryD1(),
    NOTIFY: {
      async send(message) {
        sent.push(message);
      },
    },
    NOTIFY_TO: 'owner@example.com',
    NOTIFY_FROM: 'site@example.com',
    ASSETS: { fetch: async (request) => new Response(`asset ${new URL(request.url).pathname}`) },
    sent,
    ...overrides,
  };
}

function post(fields, { json = false, headers = {}, url = 'https://mockingbird.dev/api/contact' } = {}) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': json ? 'application/json' : 'application/x-www-form-urlencoded',
      'cf-connecting-ip': '203.0.113.9',
      referer: 'https://mockingbird.dev/contact/?utm_source=newsletter&utm_campaign=fall',
      'user-agent': 'TestBrowser/1.0',
      ...headers,
    },
    body: json ? JSON.stringify(fields) : new URLSearchParams(fields).toString(),
  });
}

const leads = (env) => env.DB.rows('inbound_leads');

test('worker: a valid contact form is stored and the owner is emailed', async () => {
  const env = makeEnv();
  const res = await worker.fetch(post(VALID), env, {});
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), 'https://mockingbird.dev/thanks/');

  const [row] = leads(env);
  assert.equal(leads(env).length, 1);
  assert.match(row.id, /^[0-9a-f-]{36}$/);
  assert.ok(!Number.isNaN(Date.parse(row.created_at)));
  assert.equal(row.type, 'contact');
  assert.equal(row.name, 'Dana Example');
  assert.equal(row.email, 'dana@example.com');
  assert.equal(row.company, 'Example Plumbing');
  assert.equal(row.service, 'websites');
  assert.equal(row.message, 'Our site is slow on phones.');
  assert.equal(row.business_type, null);
  assert.equal(row.page, '/contact/');
  assert.equal(row.utm_source, 'newsletter', 'falls back to the campaign tags on the referring page');
  assert.equal(row.utm_campaign, 'fall');
  assert.equal(row.utm_medium, null);
  assert.equal(row.ip_hash, createHash('sha256').update('203.0.113.9').digest('hex'));
  assert.ok(!Object.values(row).includes('203.0.113.9'), 'the raw IP is never stored');
  assert.equal(row.user_agent, 'TestBrowser/1.0');

  assert.equal(env.sent.length, 1);
  const [mail] = env.sent;
  assert.equal(mail.to, 'owner@example.com');
  assert.equal(mail.from, 'site@example.com');
  assert.equal(mail.replyTo, 'dana@example.com');
  assert.equal(mail.subject, 'New inquiry: websites from Dana Example');
  assert.match(mail.text, /Our site is slow on phones\./);
  assert.match(mail.text, /Email: dana@example\.com/);
});

test('worker: JSON requests get JSON back; form utm fields win over the referrer', async () => {
  const env = makeEnv();
  const res = await worker.fetch(post({ ...VALID, utm_source: 'linkedin', utm_medium: 'social' }, { json: true }), env, {});
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(leads(env)[0].utm_source, 'linkedin');
  assert.equal(leads(env)[0].utm_medium, 'social');

  const accept = await worker.fetch(post(VALID, { headers: { accept: 'application/json' } }), makeEnv(), {});
  assert.deepEqual(await accept.json(), { ok: true });
});

test('worker: honeypot submissions look successful but store and send nothing', async () => {
  const env = makeEnv();
  const res = await worker.fetch(post({ ...VALID, company_url: 'http://spam.example' }, { json: true }), env, {});
  assert.deepEqual(await res.json(), { ok: true });
  const redirect = await worker.fetch(post({ ...VALID, company_url: 'x' }), env, {});
  assert.equal(redirect.headers.get('location'), 'https://mockingbird.dev/thanks/');
  assert.equal(leads(env).length, 0);
  assert.equal(env.sent.length, 0);
});

test('worker: validation errors in JSON and redirect modes', async () => {
  const env = makeEnv();
  const missing = await worker.fetch(post({ ...VALID, message: '  ' }, { json: true }), env, {});
  assert.equal(missing.status, 400);
  assert.deepEqual(await missing.json(), { ok: false, error: 'Please add a message.' });

  const several = await worker.fetch(post({ type: 'contact' }, { json: true }), env, {});
  assert.equal((await several.json()).error, 'Please add your name, your email, and a message.');

  const email = await worker.fetch(post({ ...VALID, email: 'dana@' }, { json: true }), env, {});
  assert.match((await email.json()).error, /email address/);

  const long = await worker.fetch(post({ ...VALID, message: 'x'.repeat(5001) }, { json: true }), env, {});
  assert.equal(long.status, 400);
  assert.match((await long.json()).error, /Message is too long \(5000/);

  const type = await worker.fetch(post({ ...VALID, type: 'newsletter' }, { json: true }), env, {});
  assert.equal(type.status, 400);

  const form = await worker.fetch(post({ ...VALID, email: '' }), env, {});
  assert.equal(form.status, 303);
  assert.equal(form.headers.get('location'), 'https://mockingbird.dev/contact/?error=invalid#contact-error-invalid');

  const bad = await worker.fetch(new Request('https://mockingbird.dev/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' }), env, {});
  assert.equal(bad.status, 400);
  assert.equal(leads(env).length, 0);
  assert.equal(env.sent.length, 0);
});

test('worker: free audit requests need a website, not a message', async () => {
  const env = makeEnv();
  const res = await worker.fetch(post(AUDIT, { headers: { referer: 'https://mockingbird.dev/free-audit/' } }), env, {});
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), 'https://mockingbird.dev/thanks/');
  const [row] = leads(env);
  assert.equal(row.type, 'audit');
  assert.equal(row.website, 'example.com');
  assert.equal(row.business_type, 'plumbing');
  assert.equal(row.service, 'websites');
  assert.equal(row.message, null);
  assert.equal(row.page, '/free-audit/');
  assert.equal(env.sent[0].subject, 'Free audit request: example.com');
  assert.equal(env.sent[0].replyTo, 'sam@example.com');

  const noSite = await worker.fetch(post({ ...AUDIT, website: '' }, { json: true }), env, {});
  assert.equal(noSite.status, 400);
  assert.equal((await noSite.json()).error, 'Please add your website.');
  const badSite = await worker.fetch(post({ ...AUDIT, website: 'not a website' }, { json: true }), env, {});
  assert.match((await badSite.json()).error, /website address/);
  const redirect = await worker.fetch(post({ ...AUDIT, website: '' }), env, {});
  assert.equal(redirect.headers.get('location'), 'https://mockingbird.dev/free-audit/?error=invalid#audit-error-invalid');
  assert.equal(leads(env).length, 1);
});

test('worker: verifies Turnstile when the secret is set', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const calls = [];
  let success = true;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(success ? { success: true } : { success: false, 'error-codes': ['invalid-input-response'] });
  });
  const env = makeEnv({ TURNSTILE_SECRET_KEY: 'test-secret' });

  const ok = await worker.fetch(post({ ...VALID, 'cf-turnstile-response': 'token-123' }, { json: true }), env, {});
  assert.deepEqual(await ok.json(), { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(calls[0].init.method, 'POST');
  const sent = new URLSearchParams(calls[0].init.body);
  assert.equal(sent.get('secret'), 'test-secret');
  assert.equal(sent.get('response'), 'token-123');
  assert.equal(sent.get('remoteip'), '203.0.113.9');
  assert.equal(leads(env).length, 1);

  success = false;
  const rejected = await worker.fetch(post({ ...VALID, 'cf-turnstile-response': 'forged' }, { json: true }), env, {});
  assert.equal(rejected.status, 403);
  assert.equal((await rejected.json()).ok, false);
  const redirect = await worker.fetch(post({ ...VALID, 'cf-turnstile-response': 'forged' }), env, {});
  assert.equal(redirect.headers.get('location'), 'https://mockingbird.dev/contact/?error=spam#contact-error-spam');

  const callsBefore = calls.length;
  const noToken = await worker.fetch(post(VALID, { json: true }), env, {});
  assert.equal(noToken.status, 403);
  assert.equal(calls.length, callsBefore, 'no token, no siteverify call');
  assert.equal(leads(env).length, 1, 'nothing stored after a failed check');
});

test('worker: a failed notification never loses the lead', async (t) => {
  const errors = t.mock.method(console, 'error', () => {});
  const env = makeEnv({
    NOTIFY: {
      async send() {
        throw new Error('destination address not verified');
      },
    },
  });
  const res = await worker.fetch(post(VALID, { json: true }), env, {});
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(leads(env).length, 1);
  assert.equal(errors.mock.callCount(), 1, 'the failure is logged');
});

test('worker: a storage failure is survivable if the email goes out, fatal if not', async (t) => {
  t.mock.method(console, 'error', () => {});
  const brokenDb = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('D1 is down'); } }) }) };

  const emailed = makeEnv({ DB: brokenDb });
  const ok = await worker.fetch(post(VALID, { json: true }), emailed, {});
  assert.deepEqual(await ok.json(), { ok: true });
  assert.equal(emailed.sent.length, 1);

  const lost = await worker.fetch(post(VALID, { json: true }), makeEnv({ DB: brokenDb, NOTIFY: undefined }), {});
  assert.equal(lost.status, 500);
  assert.equal((await lost.json()).ok, false);
  const redirect = await worker.fetch(post(VALID), makeEnv({ DB: brokenDb, NOTIFY: undefined }), {});
  assert.equal(redirect.headers.get('location'), 'https://mockingbird.dev/contact/?error=server#contact-error-server');
});

test('worker: routing, unknown API paths, and asset delegation', async () => {
  assert.equal(typeof routes['/api/contact'].POST, 'function');
  const env = makeEnv();

  const unknown = await worker.fetch(new Request('https://mockingbird.dev/api/nope', { method: 'POST' }), env, {});
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { ok: false, error: 'Not found' });

  const wrongMethod = await worker.fetch(new Request('https://mockingbird.dev/api/contact'), env, {});
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'POST');

  const page = await worker.fetch(new Request('https://mockingbird.dev/about/'), env, {});
  assert.equal(page.status, 200);
  assert.equal(await page.text(), 'asset /about/');

  const crossSite = await worker.fetch(post(VALID, { json: true, headers: { origin: 'https://evil.example' } }), env, {});
  assert.equal(crossSite.status, 403);
  assert.equal(leads(env).length, 0);
});
