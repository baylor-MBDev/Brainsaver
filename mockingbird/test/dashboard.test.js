import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import baseConfig from '../mockingbird.config.js';
import { startDashboard } from '../engine/dashboard/server.js';
import { Store } from '../engine/lib/store.js';
import { parseCsv } from '../engine/lib/util.js';
import { renderEmail } from '../engine/outreach/context.js';
import { lintPitch } from '../engine/outreach/lint.js';
import { writePitch } from '../engine/outreach/writer.js';
import { tempDir } from './helpers.js';

// Not ready to send (no postal address, no sender last name) vs. ready.
const config = structuredClone(baseConfig);
config.business.postalAddress = '';
config.sender.lastName = '';
const ready = structuredClone(baseConfig);
ready.business.postalAddress = '1 Test St, Waco, TX 76701';
ready.sender.lastName = 'Tester';

function plumber() {
  return {
    id: 'bluebonnetplumbing.com',
    name: 'Bluebonnet Plumbing',
    domain: 'bluebonnetplumbing.com',
    website: 'https://bluebonnetplumbing.com',
    industry: 'plumbing',
    city: 'Waco',
    state: 'TX',
    rating: 4.6,
    reviewCount: 87,
    icp: 'local-services-websites',
    stage: 'pitched',
    channel: 'email',
    primaryService: 'websites',
    scores: { websites: 88, automation: 50, apps: 0 },
    contacts: [
      { id: 'p1', firstName: 'Dana', lastName: 'Hart', title: 'Owner', email: 'dana@bluebonnetplumbing.com', emailStatus: 'verified' },
      { id: 'p2', firstName: 'Luis', lastName: 'Ortega', title: 'Office Manager', email: 'office@bluebonnetplumbing.com', emailStatus: 'from_website' },
    ],
    primaryContactId: 'p1',
    audit: {
      reachable: true,
      https: false,
      signals: { viewport: false, tech: { builder: ['wix'], cms: [], framework: [] }, chat: [], booking: [], analytics: ['universal-analytics'], emails: ['office@bluebonnetplumbing.com'] },
    },
    findings: [
      { service: 'websites', id: 'not-mobile', weight: 24, kind: 'observed', title: 'Not mobile-friendly', point: 'the site isn’t set up for phones, so it shows up shrunken and hard to tap on mobile' },
      { service: 'websites', id: 'stale-copyright', weight: 10, kind: 'observed', title: 'Footer says © 2016', point: 'the footer still says © 2016' },
      { service: 'automation', id: 'industry-fit', weight: 22, kind: 'context', title: 'Lead-driven industry', point: 'new business arrives by phone' },
    ],
    demo: { url: 'https://demo.example/bluebonnet' },
    history: [],
  };
}

function dentist() {
  return {
    id: 'lakeviewdental.com',
    name: 'Lakeview Family Dental',
    domain: 'lakeviewdental.com',
    website: 'https://lakeviewdental.com',
    industry: 'dental',
    city: 'Austin',
    state: 'TX',
    icp: 'appointment-practices-automation',
    stage: 'pitched',
    channel: 'email',
    primaryService: 'automation',
    scores: { websites: 20, automation: 74, apps: 10 },
    contacts: [{ id: 'd1', firstName: 'Priya', lastName: 'Shah', title: 'Practice Manager', email: 'priya@lakeviewdental.com' }],
    primaryContactId: 'd1',
    findings: [{ service: 'automation', id: 'no-chat', weight: 16, kind: 'observed', title: 'No instant answers', point: 'there’s no chat on the site' }],
    history: [],
  };
}

async function seed(store) {
  const clean = plumber();
  clean.pitch = (await writePitch(clean, { config, claude: null })).pitch;
  await store.put(clean);

  const broken = dentist();
  broken.pitch = {
    service: 'automation',
    source: 'template',
    subject: 'after-hours calls at lakeview',
    altSubjects: [],
    emails: [
      { step: 1, delayDays: 0, body: 'Hi {{first_name}},\n\nI noticed there’s no chat on the site. Worth a 20-minute look?\n\nBaylor' },
      { step: 2, delayDays: 3, body: 'Hi Priya,\n\nFollowing up on my note below.\n\nBaylor' },
      { step: 3, delayDays: 7, body: 'Hi Priya,\n\nI’ll close the loop here.\n\nBaylor' },
    ],
  };
  broken.pitch.lint = lintPitch(broken.pitch, broken, config);
  await store.put(broken);

  await store.put({
    id: 'name-gone-fishing-bait-waco',
    name: 'Gone Fishing Bait',
    city: 'Waco',
    state: 'TX',
    stage: 'skipped',
    skipReason: 'best opportunity score 20 is under 45',
    primaryService: 'websites',
    scores: { websites: 20, automation: 0, apps: 0 },
    contacts: [],
    history: [],
  });
}

