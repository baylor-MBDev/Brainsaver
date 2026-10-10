import { resolveUrl, scanTags } from './html.js';
import { uniq } from '../lib/util.js';

// Brand details pulled from a prospect's site, used to build their concept
// homepage and to personalize copy. Everything here is a best guess from
// public markup; the demo builder treats it as a starting point.

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function saturationLightness([r, g, b]) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

/** Most-used saturated colors in the page's CSS, best first. */
export function brandColors(html, themeColor) {
  const counts = new Map();
  const styleText = [
    ...[...String(html).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]),
    ...[...String(html).matchAll(/style\s*=\s*"([^"]*)"/gi)].map((m) => m[1]),
  ].join('\n');
  for (const m of styleText.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const hex = `#${m[1].toLowerCase()}`;
    const full = hex.length === 4 ? `#${hex.slice(1).split('').map((ch) => ch + ch).join('')}` : hex;
    counts.set(full, (counts.get(full) ?? 0) + 1);
  }
  const usable = (hex) => {
    const { s, l } = saturationLightness(hexToRgb(hex));
    return s >= 0.35 && l >= 0.18 && l <= 0.72;
  };
  const ranked = [...counts.entries()].filter(([hex]) => usable(hex)).sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
  const theme = themeColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(themeColor) && usable(themeColor) ? [themeColor.toLowerCase()] : [];
  return uniq([...theme, ...ranked]).slice(0, 3);
}

const looksLikeDomain = (s) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(s ?? '').trim());

function pickName({ jsonLd, ogSiteName, title, fallbackName, domain, text }) {
  const ld = jsonLd.find((x) => x.name && /Business|Organization|Store|Restaurant|Service|Dentist|Physician|Attorney|Contractor|Plumber|Electrician/i.test([].concat(x['@type'] ?? []).join(' ')));
  if (ld?.name) return String(ld.name).trim();
  if (ogSiteName) return ogSiteName.trim();
  // A source name beats guessing, unless the source only knew the domain.
  if (fallbackName && !looksLikeDomain(fallbackName)) return fallbackName;
  if (title) {
    const parts = title.split(/\s+[|–—\-:•·]\s+/).map((p) => p.trim()).filter((p) => p && !/^(home|welcome|homepage)$/i.test(p));
    const domainWord = (domain ?? '').split('.')[0].replace(/[^a-z]/g, '');
    const byDomain = parts.find((p) => domainWord && p.toLowerCase().replace(/[^a-z]/g, '').includes(domainWord.slice(0, 6)));
    const pick = byDomain ?? parts.sort((a, b) => a.length - b.length)[0];
    if (pick) return pick;
  }
  // "Copyright © 2016 Bluebonnet Plumbing." names the business on most sites.
  const holder = String(text ?? '').match(/(?:©|copyright)\s*(?:(?:19|20)\d{2}\s*(?:[-–—]\s*(?:19|20)\d{2})?)?\s*(?:by\s+)?([A-Z][A-Za-z0-9&'’. -]{2,48}?)(?:\.\s|,|\s+All rights|\s*\||\s+\d|$)/i)?.[1]?.trim();
  if (holder && !/^(all rights|copyright)/i.test(holder)) return holder.replace(/\.$/, '');
  return looksLikeDomain(fallbackName) ? fallbackName : null;
}

function pickLogo(html, jsonLd, baseUrl) {
  for (const item of jsonLd) {
    const logo = typeof item.logo === 'string' ? item.logo : item.logo?.url;
    if (logo) return resolveUrl(logo, baseUrl);
  }
  const imgs = scanTags(html, ['img']);
  const logoImg = imgs.find((img) => /logo/i.test(`${img.attrs.src ?? ''} ${img.attrs.alt ?? ''} ${img.attrs.class ?? ''} ${img.attrs.id ?? ''}`) && img.attrs.src && !img.attrs.src.startsWith('data:'));
  if (logoImg) return resolveUrl(logoImg.attrs.src, baseUrl);
  const touch = scanTags(html, ['link']).find((l) => /apple-touch-icon/i.test(l.attrs.rel ?? ''));
  return touch?.attrs.href ? resolveUrl(touch.attrs.href, baseUrl) : null;
}

function pickAddress(jsonLd, text) {
  for (const item of jsonLd) {
    const a = item.address;
    if (a && typeof a === 'object' && (a.streetAddress || a.addressLocality)) {
      return {
        street: a.streetAddress ?? null,
        city: a.addressLocality ?? null,
        region: a.addressRegion ?? null,
        postalCode: a.postalCode ?? null,
        full: [a.streetAddress, a.addressLocality, [a.addressRegion, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      };
    }
  }
  // Street-name words must start with a letter (or be an ordinal like 5th),
  // so a stray number earlier in the sentence ("© 2016 Acme. 1200 Main St")
  // can't be taken for the house number.
  const m = text.match(
    /\b(\d{1,6}\s+(?:(?:[A-Za-z][A-Za-z.'-]*|\d{1,3}(?:st|nd|rd|th))\s+){0,4}?(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Highway|Hwy|Parkway|Pkwy|Court|Ct|Circle|Cir|Place|Pl)\.?(?:,?\s+(?:Suite|Ste|Unit|#)\s*[\w-]+)?),?\s+([A-Za-z][A-Za-z.\s]{1,28}?),\s*([A-Z]{2})\s+(\d{5})\b/,
  );
  if (!m) return null;
  return { street: m[1].trim(), city: m[2].trim(), region: m[3], postalCode: m[4], full: m[0].replace(/\s+/g, ' ').trim() };
}

export function extractBrand(html, signals, { url, fallbackName, domain, text = '' } = {}) {
  const jsonLd = signals.jsonLd ?? [];
  const services = uniq(
    [...signals.navItems, ...signals.subheads].filter(
      (t) => t.split(/\s+/).length <= 5 && /^[A-Z0-9]/.test(t) && !/[?!]$/.test(t) && !/\b(?:we|our|you|your|why|how|what)\b/i.test(t),
    ),
  ).slice(0, 8);
  return {
    name: pickName({ jsonLd, ogSiteName: signals.og.siteName, title: signals.title, fallbackName, domain, text }),
    tagline: signals.metaDescription ?? signals.og.description ?? signals.h1s[0] ?? null,
    headline: signals.h1s[0] ?? null,
    logo: pickLogo(html, jsonLd, url),
    heroImage: signals.og.image ? resolveUrl(signals.og.image, url) : null,
    colors: brandColors(html, signals.themeColor),
    address: pickAddress(jsonLd, text),
    services,
  };
}
