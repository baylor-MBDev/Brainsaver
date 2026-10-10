import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { labelFor } from '../audit/fingerprints.js';
import { ActionError, addNote, approve, exportLeads, mark, setPrimaryContact, suppress, updatePitch } from '../lib/actions.js';
import { SERVICES, sendingBlockers } from '../lib/config.js';
import { primaryContact, STAGES } from '../lib/store.js';
import { normalizeDomain } from '../lib/util.js';
import { renderEmail } from '../outreach/context.js';
import { exportBlocker, FORMATS } from '../outreach/export.js';

/*
 * Local review dashboard: a small JSON API over the lead store plus one page.
 *
 * Any website the user has open can fire requests at 127.0.0.1, so every
 * request is checked twice: the Host header must name this server (defeats
 * DNS rebinding, where evil.example suddenly resolves to 127.0.0.1) and API
 * calls must carry a per-run token that only the served page knows (defeats
 * cross-site requests). There are no CORS headers, so other origins can't
 * read responses either.
 */

const UI_FILE = fileURLToPath(new URL('./ui.html', import.meta.url));
const MAX_BODY_BYTES = 1024 * 1024;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Same per-step limits as outreach/lint.js, so the editor can count words live
// against the numbers lint will hold the copy to.
const wordLimits = (maxWords) => ({ 1: maxWords, 2: 70, 3: 45 });

const BASE_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ');
const serviceOf = (company) => company.primaryService ?? company.serviceHint ?? null;

function topFinding(company) {
  const service = serviceOf(company);
  let best = null;
  for (const f of company.findings ?? []) {
    if (f.service === service && f.weight > 0 && (!best || f.weight > best.weight)) best = f;
  }
  return best?.title ?? null;
}

function listItem(company) {
  const contact = primaryContact(company);
  const lint = company.pitch?.lint ?? [];
  return {
    id: company.id,
    name: company.name ?? company.domain ?? company.id,
    domain: company.domain ?? null,
    website: company.website ?? null,
    city: company.city ?? null,
    state: company.state ?? null,
    stage: company.stage ?? null,
    skipReason: company.skipReason ?? null,
    primaryService: serviceOf(company),
    scores: company.scores ?? null,
    icp: company.icp ?? null,
    channel: company.channel ?? null,
    contact: contact
      ? { id: contact.id ?? null, name: fullName(contact) || null, title: contact.title ?? null, email: contact.email ?? null, emailStatus: contact.emailStatus ?? null }
      : null,
    topFinding: topFinding(company),
    subject: company.pitch?.subject ?? null,
    lint: { errors: lint.filter((i) => i.level === 'error').length, warnings: lint.filter((i) => i.level === 'warn').length },
    demoUrl: company.demo?.url ?? null,
    updatedAt: company.updatedAt ?? null,
  };
}

function matchesQuery(company, q) {
  if (!q) return true;
  const fields = [company.name, company.domain, company.city, ...(company.contacts ?? []).map((p) => p.email)];
  return fields.some((value) => value && String(value).toLowerCase().includes(q));
}

// "pitched" or "skipped,lost"; Store.list() takes either form.
function filterParam(params, key) {
  const values = (params.get(key) ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  if (!values.length) return undefined;
  return values.length === 1 ? values[0] : values;
}

function techIds(signals) {
  if (!signals) return [];
  const fromTech = ['builder', 'cms', 'framework'].flatMap((key) => signals.tech?.[key] ?? []);
  const rest = ['analytics', 'chat', 'booking', 'ecommerce', 'reviews', 'crm', 'formBuilders'].flatMap((key) => signals[key] ?? []);
  return [...new Set([...fromTech, ...rest])];
}

function pitchEdit({ subject, altSubjects, emails }) {
  if (subject !== undefined && typeof subject !== 'string') throw new ActionError('"subject" must be a string');
  if (altSubjects !== undefined && !(Array.isArray(altSubjects) && altSubjects.every((s) => typeof s === 'string'))) {
    throw new ActionError('"altSubjects" must be a list of strings');
  }
  if (emails !== undefined && !(Array.isArray(emails) && emails.every((e) => e && typeof e === 'object' && typeof e.body === 'string'))) {
    throw new ActionError('"emails" must be a list of { step, body }');
  }
  return { subject, altSubjects, emails };
}

function optionalString(value, name) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new ActionError(`"${name}" must be a string`);
  return value;
}

function requiredString(value, name) {
  const s = optionalString(value, name)?.trim();
  if (!s) throw new ActionError(`"${name}" is required`);
  return s;
}