async function setup(t, { cfg = config } = {}) {
  const store = await Store.open(await tempDir('mb-dashboard-'));
  await seed(store);
  const server = await startDashboard({ store, config: cfg, port: 0 });
  t.after(() => server.close());
  return { store, server, call: (path, options) => request(server, path, options) };
}

// node:http rather than fetch, because fetch won't let a test forge the Host header.
function request(server, path, { method = 'GET', token = server.token, host, body, raw } = {}) {
  const { port } = new URL(server.url);
  const payload = raw ?? (body === undefined ? null : JSON.stringify(body));
  const headers = { host: host ?? `127.0.0.1:${port}` };
  if (token) headers['x-mb-token'] = token;
  if (payload !== null) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = Buffer.byteLength(payload);
  }
  return new Promise((resolve, reject) => {
    let answered = false;
    const req = http.request({ host: '127.0.0.1', port, path, method, headers, agent: false }, (res) => {
      answered = true;
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          // the HTML page
        }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    // The server may hang up mid-upload after refusing a body; the answer counts.
    req.on('error', (err) => {
      if (!answered) reject(err);
    });
    req.end(payload ?? undefined);
  });
}

const ids = async (call, path) => (await call(path)).json.leads.map((lead) => lead.id);

test('dashboard: binds to 127.0.0.1 on a real port and only answers to its own Host header', async (t) => {
  const { store, server, call } = await setup(t);
  const { hostname, port } = new URL(server.url);
  assert.equal(hostname, '127.0.0.1');
  assert.notEqual(port, '0');
  assert.equal((await call('/')).status, 200);
  assert.equal((await call('/', { host: `localhost:${port}` })).status, 200);
  // DNS rebinding: evil.example now resolves to 127.0.0.1, but the browser still sends its name.
  assert.equal((await call('/', { host: `evil.example:${port}` })).status, 403);
  assert.equal((await call('/api/summary', { host: `evil.example:${port}` })).status, 403);
  assert.equal((await call('/', { host: `127.0.0.1:${Number(port) + 1}` })).status, 403);
  await assert.rejects(startDashboard({ store, config, port: 0, host: '0.0.0.0' }), /only listens on this computer/);
});

test('dashboard: every API call needs the per-run token, and there are no CORS headers', async (t) => {
  const { store, server, call } = await setup(t);
  assert.equal((await call('/api/summary', { token: null })).status, 403);
  assert.equal((await call('/api/summary', { token: 'not-the-token' })).status, 403);
  const flipped = server.token.slice(0, -1) + (server.token.endsWith('0') ? '1' : '0');
  assert.equal((await call('/api/summary', { token: flipped })).status, 403);

  const refused = await call('/api/leads/bluebonnetplumbing.com/approve', { method: 'POST', token: null });
  assert.equal(refused.status, 403);
  assert.equal((await store.get('bluebonnetplumbing.com')).stage, 'pitched');

  const ok = await call('/api/summary');
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['access-control-allow-origin'], undefined);
  assert.equal(ok.headers['cache-control'], 'no-store');
});

test('dashboard: summary counts leads by stage and service and lists send blockers', async (t) => {
  const { call } = await setup(t);
  const { status, json } = await call('/api/summary');
  assert.equal(status, 200);
  assert.equal(json.total, 3);
  assert.equal(json.byStage.pitched, 2);
  assert.equal(json.byStage.skipped, 1);
  assert.equal(json.byStage.approved, 0);
  assert.deepEqual(json.byService, { websites: 2, automation: 1, apps: 0 });
  assert.equal(json.byStageService.pitched.automation, 1);
  assert.equal(json.business.name, config.business.name);
  assert.equal(json.services.automation, config.services.automation.label);
  assert.equal(json.qualifyAt, config.scoring.qualifyAt);
  assert.equal(json.wordLimits[1], config.outreach.maxWords);
  assert.ok(json.blockers.some((b) => /postalAddress/.test(b)), JSON.stringify(json.blockers));
});

