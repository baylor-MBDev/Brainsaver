import { mark, phrase, songLine } from './brand.js';
import { html, raw } from './html.js';
import { bookLink } from './layout.js';

const arrow = raw('<span class="arrow" aria-hidden="true">→</span>');

/** "AI Automations" -> "AI automations": lowercase for mid-sentence use, keeping acronyms. */
export const sentenceCase = (label) =>
  String(label ?? '')
    .split(' ')
    .map((word) => (/^[A-Z0-9]{2,}$/.test(word) ? word : word.toLowerCase()))
    .join(' ');

export const formatDate = (iso) =>
  new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

export function eyebrow(text) {
  return text ? html`<p class="eyebrow">${text}</p>` : '';
}

export function sectionHead({ eyebrow: kicker, title, intro, id, split = false }) {
  return html`<div class="section-head${split ? ' split' : ''}">
<div>${eyebrow(kicker)}<h2 id="${id}">${title}</h2></div>
${intro && html`<p class="section-intro">${intro}</p>`}
</div>`;
}

export function serviceCards(ctx) {
  return html`<ul class="service-grid" role="list">
${ctx.services.map(
  (s) => html`<li class="service-card">
${phrase(s.key)}
<p class="card-label">${s.label}</p>
<h3><a href="${s.path}">${s.headline}</a></h3>
<p>${s.summary}</p>
<span class="card-more" aria-hidden="true">Explore ${sentenceCase(s.label)} ${arrow}</span>
</li>
`,
)}</ul>`;
}

export function processSteps(steps) {
  return html`<ol class="steps" role="list">
${steps.map(
  (step, i) => html`<li class="step">
<span class="step-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
<h3>${step.title}</h3>
<p>${step.text}</p>
</li>
`,
)}</ol>`;
}

function proofLinkLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'github.com' ? 'View the project on GitHub' : `Visit ${host}`;
  } catch {
    return 'View the project';
  }
}

export function proofCards(ctx, items, { headingLevel = 3 } = {}) {
  const h = `h${headingLevel}`;
  return html`<div class="cases">
${items.map((item) => {
  const service = ctx.serviceByKey(item.service);
  return html`<article class="case">
<div class="case-head">
${service && html`<p class="case-tag"><a href="${service.path}">${service.label}</a></p>`}
${raw(`<${h} class="case-name">`)}${item.name}${raw(`</${h}>`)}
</div>
<div class="case-body">
<p class="case-summary">${item.summary}</p>
${item.url && html`<p><a class="case-link" href="${item.url}">${proofLinkLabel(item.url)} ${arrow}</a></p>`}
</div>
</article>
`;
})}</div>`;
}

export function faqList(items) {
  return html`<div class="faq">
${items.map(
  (item) => html`<details class="faq-item">
<summary><span>${item.q}</span><span class="faq-icon" aria-hidden="true"></span></summary>
<div class="faq-answer"><p>${item.a}</p></div>
</details>
`,
)}</div>`;
}

export function faqSection({ id = 'faq', title, items, eyebrow: kicker = 'FAQ' }) {
  if (!items?.length) return '';
  return html`<section class="section" aria-labelledby="${id}">
<div class="wrap faq-layout">
<div>${eyebrow(kicker)}<h2 id="${id}">${title}</h2></div>
${faqList(items)}
</div>
</section>`;
}

export function postMeta(post) {
  return html`<p class="post-meta"><time datetime="${post.date}">${formatDate(post.date)}</time> <span aria-hidden="true">·</span> ${post.readingMinutes} min read</p>`;
}

export function postCards(posts, { headingLevel = 3, grid = false } = {}) {
  const h = `h${headingLevel}`;
  return html`<ul class="post-list${grid ? ' post-grid' : ''}" role="list">
${posts.map(
  (post) => html`<li class="post-card">
${postMeta(post)}
${raw(`<${h}>`)}<a href="${post.path}">${post.title}</a>${raw(`</${h}>`)}
${post.description && html`<p>${post.description}</p>`}
</li>
`,
)}</ul>`;
}

