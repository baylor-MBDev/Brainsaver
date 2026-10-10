import { escapeHtml as e } from '../lib/util.js';

// A single self-contained HTML page: the prospect's homepage, reimagined.
// Fast by construction (inline CSS, one font, no frameworks) because "your
// site is slow" pitches need a concept that isn't.

function hexToRgb(hex) {
  let h = String(hex ?? '').replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]) {
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const mix = (rgb, withRgb, amount) => rgb.map((v, i) => Math.round(v + (withRgb[i] - v) * amount));
const toHex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export function themeFrom(colors = []) {
  const primary = hexToRgb(colors[0]) ?? [31, 79, 216];
  // Darken until white text on it passes contrast (≥ 4.5:1).
  let base = primary;
  for (let i = 0; i < 10 && (1.05 / (luminance(base) + 0.05)) < 4.5; i++) base = mix(base, [0, 0, 0], 0.15);
  const accent = hexToRgb(colors[1]) ?? mix(primary, [255, 255, 255], 0.35);
  return {
    primary: toHex(base),
    primaryDark: toHex(mix(base, [0, 0, 0], 0.35)),
    tint: toHex(mix(primary, [255, 255, 255], 0.9)),
    tintStrong: toHex(mix(primary, [255, 255, 255], 0.75)),
    accent: toHex(accent),
  };
}

const ICON = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12.5l2 2 4-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.6a1 1 0 01-.25 1z" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.5" fill="currentColor"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 6.5L12 13l8.5-6.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};

const stars = (rating) => {
  const full = Math.round(Number(rating) || 0);
  return Array.from({ length: 5 }, (_, i) => `<span class="${i < full ? 'on' : ''}">${ICON.star}</span>`).join('');
};

const telHref = (phone) => `tel:${String(phone).replace(/[^0-9+]/g, '')}`;

/**
 * @param {object} p
 * @param {object} p.company   lead record
 * @param {object} p.brand     extracted brand (name, logo, colors, address, heroImage)
 * @param {object} p.copy      DemoCopySchema-shaped copy
 * @param {object} p.studio    { name, siteUrl }
 */
