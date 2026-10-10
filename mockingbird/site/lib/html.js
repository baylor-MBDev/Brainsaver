import { escapeHtml } from '../../engine/lib/util.js';

// Tagged-template HTML. Interpolated values are escaped unless wrapped with
// raw() (or produced by another html`` call), so config text and post titles
// can't break markup. null/undefined/booleans render as nothing, which keeps
// `cond && html`...`` patterns from printing "false" or "undefined".

class SafeHtml {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

export const raw = (value) => new SafeHtml(String(value ?? ''));

function render(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (Array.isArray(value)) return value.map(render).join('');
  if (value instanceof SafeHtml) return value.value;
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

/** JSON for a <script type="application/ld+json"> block. `<` is escaped so
 * text can never close the script element early. */
export function jsonLdScript(data) {
  const json = JSON.stringify(compact(data)).replace(/</g, '\\u003c');
  return raw(`<script type="application/ld+json">${json}</script>`);
}

/** Drop null/undefined/empty-string/empty-array fields, recursively, so
 * optional config fields never show up as "null" in structured data. */
export function compact(value) {
  if (Array.isArray(value)) {
    return value.map(compact).filter((v) => v !== undefined);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      const c = compact(v);
      if (c === undefined || (Array.isArray(c) && !c.length)) continue;
      out[key] = c;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (value === null || value === undefined || value === '') return undefined;
  return value;
}

export function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
