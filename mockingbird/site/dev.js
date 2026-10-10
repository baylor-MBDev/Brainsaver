// Local preview. Builds the site, serves dist/ the way Cloudflare's asset
// server does (directory indexes, trailing-slash redirects, 404.html,
// _headers), and runs /api/* through the real Worker with in-memory stand-ins
// for D1 and email. Rebuilds when site/, content/, or the config change.
//
//   node site/dev.js [--port 8788] [--drafts]
//
// To try Turnstile locally, use Cloudflare's test keys: put
// 1x00000000000000000000AA in config.site.turnstileSiteKey and run with
// TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA.

import { spawn } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { ROOT } from '../engine/lib/env.js';
import { c, log } from '../engine/lib/log.js';
import { buildSite, DEFAULT_CONTENT_DIR, DEFAULT_OUT_DIR } from './build.js';

const SITE_DIR = path.dirname(fileURLToPath(import.meta.url));

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

/**
 * A D1 stand-in covering what the Worker uses: prepare(sql).bind(...).run(),
 * .first(), .all(). INSERTs are parsed into row objects per table; SELECTs
 * return every row of the table named after FROM.
 */
export function memoryD1({ onInsert } = {}) {
  const tables = new Map();
  const rows = (table) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table);
  };
  const exec = (sql, params) => {
    const insert = sql.match(/^\s*insert\s+into\s+(\w+)\s*\(([^)]*)\)/i);
    if (insert) {
      const columns = insert[2].split(',').map((col) => col.trim());
      if (columns.length !== params.length) throw new Error(`D1_ERROR: ${columns.length} columns but ${params.length} values`);
      const row = Object.fromEntries(columns.map((col, i) => [col, params[i]]));
      rows(insert[1]).push(row);
      onInsert?.(insert[1], row);
      return { changes: 1, results: [] };
    }
    const from = sql.match(/\bfrom\s+(\w+)/i);
    return { changes: 0, results: from ? [...rows(from[1])] : [] };
  };
  return {
    tables,
    rows,
    prepare(sql) {
      let params = [];
      const statement = {
        bind(...values) {
          // Real D1 rejects undefined; catching it here catches Worker bugs.
          if (values.some((v) => v === undefined)) throw new TypeError('D1_TYPE_ERROR: undefined is not a supported bind value');
          params = values;
          return statement;
        },
        async run() {
          const { changes, results } = exec(sql, params);
          return { success: true, meta: { changes }, results };
        },
        async first(column) {
          const row = exec(sql, params).results[0] ?? null;
          return column && row ? row[column] : row;
        },
        async all() {
          return { success: true, meta: {}, results: exec(sql, params).results };
        },
      };
      return statement;
    },
  };
}

/** Serve a built site folder like Workers static assets: index.html for
 * directories (redirecting /about to /about/), dist/404.html with a 404
 * status for misses, and headers from the _headers file. */
export function staticAssets(dir = DEFAULT_OUT_DIR) {
  const root = path.resolve(dir);

  const isFile = async (file) => (await stat(file).catch(() => null))?.isFile() ?? false;

  async function resolve(pathname) {
    const target = path.join(root, pathname);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
    if (path.basename(target) === '_headers') return null;
    const info = await stat(target).catch(() => null);
    if (info?.isFile()) return { file: target };
    if (info?.isDirectory() && (await isFile(path.join(target, 'index.html')))) {
      return pathname.endsWith('/') ? { file: path.join(target, 'index.html') } : { redirect: `${pathname}/` };
    }
    return null;
  }

  async function headerRules() {
    const text = await readFile(path.join(root, '_headers'), 'utf8').catch(() => '');
    const rules = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      if (!/^\s/.test(line)) {
        const source = line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        rules.push({ pattern: new RegExp(`^${source}$`), headers: [] });
      } else {
        const match = line.trim().match(/^([^:]+):\s*(.*)$/);
        if (match && rules.length) rules.at(-1).headers.push([match[1], match[2]]);
      }
    }
    return rules;
  }

  async function respond(file, status, pathname, method) {
    const headers = new Headers({ 'content-type': CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
    for (const rule of await headerRules()) {
      if (rule.pattern.test(pathname)) for (const [name, value] of rule.headers) headers.set(name, value);
    }
    if (!headers.has('cache-control')) headers.set('cache-control', 'no-cache');
    const body = method === 'HEAD' ? null : await readFile(file);
    return new Response(body, { status, headers });
  }

  return {
    async fetch(input, init) {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        pathname = null;
      }
      const found = pathname && !pathname.includes('\0') ? await resolve(pathname) : null;
      if (found?.redirect) return new Response(null, { status: 307, headers: { location: `${found.redirect}${url.search}` } });
      if (found) return respond(found.file, 200, pathname, request.method);
      const notFound = path.join(root, '404.html');
      if (await isFile(notFound)) return respond(notFound, 404, url.pathname, request.method);
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    },
  };
}

/** Bindings for running the Worker locally: in-memory D1, email that
 * prints to the console, and assets served from dist/. */