test('dashboard: lead list filters by stage, service, and a search across name, domain, email, city', async (t) => {
  const { call } = await setup(t);
  const { json } = await call('/api/leads?stage=pitched');
  assert.deepEqual(json.leads.map((l) => l.id), ['bluebonnetplumbing.com', 'lakeviewdental.com'], 'best score first');
  const [plumberItem, dentistItem] = json.leads;
  assert.equal(plumberItem.topFinding, 'Not mobile-friendly');
  assert.deepEqual(plumberItem.contact, { id: 'p1', name: 'Dana Hart', title: 'Owner', email: 'dana@bluebonnetplumbing.com', emailStatus: 'verified' });
  assert.equal(plumberItem.lint.errors, 0);
  assert.ok(plumberItem.subject);
  assert.equal(plumberItem.demoUrl, 'https://demo.example/bluebonnet');
  assert.ok(dentistItem.lint.errors > 0);

  assert.deepEqual(await ids(call, '/api/leads?stage=skipped'), ['name-gone-fishing-bait-waco']);
  assert.deepEqual(await ids(call, '/api/leads?stage=pitched&service=automation'), ['lakeviewdental.com']);
  assert.deepEqual(await ids(call, '/api/leads?q=PRIYA%40'), ['lakeviewdental.com'], 'contact email, any case');
  assert.deepEqual(await ids(call, '/api/leads?q=austin'), ['lakeviewdental.com'], 'city');
  assert.deepEqual(await ids(call, '/api/leads?q=bluebonnetplumbing.com'), ['bluebonnetplumbing.com'], 'domain');
  assert.deepEqual(await ids(call, '/api/leads?stage=pitched&q=waco'), ['bluebonnetplumbing.com']);
  assert.deepEqual(await ids(call, '/api/leads?stage=skipped,pitched&q=waco'), ['bluebonnetplumbing.com', 'name-gone-fishing-bait-waco']);
  assert.deepEqual(await ids(call, '/api/leads?q=nothing-like-this'), []);
  assert.equal((await ids(call, '/api/leads')).length, 3);
});

test('dashboard: lead detail is the full record plus the exact emails that will be sent', async (t) => {
  const { call } = await setup(t);
  const { status, json } = await call('/api/leads/bluebonnetplumbing.com');
  assert.equal(status, 200);
  assert.equal(json.name, 'Bluebonnet Plumbing');
  assert.equal(json.contacts.length, 2);
  assert.equal(json.pitch.emails.length, 3);
  assert.equal(json.techLabels.wix, 'Wix');
  assert.equal(json.rendered.length, 3);

  const [first, second] = json.rendered;
  assert.equal(first.step, 1);
  assert.equal(first.text, renderEmail(json.pitch.emails[0].body, { config, demoUrl: json.demo.url }));
  assert.match(first.text, /^Hi Dana,/);
  assert.ok(first.text.includes(`\n--\n`), 'signature block');
  assert.ok(first.text.includes(config.business.name));
  assert.ok(first.text.endsWith(config.outreach.optOutLine), 'opt-out line closes every email');
  assert.ok(json.pitch.emails[1].body.includes('[DEMO_LINK]'));
  assert.ok(second.text.includes('https://demo.example/bluebonnet'), 'demo link filled in');
  assert.ok(!second.text.includes('[DEMO_LINK]'));

  assert.equal((await call('/api/leads/nobody.example')).status, 404);
  assert.equal((await call('/api/leads/%E0%A4%A')).status, 400);
});

