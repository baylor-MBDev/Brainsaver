// A small YAML-subset parser for blog post frontmatter. It covers what posts
// use and nothing more: quoted or bare strings, numbers, booleans, null,
// dates (kept as strings, so 2026-10-10 never shifts across time zones),
// inline arrays ([a, b]) and "- item" lists. Anything else is an error with a
// line number, so a malformed post fails the build instead of rendering wrong.

const OPEN = /^---\s*$/;
const CLOSE = /^(---|\.\.\.)\s*$/;

export function parseFrontmatter(source) {
  const text = String(source ?? '').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/);
  if (!OPEN.test(lines[0] ?? '')) return { data: {}, body: text };
  const end = lines.findIndex((line, i) => i > 0 && CLOSE.test(line));
  if (end === -1) throw new Error('Frontmatter opens with --- but never closes');
  return {
    data: parseYamlLines(lines.slice(1, end), 2),
    body: lines.slice(end + 1).join('\n').replace(/^\s*\n/, ''),
  };
}

export function parseYamlLines(lines, firstLineNumber = 1) {
  const data = {};
  const openLists = new Set();
  let listKey = null;
  lines.forEach((line, i) => {
    const where = `frontmatter line ${firstLineNumber + i}`;
    if (!line.trim() || /^\s*#/.test(line)) return;

    const item = line.match(/^\s*-(?:\s+(.*))?$/);
    if (item) {
      if (!listKey) throw new Error(`${where}: list item without a key above it`);
      data[listKey].push(parseScalar(stripComment(item[1] ?? ''), where));
      return;
    }

    const pair = line.match(/^([A-Za-z_][\w-]*)\s*:(?:\s+(.*?))?\s*$/);
    if (!pair) throw new Error(`${where}: expected "key: value", got "${line.trim()}"`);
    const [, key, rawValue = ''] = pair;
    const value = stripComment(rawValue);
    if (value === '') {
      // Either an empty value or the start of a "- item" list.
      data[key] = [];
      openLists.add(key);
      listKey = key;
      return;
    }
    listKey = null;
    openLists.delete(key);
    data[key] = parseScalar(value, where);
  });
  // A key with nothing under it is empty, not an empty list.
  for (const key of openLists) if (!data[key].length) data[key] = null;
  return data;
}

/** Remove a trailing " # comment", respecting quotes and inline arrays. */
function stripComment(value) {
  const v = value.trim();
  if (v.startsWith('"') || v.startsWith("'")) {
    const end = closingQuote(v);
    return end === -1 ? v : v.slice(0, end + 1);
  }
  if (v.startsWith('[')) {
    const end = v.lastIndexOf(']');
    return end === -1 ? v : v.slice(0, end + 1);
  }
  return v.replace(/\s+#.*$/, '').trim();
}

function closingQuote(v) {
  const quote = v[0];
  for (let i = 1; i < v.length; i++) {
    if (quote === '"' && v[i] === '\\') {
      i++;
      continue;
    }
    if (v[i] === quote) {
      if (quote === "'" && v[i + 1] === "'") {
        i++;
        continue;
      }
      return i;
    }
  }
  return -1;
}

export function parseScalar(raw, where = 'frontmatter') {
  const value = String(raw ?? '').trim();
  if (value === '') return null;
  if (value.startsWith('"')) {
    if (closingQuote(value) !== value.length - 1) throw new Error(`${where}: unterminated "quoted" string`);
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'")) {
    if (closingQuote(value) !== value.length - 1) throw new Error(`${where}: unterminated 'quoted' string`);
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith('[')) {
    if (!value.endsWith(']')) throw new Error(`${where}: inline list is missing its closing ]`);
    return splitInlineList(value.slice(1, -1)).map((part) => parseScalar(part, where)).filter((v) => v !== null);
  }
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^(null|~)$/i.test(value)) return null;
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function splitInlineList(inner) {
  const parts = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      current += ch;
      if (ch === '\\' && quote === '"') current += inner[++i] ?? '';
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ',') {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() || parts.length) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}