function createApi({ store, config }) {
  async function load(id) {
    const company = await store.get(id);
    if (!company) throw new ActionError(`No lead with id "${id}"`, { status: 404 });
    return company;
  }

  // The full record, plus what the page can't work out on its own: the exact
  // text that will be sent (footer included) and why export would refuse it.
  async function detail(company) {
    const demoUrl = company.demo?.url;
    return {
      ...company,
      rendered: (company.pitch?.emails ?? []).map((email) => ({
        step: email.step,
        delayDays: email.delayDays ?? null,
        text: renderEmail(email.body ?? '', { config, demoUrl }),
      })),
      techLabels: Object.fromEntries(techIds(company.audit?.signals).map((id) => [id, labelFor(id)])),
      exportBlocker: exportBlocker(company, await store.suppression(), store),
      listItem: listItem(company),
    };
  }

  async function summary() {
    const all = await store.list();
    const byStage = Object.fromEntries(STAGES.map((stage) => [stage, 0]));
    const byService = Object.fromEntries(SERVICES.map((service) => [service, 0]));
    const byStageService = {};
    for (const company of all) {
      byStage[company.stage] = (byStage[company.stage] ?? 0) + 1;
      const service = serviceOf(company);
      if (!service) continue;
      byService[service] = (byService[service] ?? 0) + 1;
      const row = (byStageService[company.stage] ??= {});
      row[service] = (row[service] ?? 0) + 1;
    }
    return {
      business: { name: config.business?.name ?? '', shortName: config.business?.shortName ?? null },
      services: Object.fromEntries(SERVICES.map((service) => [service, config.services?.[service]?.label ?? service])),
      icps: Object.fromEntries(Object.entries(config.icps ?? {}).map(([id, icp]) => [id, icp.label ?? id])),
      stages: STAGES,
      total: all.length,
      byStage,
      byService,
      byStageService,
      blockers: sendingBlockers(config),
      qualifyAt: config.scoring?.qualifyAt ?? null,
      wordLimits: wordLimits(config.outreach?.maxWords ?? 110),
      formats: FORMATS,
    };
  }

  async function leads(params) {
    const q = (params.get('q') ?? '').trim().toLowerCase();
    const companies = await store.list({ stage: filterParam(params, 'stage'), service: filterParam(params, 'service'), icp: filterParam(params, 'icp') });
    const items = companies.filter((co) => matchesQuery(co, q)).map(listItem);
    // Best opportunities first, and an order that doesn't shuffle while you
    // edit (the store's own order is most recently updated first).
    const score = (item) => item.scores?.[item.primaryService] ?? -1;
    items.sort((a, b) => score(b) - score(a) || String(a.name).localeCompare(String(b.name)));
    return { leads: items };
  }

  async function suppressValue({ value, reason }) {
    const v = (optionalString(value, 'value') ?? '').trim();
    // Same rule Store.suppress applies, checked here so a typo is a 400, not a 500.
    if (!(v.includes('@') ? EMAIL.test(v) : normalizeDomain(v))) throw new ActionError('Enter an email address or a domain to suppress');
    const affected = await suppress(store, v, optionalString(reason, 'reason')?.trim() || 'manual');
    return { value: v.toLowerCase(), affected };
  }

  async function exportCsv({ format = 'instantly', html = false, markQueued = true }) {
    if (!FORMATS.includes(format)) throw new ActionError(`Unknown export format "${format}". Use one of: ${FORMATS.join(', ')}`);
    const result = await exportLeads(store, config, { format, html: html === true, markQueued: markQueued !== false });
    return { format, csv: result.csv, exported: result.exported, blocked: result.blocked };
  }

  return [
    { method: 'GET', path: /^\/api\/summary$/, run: () => summary() },
    { method: 'GET', path: /^\/api\/leads$/, run: ({ url }) => leads(url.searchParams) },
    { method: 'GET', path: /^\/api\/leads\/([^/]+)$/, run: async ({ id }) => detail(await load(id)) },
    { method: 'PUT', path: /^\/api\/leads\/([^/]+)\/pitch$/, run: async ({ id, body }) => detail(await updatePitch(store, id, pitchEdit(body), { config })) },
    { method: 'POST', path: /^\/api\/leads\/([^/]+)\/approve$/, run: async ({ id }) => detail(await approve(store, id, { config })) },
    {
      method: 'POST',
      path: /^\/api\/leads\/([^/]+)\/stage$/,
      run: async ({ id, body }) => detail(await mark(store, id, requiredString(body.stage, 'stage'), optionalString(body.note, 'note')?.trim())),
    },
    { method: 'PUT', path: /^\/api\/leads\/([^/]+)\/notes$/, run: async ({ id, body }) => detail(await addNote(store, id, optionalString(body.notes, 'notes') ?? '')) },
    {
      method: 'POST',
      path: /^\/api\/leads\/([^/]+)\/contact$/,
      run: async ({ id, body }) => detail(await setPrimaryContact(store, id, requiredString(body.contactId, 'contactId'))),
    },
    { method: 'POST', path: /^\/api\/suppress$/, run: ({ body }) => suppressValue(body) },
    { method: 'POST', path: /^\/api\/export$/, run: ({ body }) => exportCsv(body) },
  ];
}

