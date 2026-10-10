import { phrase } from '../lib/brand.js';
import { ctaBand, faqSection, postCards, proofCards, sectionHead } from '../lib/components.js';
import { html } from '../lib/html.js';
import { bookLink } from '../lib/layout.js';
import { breadcrumbLd, faqLd, serviceLd } from '../lib/seo.js';

export default function servicePages(ctx) {
  return ctx.services.map((service) => servicePage(ctx, service));
}

function servicePage(ctx, s) {
  const { config, copy } = ctx;
  const sc = copy.services[s.key] ?? {};
  const sp = copy.servicePage;
  const book = bookLink(ctx);
  const proof = config.proof.filter((p) => p.service === s.key);
  const posts = ctx.posts.filter((p) => p.service === s.key).slice(0, 6);

  // A homepage concept needs the prospect's current site, so it goes
  // through the form. Audits and scoping calls are calls: calendar if set.
  const contactHref = `/contact/?service=${s.key}`;
  const offerHref = s.key !== 'websites' && book.external ? book.href : contactHref;
  const secondary = !book.external ? null : offerHref === book.href ? { href: contactHref, label: copy.cta.message } : { href: book.href, label: copy.cta.book };
  const offerAction = sc.offerAction ?? copy.cta.book;
  const faq = sc.faq ?? [];

  const body = html`<section class="page-head service-head">
<div class="wrap">
<p class="eyebrow">${s.label}</p>
<h1>${s.headline}</h1>
<p class="lede">${s.summary}</p>
<div class="actions">
<a class="btn btn-primary" href="${offerHref}">${offerAction} <span class="arrow" aria-hidden="true">→</span></a>
${secondary && html`<a class="btn btn-secondary" href="${secondary.href}">${secondary.label}</a>`}
</div>
</div>
</section>

<section class="section" aria-labelledby="outcomes-title">
<div class="wrap split">
<div class="split-head">${phrase(s.key)}<h2 id="outcomes-title">${sp.outcomesTitle}</h2></div>
<ol class="outcomes" role="list">
${s.outcomes.map((o) => html`<li>${o}</li>\n`)}</ol>
</div>
</section>

<section class="section section-tight" aria-labelledby="included-title">
<div class="wrap split">
<div class="split-head"><h2 id="included-title">${sp.deliverablesTitle}</h2></div>
<ul class="deliverables" role="list">
${s.deliverables.map((d) => html`<li>${d}</li>\n`)}</ul>
</div>
</section>

<section class="section section-tight" aria-labelledby="offer-title">
<div class="wrap">
<div class="offer">
<h2 class="eyebrow" id="offer-title">${sp.offerEyebrow}</h2>
<p class="offer-text">Get ${s.offer}.</p>
<div class="actions"><a class="btn btn-primary" href="${offerHref}">${offerAction} <span class="arrow" aria-hidden="true">→</span></a></div>
${s.key === 'websites' && html`<p class="offer-note">${sp.auditPrompt} <a href="/free-audit/">${sp.auditLink}</a>.</p>`}
</div>
</div>
</section>

${proof.length > 0 && html`<section class="section" aria-labelledby="proof-title">
<div class="wrap">
${sectionHead({ title: sp.proofTitle, id: 'proof-title' })}
${proofCards(ctx, proof)}
</div>
</section>`}

${faqSection({ id: 'service-faq', title: sp.faqTitle, items: faq })}

${posts.length > 0 && html`<section class="section section-alt" aria-labelledby="posts-title">
<div class="wrap">
${sectionHead({ title: sp.postsTitle, id: 'posts-title' })}
${postCards(posts, { grid: true })}
</div>
</section>`}

${ctaBand(ctx)}`;

  return {
    path: s.path,
    title: sc.title ?? s.headline,
    description: sc.description ?? s.summary,
    body,
    jsonLd: [serviceLd(ctx, s), faqLd(faq), breadcrumbLd(ctx, [{ name: 'Home', path: '/' }, { name: s.label, path: s.path }])],
  };
}
