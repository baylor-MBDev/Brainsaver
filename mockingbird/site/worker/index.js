// Cloudflare Worker for mockingbird-site. Pages are static files in ./dist
// served by the assets binding; only /api/* runs this code first (see
// run_worker_first in wrangler.jsonc). Add new endpoints to `routes`.
//
// Bindings and settings (all optional except DB and ASSETS):
//   DB                    D1 database with the inbound_leads table (migrations/)
//   ASSETS                the static site
//   NOTIFY                Cloudflare Email send_email binding for lead alerts
//   NOTIFY_TO/NOTIFY_FROM where alerts go / come from (vars)
//   TURNSTILE_SECRET_KEY  enables Turnstile verification (secret)
//   IP_HASH_SALT          salts the stored IP hash (secret, recommended)

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_BODY_BYTES = 64 * 1024;
const LEAD_TYPES = ['contact', 'audit'];
// The service keys in mockingbird.config.js, plus "other".
const SERVICES = ['websites', 'automation', 'apps', 'other'];
// Where a no-JavaScript form submission is sent back to on error.
const FORM_PAGES = { contact: '/contact/', audit: '/free-audit/' };

const FIELDS = {
  name: { max: 200, label: 'Name' },
  email: { max: 254, label: 'Email' },
  company: { max: 200, label: 'Company' },
  website: { max: 500, label: 'Website' },
  business_type: { max: 200, label: 'Business type' },
  budget: { max: 100, label: 'Budget' },
  message: { max: 5000, label: 'Message', multiline: true },
  utm_source: { max: 200, label: 'utm_source' },
  utm_medium: { max: 200, label: 'utm_medium' },
  utm_campaign: { max: 200, label: 'utm_campaign' },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEBSITE = /^(https?:\/\/)?[^\s/?#@]+\.[^\s/?#@]{2,}([/?#]\S*)?$/i;

const COLUMNS = ['id', 'created_at', 'type', 'name', 'email', 'company', 'website', 'business_type', 'service', 'budget', 'message', 'page', 'utm_source', 'utm_medium', 'utm_campaign', 'ip_hash', 'user_agent'];
const INSERT_LEAD = `INSERT INTO inbound_leads (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`;

export const routes = {
  '/api/contact': { POST: handleContact },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const route = routes[url.pathname.replace(/\/+$/, '')];
    if (!route) return json({ ok: false, error: 'Not found' }, 404);
    const handler = route[request.method];
    if (!handler) return json({ ok: false, error: 'Method not allowed' }, 405, { allow: Object.keys(route).join(', ') });
    try {
      return await handler(request, env, ctx);
    } catch (err) {
      console.error(`${request.method} ${url.pathname} failed:`, err);
      return json({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
    }
  },
};

/** POST /api/contact: the contact form (type=contact) and the free website
 * check-up form (type=audit). Form-encoded or JSON. */
export async function handleContact(request, env) {
  const wantsJson = isJsonRequest(request);
  let input = {};
  let readError = null;
  try {
    input = await readBody(request);
  } catch (err) {
    readError = err;
  }

  const rawType = text(input.type).toLowerCase();
  const type = rawType ? (LEAD_TYPES.includes(rawType) ? rawType : null) : 'contact';
  const respond = responder(request, wantsJson, type ?? 'contact');
  if (readError) return respond.fail(readError.status ?? 400, readError.message, 'invalid');

  // No cookies or auth are involved, so this isn't CSRF protection; it just
  // stops other sites from posting into our lead table.
  const origin = request.headers.get('origin');
  if (origin && origin !== 'null' && hostOf(origin) !== new URL(request.url).host) {
    return respond.fail(403, 'This form can only be sent from our website.', 'invalid');
  }

  // Honeypot: people never see this field. Pretend it worked, keep nothing.
  if (text(input.company_url)) return respond.ok();

  if (!type) return respond.fail(400, 'Unknown form type.', 'invalid');
  const { lead, error } = validate(input, type);
  if (error) return respond.fail(400, error, 'invalid');

  const ip = request.headers.get('cf-connecting-ip') ?? '';
  if (env.TURNSTILE_SECRET_KEY) {
    const passed = await verifyTurnstile(text(input['cf-turnstile-response']), env.TURNSTILE_SECRET_KEY, ip);
    if (!passed) return respond.fail(403, 'We couldn’t confirm the form was sent by a person. Please try again.', 'spam');
  }

  const referer = refererUrl(request);
  const utm = (key) => lead[key] || referer?.searchParams.get(key)?.slice(0, FIELDS[key].max) || null;
  const record = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    type,
    ...lead,
    page: referer ? referer.pathname.slice(0, 300) : null,
    utm_source: utm('utm_source'),
    utm_medium: utm('utm_medium'),
    utm_campaign: utm('utm_campaign'),
    // Never the raw IP. Salting matters: an unsalted IPv4 hash can be
    // reversed by brute force.
    ip_hash: ip ? await sha256Hex(`${env.IP_HASH_SALT ?? ''}${ip}`) : null,
    user_agent: (request.headers.get('user-agent') ?? '').slice(0, 500) || null,
  };

  const stored = await storeLead(env, record);
  const notified = await notify(env, record);
  // Either copy is enough to follow up, so only fail if both were lost.
  if (!stored && !notified) return respond.fail(500, 'Something went wrong on our end and your message wasn’t sent. Please try again or email us.', 'server');
  return respond.ok();
}

function validate(input, type) {
  const lead = {};
  for (const [key, field] of Object.entries(FIELDS)) {
    let value = text(input[key]);
    value = field.multiline ? value.replace(/\r\n?/g, '\n') : value.replace(/\s+/g, ' ');
    if (value.length > field.max) return { error: `${field.label} is too long (${field.max} characters max).` };
    lead[key] = value;
  }

  const missing = [];
  if (!lead.name) missing.push('your name');
  if (!lead.email) missing.push('your email');
  if (type === 'audit' && !lead.website) missing.push('your website');
  if (type === 'contact' && !lead.message) missing.push('a message');
  if (missing.length) return { error: `Please add ${joinList(missing)}.` };
  if (!EMAIL.test(lead.email)) return { error: 'That email address doesn’t look right.' };
  if (lead.website && !WEBSITE.test(lead.website)) return { error: 'That website address doesn’t look right.' };

  const service = text(input.service).toLowerCase();
  lead.service = SERVICES.includes(service) ? service : type === 'audit' ? 'websites' : 'other';
  return { lead };
}

async function readBody(request) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) throw httpError(413, 'That’s more than this form accepts. Please shorten your message.');
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => {
      throw httpError(400, 'We couldn’t read that submission.');
    });
    return Object.fromEntries([...form].filter(([, v]) => typeof v === 'string'));
  }
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) throw httpError(413, 'That’s more than this form accepts. Please shorten your message.');
  if (contentType.includes('application/json')) {
    let data;
    try {
      data = JSON.parse(body || '{}');
    } catch {
      throw httpError(400, 'We couldn’t read that submission.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw httpError(400, 'We couldn’t read that submission.');
    return data;
  }
  if (contentType.includes('application/x-www-form-urlencoded') || !contentType) return Object.fromEntries(new URLSearchParams(body));
  throw httpError(415, 'Send the form as form data or JSON.');
}

async function verifyTurnstile(token, secret, ip) {
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    const outcome = await res.json();
    if (outcome.success !== true) console.warn('Turnstile rejected a submission:', outcome['error-codes']);
    return outcome.success === true;
  } catch (err) {
    console.error('Turnstile verification failed:', err);
    return false;
  }
}

