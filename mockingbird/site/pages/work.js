import { ctaBand, pageHead, proofCards } from '../lib/components.js';
import { html } from '../lib/html.js';
import { breadcrumbLd } from '../lib/seo.js';

export default function workPage(ctx) {
  const { config, copy } = ctx;
  const c = copy.work;
  const body = html`${pageHead({ eyebrow: c.title, title: c.h1, lede: c.intro })}
<section class="section section-flush" aria-label="Case studies">
<div class="wrap">
${proofCards(ctx, config.proof, { headingLevel: 2 })}
</div>
</section>
${ctaBand(ctx)}`;
  return {
    path: '/work/',
    title: c.title,
    description: c.description,
    body,
    jsonLd: [breadcrumbLd(ctx, [{ name: 'Home', path: '/' }, { name: c.title, path: '/work/' }])],
  };
}