test('dashboard: editing the pitch persists, re-lints, and rejects malformed input', async (t) => {
  const { store, call } = await setup(t);
  const id = 'bluebonnetplumbing.com';
  const before = await store.get(id);

  const res = await call(`/api/leads/${id}/pitch`, {
    method: 'PUT',
    body: { subject: '  bluebonnet on phones  ', altSubjects: ['idea for bluebonnet', ' '], emails: [{ step: 1, body: 'Hi {{first_name}},\r\n\r\nQuick look at your site on a phone?\r\n\r\nBaylor\r\n' }] },
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.pitch.subject, 'bluebonnet on phones');
  assert.ok(res.json.pitch.lint.some((i) => i.level === 'error' && /placeholder/i.test(i.message)), JSON.stringify(res.json.pitch.lint));
  assert.ok(res.json.listItem.lint.errors > 0);
  assert.match(res.json.rendered[0].text, /^Hi \{\{first_name\}\},\n\nQuick look/);

  const saved = await store.get(id);
  assert.equal(saved.pitch.subject, 'bluebonnet on phones');
  assert.deepEqual(saved.pitch.altSubjects, ['idea for bluebonnet']);
  assert.equal(saved.pitch.emails[0].body, 'Hi {{first_name}},\n\nQuick look at your site on a phone?\n\nBaylor');
  assert.equal(saved.pitch.emails[1].body, before.pitch.emails[1].body, 'untouched steps stay as they were');
  assert.equal(saved.pitch.edited, true);
  assert.ok(saved.pitch.lint.some((i) => i.level === 'error'));
  assert.equal(saved.history.at(-1).event, 'pitch:edited');

  const fixed = await call(`/api/leads/${id}/pitch`, { method: 'PUT', body: { emails: [{ step: 1, body: before.pitch.emails[0].body }] } });
  assert.ok(!fixed.json.pitch.lint.some((i) => i.level === 'error'));

  assert.equal((await call(`/api/leads/${id}/pitch`, { method: 'PUT', body: { emails: 'not a list' } })).status, 400);
  assert.equal((await call(`/api/leads/${id}/pitch`, { method: 'PUT', body: { subject: 42 } })).status, 400);
  assert.equal((await call(`/api/leads/${id}/pitch`, { method: 'PUT', raw: '{not json' })).status, 400);
  assert.equal((await call(`/api/leads/${id}/pitch`, { method: 'PUT', raw: '[1, 2]' })).status, 400);
  assert.equal((await call('/api/leads/nobody.example/pitch', { method: 'PUT', body: { subject: 'x' } })).status, 404);
  assert.equal((await call(`/api/leads/${id}/pitch`, { method: 'POST', body: {} })).status, 405);
});

test('dashboard: approve passes a clean pitch and returns 409 with the lint issues otherwise', async (t) => {
  const { store, call } = await setup(t);
  const ok = await call('/api/leads/bluebonnetplumbing.com/approve', { method: 'POST' });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.stage, 'approved');
  assert.ok(ok.json.pitch.approvedAt);
  assert.equal((await store.get('bluebonnetplumbing.com')).stage, 'approved');

  const blocked = await call('/api/leads/lakeviewdental.com/approve', { method: 'POST' });
  assert.equal(blocked.status, 409);
  assert.match(blocked.json.error, /lint/i);
  assert.ok(Array.isArray(blocked.json.details));
  assert.ok(blocked.json.details.some((i) => i.level === 'error' && i.step === 1 && /placeholder/i.test(i.message)));
  assert.equal((await store.get('lakeviewdental.com')).stage, 'pitched');
});

test('dashboard: stage changes keep the note, notes save, and the primary contact can change', async (t) => {
  const { store, call } = await setup(t);
  const skipped = await call('/api/leads/lakeviewdental.com/stage', { method: 'POST', body: { stage: 'skipped', note: 'chain location' } });
  assert.equal(skipped.status, 200);
  assert.equal(skipped.json.stage, 'skipped');
  assert.equal(skipped.json.skipReason, 'chain location');
  assert.deepEqual((await store.get('lakeviewdental.com')).history.at(-1), { at: skipped.json.history.at(-1).at, event: 'stage:skipped', detail: 'chain location' });
  assert.equal((await call('/api/leads/lakeviewdental.com/stage', { method: 'POST', body: { stage: 'bogus' } })).status, 400);
  assert.equal((await call('/api/leads/lakeviewdental.com/stage', { method: 'POST', body: {} })).status, 400);

  const notes = await call('/api/leads/bluebonnetplumbing.com/notes', { method: 'PUT', body: { notes: 'Owner prefers email.' } });
  assert.equal(notes.status, 200);
  assert.equal((await store.get('bluebonnetplumbing.com')).notes, 'Owner prefers email.');

  const contact = await call('/api/leads/bluebonnetplumbing.com/contact', { method: 'POST', body: { contactId: 'p2' } });
  assert.equal(contact.status, 200);
  assert.equal(contact.json.primaryContactId, 'p2');
  assert.equal(contact.json.listItem.contact.email, 'office@bluebonnetplumbing.com');
  assert.equal((await call('/api/leads/bluebonnetplumbing.com/contact', { method: 'POST', body: { contactId: 'nobody' } })).status, 404);
});

