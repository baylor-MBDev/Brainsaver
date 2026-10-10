// Turns config.brand into CSS custom properties. Derived colors (muted text,
// link color in dark mode, hover states) are computed and nudged until they
// pass WCAG AA against their background, so changing a brand color in
// mockingbird.config.js can't quietly break contrast.

const hexToRgb = (hex) => {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
};

const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** Mix `a` toward `b` by `amount` (0..1). */
export const mix = (a, b, amount) => {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return rgbToHex(x.map((v, i) => v + (y[i] - v) * amount));
};

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Step `color` toward `toward` until it reaches `ratio` against `bg`. */
export function ensureContrast(color, bg, ratio, toward) {
  let out = color;
  for (let step = 0; step <= 20 && contrast(out, bg) < ratio; step++) out = mix(color, toward, step / 20);
  return out;
}

// Fallback faces sized to match each web font's metrics, so text doesn't
// jump when the real font arrives (font-display: swap). Values computed
// from the font files against Arial / Arial Bold.
const FALLBACK_METRICS = {
  Inter: [{ weight: '100 500', local: 'Arial', sizeAdjust: 107.34, ascent: 90.25, descent: 22.47 }, { weight: '600 900', local: 'Arial Bold', sizeAdjust: 101.11, ascent: 95.81, descent: 23.86 }],
  'Space Grotesk': [{ weight: '100 500', local: 'Arial', sizeAdjust: 110.88, ascent: 88.75, descent: 26.34 }, { weight: '600 900', local: 'Arial Bold', sizeAdjust: 102.52, ascent: 95.98, descent: 28.48 }],
};

const LOCAL_NAMES = {
  Arial: ["local('Arial')", "local('ArialMT')", "local('Liberation Sans')", "local('Arimo')"],
  'Arial Bold': ["local('Arial Bold')", "local('Arial-BoldMT')", "local('Liberation Sans Bold')", "local('Arimo Bold')"],
};

function fallbackFaces(family) {
  return (FALLBACK_METRICS[family] ?? [])
    .map(
      (m) =>
        `@font-face{font-family:'${family} Fallback';src:${LOCAL_NAMES[m.local].join(',')};font-weight:${m.weight};size-adjust:${m.sizeAdjust}%;ascent-override:${m.ascent}%;descent-override:${m.descent}%;line-gap-override:0%}`,
    )
    .join('\n');
}

const stack = (family, rest) => [`'${family}'`, FALLBACK_METRICS[family] ? `'${family} Fallback'` : null, rest].filter(Boolean).join(',');

// Weight ranges, not lists: Google serves one variable file per family for a
// range, so two families cost two font downloads.
export function googleFontsUrl(brand) {
  const { display, body } = brand.fonts;
  const family = (name, weights) => `family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@${weights}`;
  const families = display === body ? [family(body, '400..600')] : [family(body, '400..600'), family(display, '500..600')];
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

export function themeCss(brand) {
  const c = brand.colors;
  const white = '#FFFFFF';
  const light = {
    bg: c.paper,
    surface: mix(c.paper, white, 0.55),
    'surface-2': c.mist,
    text: c.ink,
    muted: ensureContrast(c.slate, c.mist, 4.5, c.ink),
    line: mix(c.mist, c.ink, 0.1),
    'line-strong': mix(c.mist, c.ink, 0.35),
    link: ensureContrast(mix(c.accent, c.ink, 0.12), c.mist, 4.5, c.ink),
    focus: c.accent,
    'btn-bg': c.accent,
    'btn-bg-hover': mix(c.accent, c.ink, 0.2),
    'btn-text': contrast(white, c.accent) >= 4.5 ? white : c.ink,
    'field-bg': white,
    'band-bg': c.ink,
    'band-text': c.paper,
    'band-muted': ensureContrast(mix(c.slate, c.paper, 0.5), c.ink, 4.5, c.paper),
    'band-line': mix(c.ink, c.paper, 0.18),
    'mark-body': c.slate,
    'mark-wing': c.ink,
    'mark-bar': white,
    'mark-perch': c.accent,
    'mark-legs': c.ink,
    'mark-eye': c.ink,
    song: c.accent,
    'song-warm': c.ember,
  };
  const darkBg = c.ink;
  const dark = {
    bg: darkBg,
    surface: mix(darkBg, c.paper, 0.045),
    'surface-2': mix(darkBg, c.paper, 0.08),
    text: c.paper,
    muted: ensureContrast(mix(c.slate, c.paper, 0.5), mix(darkBg, c.paper, 0.08), 4.5, c.paper),
    line: mix(darkBg, c.paper, 0.14),
    'line-strong': mix(darkBg, c.paper, 0.32),
    link: ensureContrast(mix(c.accent, white, 0.42), mix(darkBg, c.paper, 0.08), 4.5, white),
    focus: ensureContrast(mix(c.accent, white, 0.42), darkBg, 3, white),
    'field-bg': mix(darkBg, c.paper, 0.06),
    'band-bg': mix(darkBg, c.paper, 0.06),
    'band-line': mix(darkBg, c.paper, 0.16),
    'mark-body': mix(c.slate, c.paper, 0.55),
    'mark-wing': mix(darkBg, c.paper, 0.12),
    'mark-legs': mix(c.slate, c.paper, 0.55),
    song: ensureContrast(mix(c.accent, white, 0.25), darkBg, 3, white),
  };
  const vars = (obj) => Object.entries(obj).map(([k, v]) => `--${k}:${v}`).join(';');
  const palette = Object.entries(c).map(([k, v]) => `--brand-${k}:${v}`).join(';');
  const fonts = `--font-display:${stack(brand.fonts.display, 'ui-sans-serif,system-ui,sans-serif')};--font-body:${stack(brand.fonts.body, "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif")}`;
  return [
    fallbackFaces(brand.fonts.body),
    brand.fonts.display !== brand.fonts.body ? fallbackFaces(brand.fonts.display) : '',
    `:root{color-scheme:light dark;${palette};${fonts};${vars(light)}}`,
    `@media (prefers-color-scheme:dark){:root{${vars(dark)}}}`,
  ]
    .filter(Boolean)
    .join('\n');
}
