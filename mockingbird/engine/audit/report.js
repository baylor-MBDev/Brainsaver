import { labelFor } from './fingerprints.js';

// A plain-English website check-up built from an audit: what the free-audit
// form on the website promises, and a handy leave-behind after a sales call.
// Written for the business owner, not a developer.

const FIX = {
  'no-website': 'Put up a fast one-page site with your services, service area, reviews, and a tap-to-call button. Link it from your Google Business Profile.',
  'reviews-no-site': 'Send the people who find you on Google somewhere that shows off those reviews and makes it easy to call or request a quote.',
  'site-down': 'Get the site back up first: check that the domain is renewed and pointed at your host, and that hosting is paid and running.',
  'ssl-error': 'Renew or reinstall the security certificate (many hosts and Cloudflare offer free ones) so browsers stop warning visitors.',
  'no-https': 'Turn on HTTPS with a free certificate so Chrome stops showing "Not secure", then redirect all http:// traffic to https://.',
  'no-https-redirect': 'Add a redirect from http:// to https:// so every visitor lands on the secure version.',
  'not-mobile': 'Rebuild the layout to be mobile-first: readable text without zooming, big tap targets, and a call button that is always in reach.',
  'very-slow': 'Compress and resize images, remove unused plugins and scripts, and serve the site from a fast host or CDN. Aim for a mobile score of 90+.',
  slow: 'Compress and resize images, cut unused scripts, and use a CDN. Aim for a mobile score of 90+.',
  'slow-lcp': 'Make the first screen load fast: a properly sized hero image, no sliders or autoplay video, and fewer render-blocking scripts.',
  'slow-server': 'Move to faster hosting or put a CDN in front of the site so pages start loading immediately.',
  flash: 'Replace anything built with Flash; no current browser can display it.',
  frames: 'Rebuild without frames so Google can index each page and links work properly.',
  'legacy-markup': 'Rebuild on modern, responsive code. Patching a table-based layout rarely gets it to work well on phones.',
  'old-jquery': 'Update or remove old JavaScript libraries; outdated versions are slower and can have security issues.',
  'stale-copyright': 'Update the footer and any dated content so visitors can tell the business is active.',
  'seo-basics': 'Give every page a unique title and meta description, one clear main heading, and business schema markup.',
  'psi-seo': 'Work through the SEO items in Google PageSpeed Insights; most are quick fixes.',
  a11y: 'Fix the accessibility issues PageSpeed lists (contrast, labels, alt text). It helps every visitor and overlaps with SEO.',
  'no-cta': 'Put one clear action on every page (call, book, or request a quote) above the fold and again at the bottom.',
  'phone-not-tappable': 'Make the phone number a tap-to-call link everywhere it appears.',
  'mixed-content': 'Load every image and script over https so the secure page stays fully secure.',
  'alt-text': 'Add short descriptions (alt text) to images for accessibility and image search.',
  'dead-analytics': 'Install Google Analytics 4 (or a privacy-friendly alternative) so you can see where visitors come from.',
  'no-analytics': 'Install analytics so you can see which pages and sources bring in customers.',
  'no-chat': 'Add a way to get instant answers (an AI assistant or chat) so after-hours visitors don’t leave.',
  'no-online-booking': 'Let customers book or request a time online, synced with your calendar.',
  'form-to-inbox': 'Reply to every form submission instantly with a text or email, and alert your team so no lead waits.',
  'human-chat': 'Let an AI assistant handle common questions in your existing chat, handing off to a person when needed.',
  'web-only-engagement': 'Consider an app (or an installable web app) for regulars: faster booking, rewards, and reminders.',
  'no-app': 'For a business with regulars, an app with booking, rewards, and notifications keeps customers coming back.',
  'third-party-app': 'A branded app puts your name, not the booking platform’s, on your customers’ phones.',
};