async function readJson(req) {
  if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) throw new ActionError('Request body is too large', { status: 413 });
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new ActionError('Request body is too large', { status: 413 });
    chunks.push(chunk);
  }
  if (!size) return {};
  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ActionError('Request body is not valid JSON');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ActionError('Request body must be a JSON object');
  return data;
}

function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { ...BASE_HEADERS, 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), ...headers });
  res.end(body);
}

function sendError(res, err) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  const status = err instanceof ActionError ? err.status : 500;
  if (status >= 500) console.error(err);
  // After a refused oversized body, don't try to drain the rest of it.
  sendJson(res, status, { error: err.message, details: err.details }, status === 413 ? { connection: 'close' } : {});
}

/**
 * Start the review dashboard. Resolves once it's listening.
 * @returns {Promise<{ url: string, token: string, port: number, close: () => Promise<void> }>}
 */
export async function startDashboard({ store, config, port = 4400, host = '127.0.0.1' } = {}) {
  if (!store || !config) throw new Error('startDashboard needs { store, config }');
  if (!LOOPBACK.has(host)) throw new Error(`The dashboard only listens on this computer (127.0.0.1), not on "${host}"`);

  const token = randomBytes(32).toString('hex');
  const tokenBytes = Buffer.from(token);
  const page = (await readFile(UI_FILE, 'utf8')).replaceAll('__MB_TOKEN__', token);
  const routes = createApi({ store, config });

  const tokenOk = (value) => {
    if (typeof value !== 'string') return false;
    const given = Buffer.from(value);
    return given.length === tokenBytes.length && timingSafeEqual(given, tokenBytes);
  };

  const hostOk = (value) => {
    const { port: actual } = server.address();
    const h = String(value ?? '').toLowerCase();
    return h === `127.0.0.1:${actual}` || h === `localhost:${actual}` || (host === '::1' && h === `[::1]:${actual}`);
  };

  function sendPage(res) {
    // A fresh nonce per response: only our own inline <script>/<style> run, so
    // markup that sneaks in from a scraped site can't execute even if it lands
    // in the DOM.
    const nonce = randomBytes(16).toString('base64');
    const csp = [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      `style-src 'nonce-${nonce}'`,
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; ');
    res.writeHead(200, { ...BASE_HEADERS, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': csp });
    res.end(page.replaceAll('__MB_NONCE__', nonce));
  }

  async function handle(req, res) {
    if (!hostOk(req.headers.host)) return sendJson(res, 403, { error: 'Forbidden: unexpected Host header' });
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/') {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' }, { allow: 'GET' });
      return sendPage(res);
    }
    if (!url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Not found' });
    if (!tokenOk(req.headers['x-mb-token'])) return sendJson(res, 403, { error: 'Missing or invalid dashboard token. Reload the page.' });

    const candidates = routes.filter((route) => route.path.test(url.pathname));
    if (!candidates.length) return sendJson(res, 404, { error: 'Not found' });
    const route = candidates.find((r) => r.method === req.method);
    if (!route) return sendJson(res, 405, { error: 'Method not allowed' }, { allow: candidates.map((r) => r.method).join(', ') });

    let id;
    try {
      const raw = url.pathname.match(route.path)[1];
      id = raw === undefined ? undefined : decodeURIComponent(raw);
    } catch {
      throw new ActionError('Malformed lead id in the URL');
    }
    const body = req.method === 'GET' ? {} : await readJson(req);
    sendJson(res, 200, await route.run({ id, url, body }));
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => sendError(res, err));
  });

  await new Promise((resolve, reject) => {
    const failed = (err) => {
      reject(err.code === 'EADDRINUSE' ? new Error(`Port ${port} is already in use. Is the dashboard already running? Pick another port.`) : err);
    };
    server.once('error', failed);
    server.listen(port, host, () => {
      server.off('error', failed);
      resolve();
    });
  });

  const actualPort = server.address().port;
  return {
    url: `http://${host === '::1' ? '[::1]' : host}:${actualPort}/`,
    token,
    port: actualPort,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeIdleConnections();
      }),
  };
}
