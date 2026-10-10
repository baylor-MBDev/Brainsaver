import { birdNote, formatDate, pageHead } from '../lib/components.js';
import { html } from '../lib/html.js';

export function thanksPage(ctx) {
  const c = ctx.copy.thanks;
  return {
    path: '/thanks/',
    title: c.title,
    description: c.description,
    noindex: true,
    body: birdNote({ title: c.h1, text: c.text, links: [{ href: '/', label: c.home }, { href: '/blog/', label: c.blog }] }),
  };
}

export function privacyPage(ctx) {
  const { config, copy } = ctx;
  const c = copy.privacy;
  const sections = c.sections({ analytics: Boolean(config.site?.analyticsToken), turnstile: Boolean(config.site?.turnstileSiteKey) });
  const body = html`${pageHead({ title: c.title, lede: html`Last updated <time datetime="${c.updated}">${formatDate(c.updated)}</time>.` })}
<section class="section section-flush" aria-label="${c.title}">
<div class="wrap">
<div class="prose">
${sections.map(
  (s) => html`<h2>${s.title}</h2>
${s.text.map((p) => html`<p>${p}</p>\n`)}`,
)}</div>
</div>
</section>`;
  return { path: '/privacy/', title: c.title, description: c.description, body };
}

export function notFoundPage(ctx) {
  const c = ctx.copy.notFound;
  const links = [{ href: '/', label: 'Home' }, ...ctx.services.map((s) => ({ href: s.path, label: s.label })), { href: '/blog/', label: 'Blog' }, { href: '/contact/', label: 'Contact' }];
  return {
    path: '/404.html',
    file: '404.html',
    title: c.title,
    description: c.text,
    noindex: true,
    noCanonical: true,
    body: birdNote({ title: c.h1, text: c.text, links }),
  };
}
