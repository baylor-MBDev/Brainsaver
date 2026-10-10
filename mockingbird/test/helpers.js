import { readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const fixture = (name) => readFileSync(path.join(here, 'fixtures', name), 'utf8');

export const tempDir = (prefix = 'mb-test-') => mkdtemp(path.join(tmpdir(), prefix));

/**
 * A fetch() stand-in. `routes` maps a URL (exact, or a RegExp source when the
 * key starts with "re:") to a response spec:
 *   { status, body, headers, redirect: 'https://…' }  or  { error: 'ENOTFOUND' }
 * Unmatched URLs fail like an unreachable host. Every call is recorded in
 * `fake.calls`.
 */
export function fakeFetch(routes) {
  const calls = [];
  const find = (url) => {
    if (routes[url]) return routes[url];
    for (const [key, spec] of Object.entries(routes)) {
      if (key.startsWith('re:') && new RegExp(key.slice(3)).test(url)) return spec;
    }
    return null;
  };
  const fake = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init, body: init.body ? safeJson(init.body) : undefined });
    let spec = find(url);
    if (typeof spec === 'function') spec = await spec(url, init);
    if (!spec || spec.error) {
      const err = new TypeError('fetch failed');
      err.cause = { code: spec?.error ?? 'ENOTFOUND', message: spec?.error ?? 'getaddrinfo ENOTFOUND' };
      throw err;
    }
    if (spec.redirect) {
      if (init.redirect === 'manual') {
        return new Response(null, { status: spec.status ?? 301, headers: { location: spec.redirect } });
      }
      return fake(spec.redirect, init);
    }
    const body = typeof spec.body === 'string' || spec.body === undefined ? spec.body ?? '' : JSON.stringify(spec.body);
    const headers = { 'content-type': typeof spec.body === 'object' ? 'application/json' : 'text/html; charset=utf-8', ...(spec.headers ?? {}) };
    const res = new Response(body, { status: spec.status ?? 200, headers });
    Object.defineProperty(res, 'url', { value: url });
    return res;
  };
  fake.calls = calls;
  return fake;
}

function safeJson(body) {
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}
