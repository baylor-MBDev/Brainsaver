// Static site generator for the Mockingbird website. Reads business facts from
// mockingbird.config.js, page copy from site/content.js, and blog posts from
// content/blog/*.md, and writes a deployable site to site/dist/.
//
//   node site/build.js [--drafts] [--out <dir>]

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { ROOT } from '../engine/lib/env.js';
import { log } from '../engine/lib/log.js';
import siteCopy from './content.js';
import { faviconSvg } from './lib/brand.js';
import { headersFile, llmsTxt, robotsTxt, rssXml, sitemapXml, webManifest } from './lib/feeds.js';
import { renderDocument } from './lib/layout.js';
import { loadPosts } from './lib/posts.js';
import { absoluteUrl } from './lib/seo.js';
import { themeCss } from './lib/theme.js';
import aboutPage from './pages/about.js';
import auditPage from './pages/audit.js';
import blogPages from './pages/blog.js';
import contactPage from './pages/contact.js';
import homePage from './pages/home.js';
import servicePages from './pages/services.js';
import { notFoundPage, privacyPage, thanksPage } from './pages/simple.js';
import workPage from './pages/work.js';

const SITE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUT_DIR = path.join(SITE_DIR, 'dist');
export const DEFAULT_CONTENT_DIR = path.join(ROOT, 'content', 'blog');

export async function buildSite({ config, outDir = DEFAULT_OUT_DIR, contentDir = DEFAULT_CONTENT_DIR, includeDrafts = false } = {}) {
  if (!config?.business) throw new Error('buildSite needs { config } (mockingbird.config.js)');
  if (!/^https?:\/\/[^/]+/.test(config.business.siteUrl ?? '')) {
    throw new Error('business.siteUrl in mockingbird.config.js must be a full URL like https://example.com');
  }
  outDir = path.resolve(outDir);
  assertSafeOutDir(outDir);

  const warnings = [];
  const serviceKeys = Object.keys(config.services);
  const posts = await loadPosts({ contentDir, includeDrafts, serviceKeys, warn: (msg) => warnings.push(msg) });
  for (const post of posts) post.path = `/blog/${post.slug}/`;

  const services = serviceKeys.map((key) => ({ key, ...config.services[key], path: `/${config.services[key].slug || key}/` }));
  const copy = siteCopy(config);

  // Content-hashed filenames, so /assets/* can be cached for a year (_headers).
  const css = minifyCss(`${themeCss(config.brand)}\n${await readFile(path.join(SITE_DIR, 'assets', 'site.css'), 'utf8')}`);
  const js = await readFile(path.join(SITE_DIR, 'assets', 'site.js'), 'utf8');
  const assets = { css: `/assets/site.${hash(css)}.css`, js: `/assets/site.${hash(js)}.js` };

  const ctx = {
    config,
    copy,
    posts,
    services,
    assets,
    year: new Date().getFullYear(),
    ogImage: copy.ogImage || null,
    url: (pathname) => absoluteUrl(config.business.siteUrl, pathname),
    serviceByKey: (key) => services.find((s) => s.key === key) ?? null,
  };

  const pages = [
    homePage(ctx),
    ...servicePages(ctx),
    workPage(ctx),
    aboutPage(ctx),
    contactPage(ctx),
    auditPage(ctx),
    thanksPage(ctx),
    ...blogPages(ctx),
    privacyPage(ctx),
    notFoundPage(ctx),
  ];
  const seen = new Set();
  for (const page of pages) {
    if (seen.has(page.path)) throw new Error(`Two pages want the same URL: ${page.path} (check service slugs and post slugs)`);
    seen.add(page.path);
    const post = posts.find((p) => p.path === page.path);
    if (post) page.lastmod = post.updated ?? post.date;
  }

  await rm(outDir, { recursive: true, force: true });
  const write = async (rel, content) => {
    const file = path.join(outDir, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  };

  for (const page of pages) await write(page.file ?? path.join(page.path, 'index.html'), renderDocument(ctx, page));
  await write(assets.css, css);
  await write(assets.js, js);
  await write('favicon.svg', faviconSvg(config.brand.colors));
  await write('site.webmanifest', webManifest(ctx));
  await write('sitemap.xml', sitemapXml(ctx, pages));
  await write('robots.txt', robotsTxt(ctx));
  await write('rss.xml', rssXml(ctx));
  await write('llms.txt', llmsTxt(ctx));
  await write('_headers', headersFile());

  return { pages: pages.map((p) => p.path), posts: posts.map((p) => p.slug), warnings };
}

// The build starts by deleting outDir, so refuse anything that looks like a
// project or system directory rather than a build folder.
function assertSafeOutDir(outDir) {
  const forbidden = [path.parse(outDir).root, os.homedir(), ROOT, SITE_DIR, path.join(ROOT, 'content')];
  if (forbidden.includes(outDir) || ROOT.startsWith(`${outDir}${path.sep}`)) {
    throw new Error(`Refusing to clean ${outDir}: pick a dedicated build directory`);
  }
}

const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 10);

// Comment and whitespace removal only: safe for any CSS, and enough that
// Lighthouse doesn't flag the file as unminified.
function minifyCss(css) {
  const out = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
  return `${out}\n`;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const { values } = parseArgs({ options: { drafts: { type: 'boolean', default: false }, out: { type: 'string' } } });
  const outDir = values.out ? path.resolve(values.out) : DEFAULT_OUT_DIR;
  const started = performance.now();
  try {
    const { default: config } = await import('../mockingbird.config.js');
    const result = await buildSite({ config, outDir, includeDrafts: values.drafts });
    for (const warning of result.warnings) log.warn(warning);
    const drafts = values.drafts ? ' including drafts' : '';
    log.ok(`Built ${result.pages.length} pages and ${result.posts.length} blog posts${drafts} into ${path.relative(process.cwd(), outDir) || '.'} (${Math.round(performance.now() - started)}ms)`);
  } catch (err) {
    log.error(err.message);
    process.exitCode = 1;
  }
}
