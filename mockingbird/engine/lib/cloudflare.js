import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, env } from './env.js';
import { requestJson } from './http.js';

/** JSONC (comments, trailing commas) → JSON, without touching "//" inside strings. */
export function parseJsonc(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') out += text[++i] ?? '';
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else {
      out += ch;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

export async function d1DatabaseId() {
  const fromEnv = env('CLOUDFLARE_D1_DATABASE_ID');
  if (fromEnv) return fromEnv;
  try {
    const config = parseJsonc(await readFile(path.join(ROOT, 'site', 'wrangler.jsonc'), 'utf8'));
    const id = config.d1_databases?.find((db) => db.binding === 'DB')?.database_id;
    return id && !/REPLACE/i.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Run one SQL statement against the site's D1 database over Cloudflare's REST API. */
export async function d1Query(sql, params = [], { fetch } = {}) {
  const accountId = env('CLOUDFLARE_ACCOUNT_ID');
  const apiToken = env('CLOUDFLARE_API_TOKEN');
  const databaseId = await d1DatabaseId();
  if (!accountId || !apiToken) throw new Error('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env (the token needs D1 access).');
  if (!databaseId) throw new Error('No D1 database id: set database_id in site/wrangler.jsonc or CLOUDFLARE_D1_DATABASE_ID in .env.');
  const data = await requestJson(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiToken}` },
    json: { sql, params },
    fetch,
  });
  if (data.success === false) throw new Error(`D1 query failed: ${JSON.stringify(data.errors ?? data)}`);
  return data.result?.[0]?.results ?? [];
}