export function renderDemo({ company, brand = {}, copy, studio }) {
  const t = themeFrom(brand.colors);
  const name = company.name ?? brand.name ?? 'Your business';
  const city = company.city ?? brand.address?.city ?? null;
  const phone = company.phone ?? null;
  const email = (company.siteEmails ?? [])[0] ?? null;
  const address = brand.address?.full ?? company.address ?? null;
  const rating = company.rating ? Number(company.rating).toFixed(1) : null;
  const year = new Date().getFullYear();

  const logo = brand.logo
    ? `<img class="logo-img" src="${e(brand.logo)}" alt="${e(name)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'logo-text',textContent:this.alt}))">`
    : `<span class="logo-text">${e(name)}</span>`;

  const heroVisual = brand.heroImage
    ? `<figure class="hero-media"><img src="${e(brand.heroImage)}" alt="" loading="eager" onerror="this.parentElement.classList.add('fallback');this.remove()"><figcaption class="hero-badge">${rating ? `${stars(rating)}<b>${e(rating)}</b> on Google` : e(copy.primary_cta)}</figcaption></figure>`
    : `<div class="hero-media panel"><p class="panel-title">What we do</p><ul>${copy.services.slice(0, 5).map((s) => `<li>${ICON.check}${e(s.name)}</li>`).join('')}</ul></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${e(name)} · Concept homepage by ${e(studio.name)}</title>
<meta name="description" content="A concept redesign of the ${e(name)} homepage, prepared by ${e(studio.name)}.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
:root{--primary:${t.primary};--primary-dark:${t.primaryDark};--tint:${t.tint};--tint-strong:${t.tintStrong};--accent:${t.accent};--ink:#14161b;--muted:#5b616e;--line:#e6e7eb;--bg:#ffffff;--radius:18px}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{color:inherit}
svg{width:1.25em;height:1.25em;flex:none}
.wrap{width:min(1120px,100% - 32px);margin-inline:auto}
.concept{background:#14161b;color:#d9dbe1;font-size:13px;text-align:center;padding:8px 16px}
.concept a{color:#fff;font-weight:600}
header.site{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.92);backdrop-filter:saturate(1.4) blur(10px);border-bottom:1px solid var(--line)}
.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:72px}
.logo-img{max-height:46px;width:auto}
.logo-text{font-weight:800;font-size:1.15rem;letter-spacing:-.02em}
nav.links{display:none;gap:28px;font-weight:600;font-size:.95rem}
nav.links a{text-decoration:none;color:var(--muted)}nav.links a:hover{color:var(--ink)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5em;padding:.85em 1.4em;border-radius:999px;font-weight:700;text-decoration:none;border:2px solid transparent;transition:transform .15s ease,background .15s ease;font-size:1rem;cursor:pointer;font-family:inherit}
.btn:hover{transform:translateY(-1px)}
.btn-primary{background:var(--primary);color:#fff}.btn-primary:hover{background:var(--primary-dark)}
.btn-ghost{border-color:var(--line);background:#fff;color:var(--ink)}
.btn-sm{padding:.6em 1.05em;font-size:.92rem}
.hero{padding:56px 0 64px;background:radial-gradient(1200px 500px at 85% -10%,var(--tint-strong),transparent 60%),linear-gradient(180deg,var(--tint),#fff 70%)}
.hero-grid{display:grid;gap:40px;align-items:center}
.eyebrow{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:.88rem;font-weight:600;color:var(--muted)}
.eyebrow svg{color:var(--primary)}
h1{font-size:clamp(2.2rem,6vw,3.7rem);line-height:1.05;letter-spacing:-.035em;margin:18px 0 16px;font-weight:800}
.lead{font-size:1.15rem;color:var(--muted);max-width:36em;margin:0 0 28px}
.cta-row{display:flex;flex-wrap:wrap;gap:12px}
.trust{display:flex;flex-wrap:wrap;gap:18px;margin-top:26px;color:var(--muted);font-size:.92rem;font-weight:600}
.trust span{display:inline-flex;align-items:center;gap:6px}.trust svg{color:var(--primary)}
.hero-media{margin:0;position:relative;border-radius:28px;overflow:hidden;box-shadow:0 30px 60px -30px rgba(20,22,27,.45);background:var(--primary);min-height:300px}
.hero-media img{width:100%;height:100%;object-fit:cover;min-height:300px}
.hero-media.fallback{background:linear-gradient(135deg,var(--primary),var(--accent))}
.hero-badge{position:absolute;left:16px;bottom:16px;background:#fff;border-radius:14px;padding:10px 14px;display:flex;align-items:center;gap:6px;font-size:.92rem;box-shadow:0 10px 30px -12px rgba(0,0,0,.35)}
.hero-badge span svg,.stars span svg{color:#d6d8de}.hero-badge span.on svg,.stars span.on svg{color:#f5b301}
.panel{padding:32px;color:#fff;background:linear-gradient(140deg,var(--primary),var(--primary-dark))}
.panel-title{margin:0 0 14px;font-weight:700;opacity:.8;text-transform:uppercase;letter-spacing:.08em;font-size:.8rem}
.panel ul{list-style:none;margin:0;padding:0;display:grid;gap:12px;font-size:1.1rem;font-weight:600}
.panel li{display:flex;align-items:center;gap:10px}
section{padding:72px 0}
.kicker{color:var(--primary);font-weight:700;text-transform:uppercase;letter-spacing:.1em;font-size:.8rem;margin:0 0 10px}
h2{font-size:clamp(1.7rem,4vw,2.5rem);letter-spacing:-.03em;line-height:1.15;margin:0 0 14px;font-weight:800}
.section-lead{color:var(--muted);max-width:40em;margin:0 0 36px;font-size:1.05rem}
.grid{display:grid;gap:18px}
.card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:26px;transition:box-shadow .2s ease,transform .2s ease}
.card:hover{box-shadow:0 20px 40px -24px rgba(20,22,27,.35);transform:translateY(-2px)}
.icon{width:44px;height:44px;border-radius:12px;background:var(--tint);color:var(--primary);display:grid;place-items:center;margin-bottom:16px}
.card h3{margin:0 0 6px;font-size:1.12rem;letter-spacing:-.01em}
.card p{margin:0;color:var(--muted)}
.why{background:var(--tint)}
.num{font-weight:800;color:var(--primary);font-size:.9rem;letter-spacing:.06em}
.reviews{background:var(--ink);color:#fff;text-align:center}
.reviews .big{font-size:clamp(3rem,10vw,5rem);font-weight:800;letter-spacing:-.04em;line-height:1}
.stars{display:inline-flex;gap:4px;font-size:1.6rem;margin:10px 0}
.reviews p{color:#c7cad3}
.reviews .btn-ghost{background:transparent;color:#fff;border-color:#3a3e48}
.contact-grid{display:grid;gap:28px}
.info{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:14px}
.info li{display:flex;gap:12px;align-items:flex-start}.info svg{color:var(--primary);margin-top:3px}
.info a{text-decoration:none;font-weight:600}
form.quote{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:26px;display:grid;gap:14px;box-shadow:0 20px 50px -30px rgba(20,22,27,.3)}
label{font-weight:600;font-size:.9rem;display:grid;gap:6px}
input,textarea,select{font:inherit;padding:.8em .9em;border:1px solid var(--line);border-radius:12px;background:#fbfbfc}
input:focus,textarea:focus{outline:3px solid var(--tint-strong);border-color:var(--primary)}
.note{font-size:.85rem;color:var(--muted);margin:0}
.sent{display:none;background:var(--tint);border-radius:12px;padding:12px 14px;font-weight:600}
footer{border-top:1px solid var(--line);padding:28px 0 96px;color:var(--muted);font-size:.9rem}
footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px}
.mobile-cta{position:fixed;left:0;right:0;bottom:0;display:flex;gap:10px;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid var(--line);z-index:30}
.mobile-cta .btn{flex:1;white-space:nowrap;font-size:.95rem;padding:.8em 1em}
.show-sm{display:inline}.hide-sm{display:none}
.grid.auto{grid-template-columns:1fr}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
@media (min-width:760px){
  nav.links{display:flex}
  .show-sm{display:none}.hide-sm{display:inline}
  .grid.auto{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
  .hero{padding:88px 0 96px}
  .hero-grid{grid-template-columns:1.1fr .9fr}
  .grid.cols-3{grid-template-columns:repeat(3,1fr)}
  .grid.cols-2{grid-template-columns:repeat(2,1fr)}
  .contact-grid{grid-template-columns:1fr 1fr;align-items:start}
  .mobile-cta{display:none}
  footer{padding-bottom:28px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style>
</head>
<body>
<div class="concept">Concept homepage by <a href="${e(studio.siteUrl)}">${e(studio.name)}</a><span class="hide-sm"> · not the official ${e(name)} website</span><span class="show-sm"> · not the official site</span></div>
<header class="site"><div class="wrap bar">
  <a href="#top" aria-label="${e(name)} home" style="text-decoration:none">${logo}</a>
  <nav class="links" aria-label="Main"><a href="#services">Services</a><a href="#why">Why us</a>${rating ? '<a href="#reviews">Reviews</a>' : ''}<a href="#contact">Contact</a></nav>
  ${phone ? `<a class="btn btn-primary btn-sm" href="${telHref(phone)}" aria-label="Call ${e(phone)}">${ICON.phone}<span class="hide-sm">${e(phone)}</span><span class="show-sm">Call</span></a>` : `<a class="btn btn-primary btn-sm" href="#contact">${e(copy.primary_cta)}</a>`}
</div></header>
<main id="top">
<section class="hero"><div class="wrap hero-grid">
  <div>
    ${city || rating ? `<span class="eyebrow">${rating ? `${ICON.star} ${e(rating)} from ${e(company.reviewCount)} Google reviews` : `${ICON.pin} Serving ${e(city)}`}</span>` : ''}
    <h1>${e(copy.headline)}</h1>
    <p class="lead">${e(copy.subheadline)}</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="#contact">${e(copy.primary_cta)}</a>
      ${phone ? `<a class="btn btn-ghost" href="${telHref(phone)}">${ICON.phone}Call ${e(phone)}</a>` : ''}
    </div>
    <div class="trust">${copy.highlights.filter((h) => !(rating && /google|★|review/i.test(h.title))).slice(0, 3).map((h) => `<span>${ICON.check}${e(h.title)}</span>`).join('')}</div>
  </div>
  ${heroVisual}
</div></section>

<section id="services"><div class="wrap">
  <p class="kicker">Services</p>
  <h2>What ${e(name)} can do for you</h2>
  <p class="section-lead">${e(copy.about)}</p>
  <div class="grid auto">${copy.services.slice(0, 6).map((s) => `<article class="card"><div class="icon">${ICON.check}</div><h3>${e(s.name)}</h3><p>${e(s.description)}</p></article>`).join('')}</div>
</div></section>

<section id="why" class="why"><div class="wrap">
  <p class="kicker">Why ${e(name)}</p>
  <h2>Reasons customers choose us</h2>
  <div class="grid cols-3">${copy.highlights.slice(0, 3).map((h, i) => `<article class="card"><p class="num">0${i + 1}</p><h3>${e(h.title)}</h3><p>${e(h.text)}</p></article>`).join('')}</div>
</div></section>

${rating ? `<section id="reviews" class="reviews"><div class="wrap">
  <p class="kicker" style="color:#9aa0ad">Reviews</p>
  <div class="big">${e(rating)}</div>
  <div class="stars" aria-label="${e(rating)} out of 5 stars">${stars(rating)}</div>
  <p>Average from ${e(company.reviewCount)} Google reviews</p>
  ${company.mapsUrl ? `<p><a class="btn btn-ghost" href="${e(company.mapsUrl)}" rel="noopener" target="_blank">Read the reviews on Google</a></p>` : ''}
</div></section>` : ''}

<section id="contact"><div class="wrap contact-grid">
  <div>
    <p class="kicker">Contact</p>
    <h2>${e(copy.primary_cta)}</h2>
    <p class="section-lead">Tell us what you need and we'll get back to you${phone ? ', or call us now' : ''}.</p>
    <ul class="info">
      ${phone ? `<li>${ICON.phone}<a href="${telHref(phone)}">${e(phone)}</a></li>` : ''}
      ${email ? `<li>${ICON.mail}<a href="mailto:${e(email)}">${e(email)}</a></li>` : ''}
      ${address ? `<li>${ICON.pin}<span>${e(address)}</span></li>` : city ? `<li>${ICON.pin}<span>Serving ${e(city)} and nearby areas</span></li>` : ''}
    </ul>
  </div>
  <form class="quote" onsubmit="event.preventDefault();this.querySelector('.sent').style.display='block'">
    <label>Name<input name="name" autocomplete="name" required></label>
    <label>Phone or email<input name="contact" autocomplete="email" required></label>
    <label>How can we help?<textarea name="message" rows="4"></textarea></label>
    <button class="btn btn-primary" type="submit">${e(copy.primary_cta)}</button>
    <p class="sent" role="status">This is a concept, so nothing was sent. On the live site, requests go straight to your inbox and phone.</p>
    <p class="note">Concept form: not connected.</p>
  </form>
</div></section>
</main>
<footer><div class="wrap"><span>© ${year} ${e(name)}</span><span>Concept by <a href="${e(studio.siteUrl)}">${e(studio.name)}</a></span></div></footer>
<div class="mobile-cta">${phone ? `<a class="btn btn-primary" href="${telHref(phone)}">${ICON.phone}Call</a>` : ''}<a class="btn btn-ghost" href="#contact">${e(copy.primary_cta)}</a></div>
</body>
</html>
`;
}