export function ctaBand(ctx, { title, text } = {}) {
  const { copy, config } = ctx;
  const book = bookLink(ctx);
  const secondary = book.external ? { href: '/contact/', label: copy.cta.message } : { href: `mailto:${config.business.email}`, label: copy.cta.email };
  return html`<section class="cta-band" aria-labelledby="cta-title">
<div class="wrap">
${songLine()}
<div class="cta-inner">
<div>
<h2 id="cta-title">${title ?? copy.cta.title}</h2>
<p>${text ?? copy.cta.text}</p>
</div>
<div class="actions">
<a class="btn btn-primary" href="${book.href}">${copy.cta.book} ${arrow}</a>
<a class="btn btn-secondary" href="${secondary.href}">${secondary.label}</a>
</div>
</div>
</div>
</section>`;
}

export function pageHead({ eyebrow: kicker, title, lede, extra }) {
  return html`<section class="page-head">
<div class="wrap">
${eyebrow(kicker)}
<h1>${title}</h1>
${lede && html`<p class="lede">${lede}</p>`}
${extra}
</div>
</section>`;
}

export function birdNote({ title, text, links = [] }) {
  return html`<section class="section note-page">
<div class="wrap note">
${mark({ className: 'mark note-mark', size: 96 })}
<h1>${title}</h1>
<p class="lede">${text}</p>
${links.length > 0 && html`<ul class="note-links" role="list">${links.map((l) => html`<li><a href="${l.href}">${l.label}</a></li>`)}</ul>`}
</div>
</section>`;
}

/**
 * The lead form shared by /contact/ and /free-audit/. Works as a plain POST
 * with JavaScript off (the Worker redirects to /thanks/ or back here with an
 * #error fragment); site.js upgrades it to an inline fetch submit.
 */
export function leadForm(ctx, { type, fields, submit, success }) {
  const { config, copy } = ctx;
  const id = (name) => `${type}-${name}`;
  const errors = copy.formErrors;
  const optional = raw(' <span class="optional">(optional)</span>');
  const field = (f) => {
    const describedBy = f.hint ? html` aria-describedby="${id(f.name)}-hint"` : '';
    const label = html`<label for="${id(f.name)}">${f.label}${!f.required && optional}</label>`;
    const hint = f.hint && html`<p class="hint" id="${id(f.name)}-hint">${f.hint}</p>`;
    const common = html`id="${id(f.name)}" name="${f.name}"${f.required && raw(' required')}${f.maxlength && html` maxlength="${f.maxlength}"`}${f.autocomplete && html` autocomplete="${f.autocomplete}"`}${describedBy}`;
    let control;
    if (f.kind === 'textarea') control = html`<textarea ${common} rows="${f.rows ?? 6}"></textarea>`;
    else if (f.kind === 'select') control = html`<select ${common}>${f.options.map((o) => html`<option value="${o.value}">${o.label}</option>`)}</select>`;
    else control = html`<input ${common} type="${f.type ?? 'text'}"${f.inputmode && html` inputmode="${f.inputmode}"`}${f.placeholder && html` placeholder="${f.placeholder}"`}>`;
    return html`<div class="field${f.wide ? ' field-wide' : ''}">${label}${control}${hint}</div>`;
  };
  return html`<form class="lead-form" action="/api/contact" method="post" data-lead-form data-success="${success}">
<input type="hidden" name="type" value="${type}">
${['invalid', 'spam', 'server'].map(
  (code) => html`<p class="form-error" id="${type}-error-${code}" role="alert" tabindex="-1">${errors[code]} ${errors.emailFallback} <a href="mailto:${config.business.email}">${config.business.email}</a>.</p>
`,
)}<div class="form-grid">
${fields.map(field)}
</div>
<div class="hp" aria-hidden="true"><label for="${id('company_url')}">Leave this field empty</label><input id="${id('company_url')}" name="company_url" type="text" tabindex="-1" autocomplete="off"></div>
<input type="hidden" name="utm_source"><input type="hidden" name="utm_medium"><input type="hidden" name="utm_campaign">
${config.site?.turnstileSiteKey && html`<div class="cf-turnstile" data-sitekey="${config.site.turnstileSiteKey}" data-theme="auto" data-size="flexible"></div>\n`}<div class="form-actions"><button class="btn btn-primary" type="submit">${submit}</button></div>
<p class="form-status" role="status" aria-live="polite" data-form-status></p>
<p class="form-privacy">We only use what you send to reply to you. <a href="/privacy/">Privacy policy</a>.</p>
</form>`;
}
