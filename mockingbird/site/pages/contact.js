import { leadForm, pageHead } from '../lib/components.js';
import { html } from '../lib/html.js';
import { bookLink } from '../lib/layout.js';
import { breadcrumbLd } from '../lib/seo.js';

export default function contactPage(ctx) {
  const { config, copy } = ctx;
  const { business } = config;
  const c = copy.contact;
  const f = c.form;
  const book = bookLink(ctx);
  const location = [business.city, business.region].filter(Boolean).join(', ');

  const fields = [
    { name: 'name', label: f.name, required: true, autocomplete: 'name', maxlength: 200 },
    { name: 'email', label: f.email, type: 'email', required: true, autocomplete: 'email', maxlength: 254 },
    { name: 'company', label: f.company, autocomplete: 'organization', maxlength: 200 },
    { name: 'website', label: f.website, inputmode: 'url', autocomplete: 'url', placeholder: 'yourbusiness.com', maxlength: 500 },
    {
      name: 'service',
      label: f.service,
      kind: 'select',
      required: false,
      options: [{ value: '', label: f.servicePlaceholder }, ...ctx.services.map((s) => ({ value: s.key, label: s.label })), { value: 'other', label: f.serviceOther }],
    },
    { name: 'budget', label: f.budget, maxlength: 100, hint: f.budgetHint },
    { name: 'message', label: f.message, kind: 'textarea', required: true, maxlength: 5000, rows: 7, wide: true },
  ];

  const body = html`${pageHead({ eyebrow: c.title, title: c.h1, lede: c.intro })}
<section class="section section-flush" aria-label="Contact form">
<div class="wrap form-layout">
<div class="form-panel">
${leadForm(ctx, { type: 'contact', fields, submit: f.submit, success: f.success })}
</div>
<aside class="contact-aside" aria-label="Other ways to reach us">
<div class="aside-block">
<h2>${c.callTitle}</h2>
${book.external ? html`<p>${c.callText}</p><p><a class="btn btn-secondary btn-sm" href="${book.href}">${copy.cta.book}</a></p>` : html`<p>${c.callFallback}</p>`}
</div>
<div class="aside-block">
<h2>${c.emailTitle}</h2>
<p><a href="mailto:${business.email}">${business.email}</a></p>
${business.phone && html`<h2>${c.phoneTitle}</h2><p><a href="tel:${business.phone.replace(/[^\d+]/g, '')}">${business.phone}</a></p>`}
${business.city && html`<p class="muted">Based in ${location}.</p>`}
</div>
<div class="aside-block">
<h2>${c.nextTitle}</h2>
<ol class="next-steps">
${c.nextSteps.map((step) => html`<li>${step}</li>\n`)}</ol>
</div>
</aside>
</div>
</section>`;

  return {
    path: '/contact/',
    title: c.title,
    description: c.description,
    body,
    turnstile: true,
    jsonLd: [breadcrumbLd(ctx, [{ name: 'Home', path: '/' }, { name: c.title, path: '/contact/' }])],
  };
}