export function createDevEnv({ assetsDir = DEFAULT_OUT_DIR, turnstileSecret = process.env.TURNSTILE_SECRET_KEY } = {}) {
  const env = {
    ASSETS: staticAssets(assetsDir),
    DB: memoryD1({
      onInsert: (table, row) => log.ok(`D1 ${table}: stored ${row.type ?? ''} lead ${row.id} from ${row.email}`),
    }),
    NOTIFY: {
      async send(message) {
        log.info(c.cyan(`\n— email (dev, not sent) ${'—'.repeat(30)}`));
        log.info(`To: ${message.to}\nFrom: ${message.from}\nReply-To: ${message.replyTo}\nSubject: ${message.subject}\n\n${message.text}`);
        log.info(c.cyan('—'.repeat(55)));
      },
    },
    NOTIFY_TO: 'you@example.com',
    NOTIFY_FROM: 'site@example.com',
  };
  if (turnstileSecret) env.TURNSTILE_SECRET_KEY = turnstileSecret;
  return env;
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const SKIP_HEADERS = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive']);

async function main() {
  const { values } = parseArgs({ options: { port: { type: 'string', default: '8788' }, drafts: { type: 'boolean', default: false } } });
  const port = Number.parseInt(values.port, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`--port must be a port number, got "${values.port}"`);

  const { default: config } = await import('../mockingbird.config.js');
  const result = await buildSite({ config, includeDrafts: values.drafts });
  for (const warning of result.warnings) log.warn(warning);
  log.ok(`Built ${result.pages.length} pages and ${result.posts.length} blog posts${values.drafts ? ' including drafts' : ''}`);

  let worker = (await import('./worker/index.js')).default;
  const env = createDevEnv();
  const ctx = { waitUntil: (promise) => Promise.resolve(promise).catch((err) => log.error(err.message)), passThroughOnException() {} };

  const server = http.createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `127.0.0.1:${port}`}`);
    const isApi = url.pathname.startsWith('/api/');
    let response;
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (value !== undefined && !SKIP_HEADERS.has(name)) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      headers.set('cf-connecting-ip', req.socket.remoteAddress ?? '127.0.0.1');
      const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
      const request = new Request(url, { method, headers, body });
      // Mirrors run_worker_first: ["/api/*"]. Everything else is assets.
      response = isApi ? await worker.fetch(request, env, ctx) : await env.ASSETS.fetch(request);
    } catch (err) {
      log.error(err.stack ?? err.message);
      response = new Response('Internal error (see terminal)', { status: 500 });
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(method === 'HEAD' || !response.body ? undefined : Buffer.from(await response.arrayBuffer()));
    if (isApi || response.status >= 500) log.info(c.dim(`${method} ${url.pathname} -> ${response.status}`));
  });

  server.listen(port, '127.0.0.1', () => {
    log.ok(`Preview: ${c.bold(`http://127.0.0.1:${port}/`)}`);
    log.info(c.dim('API routes run the real Worker with an in-memory D1; emails print here. Ctrl+C to stop.'));
  });

  // Rebuild in a child process so edits to templates and config are picked
  // up (an in-process rebuild would reuse the cached modules).
  let timer = null;
  let running = false;
  let queued = false;
  const rebuild = () => {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    const child = spawn(process.execPath, [path.join(SITE_DIR, 'build.js'), ...(values.drafts ? ['--drafts'] : [])], { stdio: 'inherit' });
    child.on('exit', () => {
      running = false;
      if (queued) {
        queued = false;
        rebuild();
      }
    });
  };
  let workerChanged = false;
  // Editors often fire several events per save; act once they settle.
  const schedule = (changed) => {
    if (changed.includes(`${path.sep}worker${path.sep}`)) workerChanged = true;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (workerChanged) {
        workerChanged = false;
        // Re-imports worker/index.js only; restart after editing a module it imports.
        try {
          worker = (await import(`./worker/index.js?v=${Date.now()}`)).default;
          log.ok('Reloaded the Worker');
        } catch (err) {
          log.error(`Worker reload failed, keeping the previous version: ${err.message}`);
        }
      }
      rebuild();
    }, 150);
  };
  // Watch sources only. A recursive watch over site/ would include dist/,
  // which every build deletes and recreates under the watcher's feet.
  const targets = [
    ...['assets', 'lib', 'pages', 'worker'].map((dir) => ({ dir: path.join(SITE_DIR, dir), recursive: true })),
    { dir: SITE_DIR, recursive: false, only: /\.js$/ },
    { dir: path.dirname(DEFAULT_CONTENT_DIR), recursive: true, only: /\.md$/ },
    { dir: ROOT, recursive: false, only: /^mockingbird\.config\.js$/ },
  ];
  for (const { dir, recursive, only } of targets) {
    if (!existsSync(dir)) continue;
    try {
      const watcher = watch(dir, { recursive }, (event, filename) => {
        if (filename && (!only || only.test(path.basename(filename)))) schedule(path.join(dir, filename));
      });
      watcher.on('error', (err) => log.warn(`Stopped watching ${path.relative(ROOT, dir) || '.'}: ${err.message}`));
    } catch (err) {
      log.warn(`Not watching ${path.relative(ROOT, dir) || '.'} for changes: ${err.message}`);
    }
  }

  process.on('SIGINT', () => {
    server.close();
    process.exit(0);
  });
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((err) => {
    log.error(err.message);
    process.exitCode = 1;
  });
}
