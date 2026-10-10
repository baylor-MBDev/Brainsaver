// Just enough HTML scanning to audit a homepage, without a DOM library.
// Good at what audits need (tags, attributes, visible text), and tolerant of
// the broken markup that a lot of small-business sites ship.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', bull: '•', trade: '™' };

export function decodeEntities(text) {
  return String(text ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function parseAttrs(source = '') {
  const attrs = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(source))) {
    const name = m[1].toLowerCase();
    if (!(name in attrs)) attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

/** Remove comments and the contents of tags that never render as text. */
export function stripNonContent(html) {
  return String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg|iframe)\b[\s\S]*?<\/\1\s*>/gi, ' ');
}

/** All opening tags (optionally only some names) with parsed attributes. */
export function scanTags(html, names) {
  const wanted = names ? new Set(names.map((n) => n.toLowerCase())) : null;
  const out = [];
  const re = /<([a-zA-Z][a-zA-Z0-9-]*)(\s[^<>]*?)?\s*\/?>/g;
  let m;
  while ((m = re.exec(html))) {
    const name = m[1].toLowerCase();
    if (wanted && !wanted.has(name)) continue;
    out.push({ name, attrs: parseAttrs(m[2] ?? ''), index: m.index });
  }
  return out;
}

/** Elements with their inner HTML, e.g. every <a>…</a> or <h2>…</h2>. */
export function scanElements(html, name) {
  const out = [];
  const re = new RegExp(`<${name}(\\s[^<>]*?)?>([\\s\\S]*?)<\\/${name}\\s*>`, 'gi');
  let m;
  while ((m = re.exec(html))) out.push({ attrs: parseAttrs(m[1] ?? ''), inner: m[2], index: m.index });
  return out;
}

export function textOf(fragment) {
  return decodeEntities(String(fragment ?? '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Visible text of a whole document. */
export function visibleText(html) {
  return textOf(stripNonContent(html).replace(/<head\b[\s\S]*?<\/head>/i, ' '));
}

export function extractJsonLd(html) {
  const out = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
      out.push(...items.filter((x) => x && typeof x === 'object'));
    } catch {
      // Invalid JSON-LD is common; ignore it.
    }
  }
  return out;
}

export function metaContent(tags, key) {
  const k = key.toLowerCase();
  const tag = tags.find((t) => t.name === 'meta' && ((t.attrs.name ?? '').toLowerCase() === k || (t.attrs.property ?? '').toLowerCase() === k));
  return tag?.attrs.content?.trim() || null;
}

export function resolveUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}