async function storeLead(env, record) {
  if (!env.DB) {
    console.error(`No DB binding; lead ${record.id} was not stored`);
    return false;
  }
  try {
    await env.DB.prepare(INSERT_LEAD)
      .bind(...COLUMNS.map((column) => record[column] || null))
      .run();
    return true;
  } catch (err) {
    console.error(`Could not store lead ${record.id}:`, err);
    return false;
  }
}

async function notify(env, record) {
  if (!env.NOTIFY) return false;
  if (!env.NOTIFY_TO || !env.NOTIFY_FROM) {
    console.warn('NOTIFY is bound but NOTIFY_TO or NOTIFY_FROM is empty; skipping the lead email');
    return false;
  }
  try {
    await env.NOTIFY.send({ to: env.NOTIFY_TO, from: env.NOTIFY_FROM, replyTo: record.email, subject: subjectFor(record), text: summaryFor(record) });
    return true;
  } catch (err) {
    console.error(`Lead email for ${record.id} failed:`, err);
    return false;
  }
}

function subjectFor(record) {
  const clip = (value) => String(value ?? '').replace(/\s+/g, ' ').slice(0, 100);
  return record.type === 'audit' ? `Free audit request: ${clip(record.website)}` : `New inquiry: ${record.service} from ${clip(record.name)}`;
}

function summaryFor(record) {
  const rows = [
    ['Name', record.name],
    ['Email', record.email],
    ['Website', record.website],
    ['Business type', record.business_type],
    ['Company', record.company],
    ['Service', record.type === 'contact' ? record.service : null],
    ['Budget', record.budget],
    ['Page', record.page],
    ['Campaign', [record.utm_source, record.utm_medium, record.utm_campaign].filter(Boolean).join(' / ')],
  ].filter(([, value]) => value);
  const intro = record.type === 'audit' ? 'Free website check-up request from the site. The review is due within one business day.' : 'New inquiry from the website contact form.';
  return [
    intro,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(record.message ? ['', 'Message:', record.message] : []),
    '',
    `Lead ${record.id} (inbound_leads), received ${record.created_at}. Reply to this email to answer them directly.`,
  ].join('\n');
}

function responder(request, wantsJson, type) {
  const base = new URL(request.url);
  return {
    ok: () => (wantsJson ? json({ ok: true }) : redirect(new URL('/thanks/', base))),
    fail(status, error, code) {
      if (wantsJson) return json({ ok: false, error }, status);
      const target = new URL(FORM_PAGES[type] ?? FORM_PAGES.contact, base);
      target.searchParams.set('error', code);
      target.hash = `${type}-error-${code}`;
      return redirect(target);
    },
  };
}

function isJsonRequest(request) {
  const accept = request.headers.get('accept') ?? '';
  const contentType = request.headers.get('content-type') ?? '';
  return accept.includes('application/json') || contentType.includes('application/json');
}

function refererUrl(request) {
  const referer = request.headers.get('referer');
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.host === new URL(request.url).host ? url : null;
  } catch {
    return null;
  }
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

const text = (value) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');

const joinList = (items) => (items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`);

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
  });
}

function redirect(location) {
  return new Response(null, { status: 303, headers: { location: String(location), 'cache-control': 'no-store' } });
}