test('dashboard: suppress puts the value on the do-not-contact list and pulls matching leads', async (t) => {
  const { store, call } = await setup(t);
  const res = await call('/api/suppress', { method: 'POST', body: { value: 'lakeviewdental.com', reason: 'asked not to be contacted' } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.affected, ['lakeviewdental.com']);
  assert.equal((await call('/api/leads/lakeviewdental.com')).json.stage, 'suppressed');
  assert.equal((await store.suppression()).domains['lakeviewdental.com'].reason, 'asked not to be contacted');
  assert.deepEqual(await ids(call, '/api/leads?stage=suppressed'), ['lakeviewdental.com']);

  const byEmail = await call('/api/suppress', { method: 'POST', body: { value: 'Dana@BluebonnetPlumbing.com' } });
  assert.deepEqual(byEmail.json.affected, ['bluebonnetplumbing.com']);
  assert.equal((await store.suppression()).emails['dana@bluebonnetplumbing.com'].reason, 'manual');
  assert.equal((await call('/api/suppress', { method: 'POST', body: { value: 'not a domain' } })).status, 400);
  assert.equal((await call('/api/suppress', { method: 'POST', body: {} })).status, 400);
});

test('dashboard: export is refused with the blockers until the config can legally send', async (t) => {
  const { store, call } = await setup(t);
  await call('/api/leads/bluebonnetplumbing.com/approve', { method: 'POST' });
  const res = await call('/api/export', { method: 'POST', body: { format: 'instantly', markQueued: true } });
  assert.equal(res.status, 412);
  assert.ok(res.json.details.some((b) => /postalAddress/.test(b)));
  assert.equal((await store.get('bluebonnetplumbing.com')).stage, 'approved', 'nothing queued');
});

test('dashboard: export returns the CSV, lists what was left out, and marks leads queued', async (t) => {
  const { store, call } = await setup(t, { cfg: ready });
  assert.equal((await call('/api/leads/bluebonnetplumbing.com/approve', { method: 'POST' })).status, 200);
  const noEmail = dentist();
  Object.assign(noEmail, { id: 'harborvet.example', name: 'Harbor Vet', domain: 'harborvet.example', stage: 'approved', contacts: [], primaryContactId: null });
  noEmail.pitch = (await writePitch(noEmail, { config: ready, claude: null })).pitch;
  await store.put(noEmail);

  const preview = await call('/api/export', { method: 'POST', body: { format: 'instantly', markQueued: false } });
  assert.equal(preview.status, 200);
  assert.deepEqual(preview.json.exported, ['bluebonnetplumbing.com']);
  assert.equal((await store.get('bluebonnetplumbing.com')).stage, 'approved', 'markQueued: false leaves it approved');

  const res = await call('/api/export', { method: 'POST', body: { format: 'instantly', html: false, markQueued: true } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.exported, ['bluebonnetplumbing.com']);
  assert.deepEqual(res.json.blocked, [{ id: 'harborvet.example', name: 'Harbor Vet', reason: 'no email address' }]);
  const [row] = parseCsv(res.json.csv);
  assert.equal(row.email, 'dana@bluebonnetplumbing.com');
  assert.match(row.email_1, /^Hi Dana,/);
  assert.match(row.email_1, /1 Test St, Waco, TX 76701/);
  assert.equal((await store.get('bluebonnetplumbing.com')).stage, 'queued');
  assert.equal((await call('/api/summary')).json.byStage.queued, 1);

  const again = await call('/api/export', { method: 'POST', body: { format: 'instantly' } });
  assert.deepEqual([again.json.csv, again.json.exported], ['', []]);
  assert.equal((await call('/api/export', { method: 'POST', body: { format: 'mailchimp' } })).status, 400);
});

test('dashboard: serves the page with the token injected and nothing loaded from elsewhere', async (t) => {
  const { server, call } = await setup(t);
  const res = await call('/', { token: null });
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^text\/html/);
  assert.ok(res.text.includes(`<meta name="mb-token" content="${server.token}">`));
  assert.doesNotMatch(res.text, /__MB_(?:TOKEN|NONCE)__/);
  assert.doesNotMatch(res.text, /<script\b[^>]*\bsrc\s*=/i, 'no external scripts');
  assert.doesNotMatch(res.text, /<link\b[^>]*\brel\s*=\s*["']?stylesheet/i, 'no external stylesheets');
  assert.doesNotMatch(res.text, /@import|url\(\s*["']?(?:https?:)?\/\//i, 'no CSS imports');

  const csp = res.headers['content-security-policy'];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  const nonce = csp.match(/script-src 'nonce-([^']+)'/)[1];
  assert.ok(res.text.includes(`<script nonce="${nonce}">`));
  assert.equal(res.headers['x-frame-options'], 'DENY');

  assert.equal((await call('/elsewhere')).status, 404);
  assert.equal((await call('/api/elsewhere')).status, 404);
  assert.equal((await call('/', { method: 'POST' })).status, 405);
});

test('dashboard: request bodies over 1 MB are refused', async (t) => {
  const { call } = await setup(t);
  const res = await call('/api/leads/bluebonnetplumbing.com/notes', { method: 'PUT', body: { notes: 'x'.repeat(1_100_000) } });
  assert.equal(res.status, 413);
});
