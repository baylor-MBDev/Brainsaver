import { truncate } from '../../engine/lib/util.js';
import { ctaBand, formatDate, pageHead, postCards, sectionHead, sentenceCase } from '../lib/components.js';
import { html, raw } from '../lib/html.js';
import { bookLink } from '../lib/layout.js';
import { stripTags } from '../lib/posts.js';
import { blogPostingLd, breadcrumbLd, faqLd } from '../lib/seo.js';

export const PER_PAGE = 12;

export const blogPagePath = (n) => (n === 1 ? '/blog/' : `/blog/page/${n}/`);
export const tagPath = (slug) => `/blog/tag/${slug}/`;

export default function blogPages(ctx) {
  const total = Math.max(1, Math.ceil(ctx.posts.length / PER_PAGE));
  const pages = [];
  for (let n = 1; n <= total; n++) pages.push(indexPage(ctx, n, total));
  for (const post of ctx.posts) pages.push(postPage(ctx, post));
  for (const tag of allTags(ctx.posts)) pages.push(tagPage(ctx, tag));
  return pages;
}

export function allTags(posts) {
  const tags = new Map();
  for (const post of posts) {
    for (const tag of post.tags) {
      if (!tags.has(tag.slug)) tags.set(tag.slug, { ...tag, posts: [] });
      tags.get(tag.slug).posts.push(post);
    }
  }
  return [...tags.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

function indexPage(ctx, n, total) {
  const c = ctx.copy.blog;
  const posts = ctx.posts.slice((n - 1) * PER_PAGE, n * PER_PAGE);
  const body = html`${pageHead({ eyebrow: n === 1 ? c.title : `Page ${n} of ${total}`, title: c.h1, lede: n === 1 ? c.intro : null })}
<section class="section section-flush" aria-label="Posts">
<div class="wrap">
${posts.length > 0 ? postCards(posts, { headingLevel: 2 }) : html`<p class="empty">${c.empty}</p>`}
${total > 1 && pagination(n, total, c)}
</div>
</section>
${ctaBand(ctx)}`;
  return {
    path: blogPagePath(n),
    title: n === 1 ? c.title : `${c.title}, page ${n}`,
    description: n === 1 ? c.description : `${c.description} Page ${n} of ${total}.`,
    body,
  };
}

function pagination(n, total, c) {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  return html`<nav class="pagination" aria-label="Blog pages">
${n > 1 ? html`<a class="pagination-step" href="${blogPagePath(n - 1)}" rel="prev"><span aria-hidden="true">←</span> ${c.newer}</a>` : html`<span></span>`}
<ol role="list">
${pages.map((p) => html`<li>${p === n ? html`<span aria-current="page"><span class="visually-hidden">Page </span>${p}</span>` : html`<a href="${blogPagePath(p)}"><span class="visually-hidden">Page </span>${p}</a>`}</li>\n`)}</ol>
${n < total ? html`<a class="pagination-step" href="${blogPagePath(n + 1)}" rel="next">${c.older} <span aria-hidden="true">→</span></a>` : html`<span></span>`}
</nav>`;
}

function relatedPosts(posts, post, limit) {
  const tagSlugs = new Set(post.tags.map((t) => t.slug));
  const score = (p) => (post.service && p.service === post.service ? 2 : 0) + p.tags.filter((t) => tagSlugs.has(t.slug)).length;
  return posts
    .filter((p) => p.slug !== post.slug)
    .map((p, i) => ({ p, s: score(p), i }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map(({ p }) => p);
}

function postPage(ctx, post) {
  const { copy } = ctx;
  const c = copy.blog;
  const service = post.service ? ctx.serviceByKey(post.service) : null;
  const showToc = post.toc.length >= 3;
  const related = relatedPosts(ctx.posts, post, 3);
  const book = bookLink(ctx);
  const offerHref = service && (service.key !== 'websites' && book.external ? book.href : `/contact/?service=${service.key}`);

  const body = html`<article class="post" aria-labelledby="post-title">
<header class="post-head">
<div class="wrap">
<nav class="breadcrumbs" aria-label="Breadcrumb"><ol role="list"><li><a href="/">Home</a></li><li><a href="/blog/">Blog</a></li><li><span aria-current="page">${truncate(post.title, 48)}</span></li></ol></nav>
<h1 id="post-title">${post.title}</h1>
${post.description && html`<p class="lede">${post.description}</p>`}
<p class="post-meta"><time datetime="${post.date}">${formatDate(post.date)}</time>${post.updated && post.updated !== post.date && html` <span aria-hidden="true">·</span> Updated <time datetime="${post.updated}">${formatDate(post.updated)}</time>`} <span aria-hidden="true">·</span> ${post.readingMinutes} min read${service && html` <span aria-hidden="true">·</span> <a href="${service.path}">${service.label}</a>`}</p>
</div>
</header>
<div class="wrap post-layout${showToc ? ' has-toc' : ''}">
${showToc && html`<nav class="toc" aria-labelledby="toc-title">
<h2 class="toc-title" id="toc-title">${c.onThisPage}</h2>
<ol role="list">
${post.toc.map((item) => html`<li><a href="#${item.id}">${item.text}</a></li>\n`)}</ol>
</nav>`}
<div class="post-main">
<div class="prose post-body">
${raw(post.html)}
</div>
${post.tags.length > 0 && html`<ul class="tags" role="list" aria-label="Tags">${post.tags.map((t) => html`<li><a href="${tagPath(t.slug)}">${t.label}</a></li>`)}</ul>`}
${service && html`<aside class="post-cta" aria-labelledby="post-cta-title">
<h2 id="post-cta-title">${c.postCtaTitle}</h2>
<p>We build ${sentenceCase(service.label)} for businesses. A good place to start: ${service.offer}.</p>
<div class="actions"><a class="btn btn-primary" href="${offerHref}">${copy.services[service.key]?.offerAction ?? copy.cta.book} <span class="arrow" aria-hidden="true">→</span></a><a class="btn btn-secondary" href="${service.path}">More about ${sentenceCase(service.label)}</a></div>
</aside>`}
</div>
</div>
</article>

${related.length > 0 && html`<section class="section section-alt" aria-labelledby="related-title">
<div class="wrap">
${sectionHead({ title: c.related, id: 'related-title' })}
${postCards(related, { grid: true })}
</div>
</section>`}

${ctaBand(ctx)}`;

  return {
    path: post.path,
    title: post.title,
    description: post.description || truncate(stripTags(post.html).replace(/\s+/g, ' ').trim(), 155),
    ogType: 'article',
    article: { published: post.date, modified: post.updated ?? post.date, tags: post.tags.map((t) => t.label) },
    body,
    jsonLd: [
      blogPostingLd(ctx, post),
      breadcrumbLd(ctx, [{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog/' }, { name: post.title, path: post.path }]),
      faqLd(post.faq.map((item) => ({ q: item.question, a: item.answer }))),
    ],
  };
}

function tagPage(ctx, tag) {
  const c = ctx.copy.blog;
  const body = html`${pageHead({ eyebrow: c.title, title: c.tagTitle(tag.label) })}
<section class="section section-flush" aria-label="Posts">
<div class="wrap">
${postCards(tag.posts, { headingLevel: 2 })}
<p class="section-more"><a href="/blog/">All posts <span class="arrow" aria-hidden="true">→</span></a></p>
</div>
</section>`;
  return {
    path: tagPath(tag.slug),
    title: c.tagTitle(tag.label),
    description: `Posts about ${tag.label} from the ${ctx.config.business.shortName} blog.`,
    // Thin archive pages: useful for browsing, not worth indexing.
    noindex: true,
    body,
  };
}