const SECTIONS = [
  ['Getting the site working', ['no-website', 'reviews-no-site', 'site-down', 'ssl-error', 'no-https', 'no-https-redirect', 'mixed-content']],
  ['Mobile experience', ['not-mobile', 'phone-not-tappable']],
  ['Speed', ['very-slow', 'slow', 'slow-lcp', 'slow-server']],
  ['Getting found on Google', ['seo-basics', 'psi-seo', 'stale-copyright', 'alt-text', 'a11y']],
  ['Turning visitors into customers', ['no-cta', 'no-chat', 'no-online-booking', 'form-to-inbox', 'human-chat']],
  ['Technology', ['flash', 'frames', 'legacy-markup', 'old-jquery', 'dead-analytics', 'no-analytics']],
  ['Bigger opportunities', ['web-only-engagement', 'no-app', 'third-party-app']],
];

const check = (ok) => (ok ? '✓' : '✗');
const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function auditReport(company, { config, date = new Date().toISOString().slice(0, 10) }) {
  const audit = company.audit ?? {};
  const s = audit.signals;
  const psi = audit.psi;
  const findings = (company.findings ?? []).filter((f) => f.weight > 0 && f.kind !== 'context');
  const byId = new Map(findings.map((f) => [f.id, f]));
  const name = company.name ?? company.domain ?? 'your website';
  const lines = [`# Website check-up: ${name}`, '', `Prepared by ${config.business.name} on ${date}${company.domain ? ` for ${company.domain}` : ''}.`, ''];

  lines.push('## At a glance', '');
  if (audit.noWebsite) {
    lines.push('- There is no website to check yet; the notes below are about getting one up.');
  } else if (audit.reachable) {
    lines.push(`- ${check(audit.https && !audit.sslError)} Secure connection (HTTPS)`);
    lines.push(`- ${check(s?.viewport)} Built for phones`);
    if (psi?.performance != null) lines.push(`- ${check(psi.performance >= 50)} Google PageSpeed (mobile): ${psi.performance}/100${psi.lcpMs ? `, main content shows after ${(psi.lcpMs / 1000).toFixed(1)}s` : ''}`);
    lines.push(`- ${check(s?.ctas.call || s?.ctas.book || s?.ctas.quote)} Clear way to call, book, or request a quote`);
    lines.push(`- ${check(s?.title && s?.metaDescription && s?.h1Count === 1)} Page title, description, and heading set up for Google`);
    lines.push(`- ${check(s?.chat.length || s?.booking.length)} Instant answers or online booking`);
    const builtWith = [...(s?.tech.builder ?? []), ...(s?.tech.cms ?? []), ...(s?.tech.framework ?? [])].map(labelFor);
    if (builtWith.length) lines.push(`- Built with: ${builtWith.join(', ')}`);
  } else if (audit.blocked) {
    lines.push('- The site blocked our automated check, so this report relies on Google PageSpeed data only.');
  } else {
    lines.push(`- ✗ The site didn't load when we checked${audit.error ? ` (${audit.error})` : ''}.`);
  }
  lines.push('');

  let any = false;
  for (const [title, ids] of SECTIONS) {
    const items = ids.filter((id) => byId.has(id));
    if (!items.length) continue;
    any = true;
    lines.push(`## ${title}`, '');
    for (const id of items) {
      const f = byId.get(id);
      lines.push(`**${f.title}.** ${capital(f.point)}.`, '', `What to do: ${FIX[id] ?? 'Worth a closer look.'}`, '');
    }
  }
  const builder = findings.find((f) => f.id.startsWith('builder-'));
  if (builder) {
    any = true;
    lines.push('## Platform', '', `**${builder.title}.** ${capital(builder.point)}.`, '', 'What to do: if speed, SEO control, or owning your site outright matter to you, a custom build removes those limits. If not, the fixes above still apply.', '');
  }
  if (!any) lines.push('## Findings', '', 'Nothing urgent turned up. The site covers the basics well.', '');

  const top = findings.slice(0, 3);
  if (top.length) {
    lines.push('## Where we would start', '');
    top.forEach((f, i) => lines.push(`${i + 1}. ${FIX[f.id] ?? f.title}`));
    lines.push('');
  }
  lines.push('---', '', `Questions about any of this? Reply to this email or reach us at ${config.business.email}.${config.business.calendarUrl ? ` You can also book a call: ${config.business.calendarUrl}` : ''}`, '');
  return lines.join('\n');
}
