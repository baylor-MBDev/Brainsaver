import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Load ROOT/.env into process.env without overriding variables already set. */
export function loadEnv(file = path.join(ROOT, '.env')) {
  if (!existsSync(file)) return false;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const [, key, rawValue = ''] = match;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    process.env[key] = value.replace(/\\n/g, '\n');
  }
  return true;
}

export const env = (name, fallback = '') => {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
};

export const dataDir = () => path.resolve(env('MB_DATA_DIR', path.join(ROOT, 'data')));
