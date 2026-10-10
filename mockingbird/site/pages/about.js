import { perchedBird } from '../lib/brand.js';
import { ctaBand, pageHead } from '../lib/components.js';
import { html } from '../lib/html.js';
import { breadcrumbLd } from '../lib/seo.js';

export default function aboutPage(ctx) {
  const { config, copy } = ctx;
  const c = copy.about;
  const { business } = config;
  const location = [business.city, business.region].filter(Boolean).join(', ');

  const body = html`${pageHead({ eyebrow: c.title, title: c.h1 })}
<section class="section section-flush" aria-label="Our story">
<div class="wrap split">
<div class="prose about-intro">
${c.intro.map((p) => html`<p>${p}</p>\n`)}${business.city && html`<p>We’re based in ${location}.</p>\n`}</div>
<div class="about-art">${perchedBird({ className: 'perched perched-small' })}</div>
</div>
</section>

<section class="section" aria-labelledby="name-title">
<div class="wrap split">
<div class="split-head"><h2 id="name-title">${c.nameTitle}</h2></div>
<p class="big-text">${c.nameText}</p>
</div>
</section>

<section class="section section-alt" aria-labelledby="principles-title">
<div class="wrap">
<div class="section-head"><h2 id="principles-title">${c.principlesTitle}</h2></div>
<ul class="principles" role="list">
${c.principles.map((p) => html`<li><h3>${p.title}</h3><p>${p.text}</p></li>\n`)}</ul>
</div>
</section>

${(c.peopleText || business.social?.github) && html`<section class="section" aria-labelledby="people-title">
<div class="wrap split">
<div class="split-head"><h2 id="people-title">${c.peopleTitle}</h2></div>
<div class="prose">
${c.peopleText && html`<p>${c.peopleText}</p>`}
${business.social?.github && html`<p>${c.codeText} <a href="${business.social.github}">${c.codeLink}</a>.</p>`}
</div>
</div>
</section>`}

${ctaBand(ctx)}`;

  return {
    path: '/about/',
    title: c.title,
    description: c.description,
    body,
    jsonLd: [breadcrumbLd(ctx, [{ name: 'Home', path: '/' }, { name: c.title, path: '/about/' }])],
  };
}
