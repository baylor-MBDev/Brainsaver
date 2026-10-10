import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Marked, Renderer } from 'marked';
import { slugify, wordCount } from '../../engine/lib/util.js';
import { parseFrontmatter } from './frontmatter.js';

const WORDS_PER_MINUTE = 225;
const FAQ_HEADING = /^(frequently asked questions|faqs?|common questions)$/i;
const DATE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const markdown = new Marked({
  gfm: true,
  renderer: {
    heading(token) {
      const inner = this.parser.parseInline(token.tokens);
      const id = token.id ? ` id="${token.id}"` : '';
      return `<h${token.depth}${id}>${inner}</h${token.depth}>\n`;
    },
    // Wide tables scroll inside their own box instead of the whole page.
    table(token) {
      return `<div class="table-wrap">${Renderer.prototype.table.call(this, token)}</div>\n`;
    },
    image(token) {
      return Renderer.prototype.image.call(this, token).replace(/^<img /, '<img loading="lazy" decoding="async" ');
    },
  },
});

/** Read, parse, and render every post in `contentDir`. Newest first. */
export async function loadPosts({ contentDir, includeDrafts = false, serviceKeys = [], warn = () => {} } = {}) {
  let files;
  try {
    files = (await readdir(contentDir)).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const posts = [];
  const seen = new Map();
  for (const file of files) {
    const post = parsePost(await readFile(path.join(contentDir, file), 'utf8'), { file, serviceKeys, warn });
    if (post.draft && !includeDrafts) continue;
    if (seen.has(post.slug)) throw new Error(`${file}: slug "${post.slug}" is already used by ${seen.get(post.slug)}`);
    seen.set(post.slug, file);
    posts.push(post);
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export function parsePost(source, { file = 'post.md', serviceKeys = [], warn = () => {} } = {}) {
  let parsed;
  try {
    parsed = parseFrontmatter(source);
  } catch (err) {
    throw new Error(`${file}: ${err.message}`);
  }
  const { data, body } = parsed;
  const title = text(data.title);
  if (!title) throw new Error(`${file}: frontmatter needs a title`);
  const date = text(data.date);
  if (!DATE.test(date)) throw new Error(`${file}: frontmatter needs a date like 2026-10-10 (got "${date}")`);
  const updated = text(data.updated);
  if (updated && !DATE.test(updated)) throw new Error(`${file}: "updated" should look like 2026-10-12 (got "${updated}")`);

  // Filenames often carry a date prefix (2026-10-10-my-post.md) that
  // shouldn't end up in the URL.
  const slug = slugify(text(data.slug) || file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, ''), 80);
  if (!slug) throw new Error(`${file}: could not make a URL slug from the filename or "slug"`);

  let service = text(data.service) || null;
  if (service && serviceKeys.length && !serviceKeys.includes(service)) {
    warn(`${file}: service "${service}" is not one of ${serviceKeys.join(', ')}; ignoring it`);
    service = null;
  }

  const rendered = renderMarkdown(body, { title });
  return {
    file,
    slug,
    title,
    description: text(data.description),
    date: date.slice(0, 10),
    updated: updated ? updated.slice(0, 10) : null,
    service,
    keyword: text(data.keyword) || null,
    tags: normalizeTags(data.tags),
    draft: data.draft === true,
    author: text(data.author) || null,
    ...rendered,
  };
}

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeTags(value) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const tags = [];
  for (const raw of list) {
    const label = text(raw);
    const slug = slugify(label);
    if (slug && !tags.some((t) => t.slug === slug)) tags.push({ label, slug });
  }
  return tags;
}

/**
 * Markdown -> HTML plus what the templates need around it: H2 ids and a table
 * of contents, the FAQ section pulled out for FAQPage JSON-LD, and word count.
 */
export function renderMarkdown(body, { title = '' } = {}) {
  const tokens = markdown.lexer(String(body ?? ''));

  // The post title is the page's only <h1>; a duplicate "# Title" line is
  // dropped and any other H1 becomes an H2.
  const first = tokens.findIndex((t) => t.type !== 'space');
  if (first !== -1 && tokens[first].type === 'heading' && tokens[first].depth === 1 && sameText(tokens[first].text, title)) {
    tokens.splice(first, 1);
  }

  const used = new Set();
  const toc = [];
  let faqStart = -1;
  let faqEnd = tokens.length;
  tokens.forEach((token, i) => {
    if (token.type !== 'heading') return;
    if (token.depth === 1) token.depth = 2;
    if (token.depth !== 2) return;
    const label = plain(token.tokens);
    token.id = uniqueId(slugify(label) || 'section', used);
    toc.push({ id: token.id, text: label });
    if (faqStart !== -1 && faqEnd === tokens.length) faqEnd = i;
    if (faqStart === -1 && FAQ_HEADING.test(label)) faqStart = i;
  });

  const faq = faqStart === -1 ? [] : extractFaq(tokens.slice(faqStart + 1, faqEnd));
  const parse = (list) => markdown.parser(list);
  const html =
    faqStart === -1
      ? parse(tokens)
      : `${parse(tokens.slice(0, faqStart))}<section class="post-faq" aria-labelledby="${tokens[faqStart].id}">\n${parse(tokens.slice(faqStart, faqEnd))}</section>\n${parse(tokens.slice(faqEnd))}`;

  const words = wordCount(stripTags(html));
  return { html, toc, faq, words, readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)) };
}

function extractFaq(tokens) {
  const items = [];
  let current = null;
  for (const token of tokens) {
    if (token.type === 'heading' && token.depth >= 3) {
      current = { question: plain(token.tokens), answer: [] };
      items.push(current);
    } else if (current && token.type !== 'space') {
      current.answer.push(token);
    }
  }
  return items
    .filter((item) => item.question && item.answer.length)
    .map((item) => ({ question: item.question, answer: collapse(stripTags(markdown.parser(item.answer))) }));
}

function uniqueId(base, used) {
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

/** Plain text of inline tokens (headings), without markup. */
function plain(tokens = []) {
  return collapse(stripTags(markdown.parser([{ type: 'paragraph', tokens, text: '', raw: '' }])));
}

const sameText = (a, b) => collapse(a).toLowerCase() === collapse(b).toLowerCase();

const collapse = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

export function stripTags(htmlText) {
  return String(htmlText ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name) => ENTITIES[name])
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}
