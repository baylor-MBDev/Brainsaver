import { perchedBird, songLine } from '../lib/brand.js';
import { ctaBand, faqSection, postCards, processSteps, proofCards, sectionHead, serviceCards } from '../lib/components.js';
import { html } from '../lib/html.js';
import { bookLink } from '../lib/layout.js';
import { faqLd, organizationLd, websiteLd } from '../lib/seo.js';

export default function homePage(ctx) {
  const { config, copy } = ctx;
  const c = copy.home;
  const book = bookLink(ctx);
  const latest = ctx.posts.slice(0, 3);

  const body = html`<section class="hero">
<div class="wrap hero-grid">
<div class="hero-copy">
<p class="eyebrow">${c.eyebrow}</p>
<h1>${config.business.tagline}</h1>
<p class="lede">${c.lede}</p>
<div class="actions">
<a class="btn btn-primary" href="${book.href}">${copy.cta.book} <span class="arrow" aria-hidden="true">→</span></a>
<a class="btn btn-secondary" href="#services">${c.secondaryCta}</a>
</div>
<p class="hero-note">${c.auditPrompt} <a href="/free-audit/">${c.auditLink}</a>.</p>
</div>
<div class="hero-art">${perchedBird()}</div>
</div>
<div class="wrap">${songLine({ className: 'songline songline-hero' })}</div>
</section>

<section class="section" id="services" aria-labelledby="services-title">
<div class="wrap">
${sectionHead({ ...c.services, id: 'services-title', split: true })}
${serviceCards(ctx)}
</div>
</section>

<section class="section section-alt" id="process" aria-labelledby="process-title">
<div class="wrap">
${sectionHead({ eyebrow: c.process.eyebrow, title: c.process.title, id: 'process-title' })}
${processSteps(c.process.steps)}
</div>
</section>

${config.proof.length > 0 && html`<section class="section" id="work" aria-labelledby="proof-title">
<div class="wrap">
${sectionHead({ ...c.proof, id: 'proof-title', split: true })}
${proofCards(ctx, config.proof.slice(0, 2))}
<p class="section-more"><a href="/work/">See all work <span class="arrow" aria-hidden="true">→</span></a></p>
</div>
</section>`}

${faqSection({ id: 'faq-title', title: c.faq.title, items: c.faq.items })}

${latest.length > 0 && html`<section class="section section-alt" aria-labelledby="blog-title">
<div class="wrap">
${sectionHead({ eyebrow: c.blog.eyebrow, title: c.blog.title, id: 'blog-title' })}
${postCards(latest, { grid: true })}
<p class="section-more"><a href="/blog/">${c.blog.all} <span class="arrow" aria-hidden="true">→</span></a></p>
</div>
</section>`}

${ctaBand(ctx)}`;

  return {
    path: '/',
    title: c.title,
    fullTitle: c.title,
    description: c.description,
    body,
    jsonLd: [organizationLd(ctx), websiteLd(ctx), faqLd(c.faq.items)],
  };
}
