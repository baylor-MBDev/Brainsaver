import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { DEMO_SYSTEM, DemoCopySchema, demoPrompt, fallbackCopy } from './copy.js';
import { renderDemo } from './template.js';
import { getPage } from '../audit/fetchSite.js';
import { visibleText } from '../audit/html.js';
import { nowIso, slugify, toHomepageUrl, truncate } from '../lib/util.js';

// Concept homepages live in their own Cloudflare project, never in this
// (public) repo, and are noindexed: they're for one prospect each.

export async function writeDemoRootFiles(outDir) {
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await writeFile(path.join(outDir, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n');
  await writeFile(path.join(outDir, 'index.html'), '<!doctype html><meta name="robots" content="noindex"><title>Concepts</title><p>Nothing here.</p>\n');
}

async function pageTextFor(company, { fetch, timeoutMs }) {
  const url = company.audit?.finalUrl ?? toHomepageUrl(company.website);
  if (!url) return '';
  const page = await getPage(url, { fetch, timeoutMs });
  return page.ok ? truncate(visibleText(page.html), 7000) : '';
}

export async function buildDemo(company, { config, claude, outDir, fetch, timeoutMs = 20_000 }) {
  const brand = company.brand ?? company.audit?.brand ?? {};
  let copy;
  let source = 'template';
  if (claude) {
    const pageText = await pageTextFor(company, { fetch, timeoutMs });
    const { data, model } = await claude.json({
      system: DEMO_SYSTEM,
      prompt: demoPrompt({ company, brand, pageText }),
      schema: DemoCopySchema,
      effort: config.ai.effort?.demo ?? 'medium',
    });
    copy = data;
    source = model;
  } else {
    copy = fallbackCopy({ company, brand });
  }

  const slug = company.demo?.slug ?? `${slugify(company.name ?? company.id, 40) || 'concept'}-${randomBytes(2).toString('hex')}`;
  const html = renderDemo({ company, brand, copy, studio: { name: config.business.name, siteUrl: config.business.siteUrl } });
  const dir = path.join(outDir, slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html);

  const base = config.site?.demoBaseUrl?.replace(/\/$/, '');
  return { slug, file: path.join(dir, 'index.html'), url: base ? `${base}/${slug}/` : null, source, at: nowIso() };
}
