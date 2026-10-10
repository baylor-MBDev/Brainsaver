import { faqSection, leadForm } from '../lib/components.js';
import { html } from '../lib/html.js';
import { breadcrumbLd, faqLd } from '../lib/seo.js';

// /free-audit/: the inbound version of the website audit we run on
// prospects. Posts to the same /api/contact endpoint with type=audit.
export default function auditPage(ctx) {
  const { copy } = ctx;
  const c = copy.audit;
  const f = c.form;

  const fields = [
    { name: 'website', label: f.website, required: true, inputmode: 'url', autocomplete: 'url', placeholder: f.websitePlaceholder, maxlength: 500, wide: true },
    { name: 'name', label: f.name, required: true, autocomplete: 'name', maxlength: 200 },
    { name: 'email', label: f.email, type: 'email', required: true, autocomplete: 'email', maxlength: 254 },
    { name: 'business_type', label: f.businessType, placeholder: f.businessTypePlaceholder, maxlength: 200, wide: true },
  ];

  const body = html`<section class="page-head audit-head">
<div class="wrap">
<p class="eyebrow">${c.title}</p>
<h1>${c.h1}</h1>
<p class="lede">${c.lede}</p>
</div>
</section>

<section class="section section-flush" aria-label="${c.title}">
<div class="wrap form-layout audit-layout">
<div class="audit-details">
<h2>${c.checksTitle}</h2>
<ul class="checks" role="list">
${c.checks.map((check) => html`<li><h3>${check.title}</h3><p>${check.text}</p></li>\n`)}</ul>
<h2>${c.stepsTitle}</h2>
<ol class="next-steps">
${c.steps.map((step) => html`<li>${step}</li>\n`)}</ol>
<p class="muted">${c.fine}</p>
</div>
<div class="form-panel form-card" id="get-audit">
<h2>${f.title}</h2>
${leadForm(ctx, { type: 'audit', fields, submit: f.submit, success: f.success })}
</div>
</div>
</section>

${faqSection({ id: 'audit-faq', title: c.faqTitle, items: c.faq })}`;

  return {
    path: '/free-audit/',
    title: c.title,
    description: c.description,
    body,
    turnstile: true,
    jsonLd: [faqLd(c.faq), breadcrumbLd(ctx, [{ name: 'Home', path: '/' }, { name: c.title, path: '/free-audit/' }])],
  };
}
