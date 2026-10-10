import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import config from '../mockingbird.config.js';
import { inbound } from '../engine/commands/inbound.js';
import { auditReport } from '../engine/audit/report.js';
import { auditSite } from '../engine/audit/index.js';
import { scoreLead } from '../engine/audit/score.js';
import { parseJsonc } from '../engine/lib/cloudflare.js';
import { Store } from '../engine/lib/store.js';
import { fakeFetch, fixture, tempDir } from './helpers.js';

const NOW = new Date('2026-10-10T12:00:00Z');

test('audit report reads like advice, not a lab printout', async () => {
  const fetch = fakeFetch({
    'https://bluebonnetplumbing.com/': { error: 'ERR_TLS_CERT_ALTNAME_INVALID' },
    'http://bluebonnetplumbing.com/': { body: fixture('old-plumber.html') },
    'http://bluebonnetplumbing.com/contact.html': { body: fixture('old-plumber-contact.html') },
  });
  const company = { id: 'bluebonnetplumbing.com', name: 'Bluebonnet Plumbing', domain: 'bluebonnetplumbing.com', website: 'bluebonnetplumbing.com', industry: 'plumbing' };
  company.audit = await auditSite(company, { fetch });
  Object.assign(company, scoreLead(company, company.audit, { now: NOW }));
  const md = auditReport(company, { config, date: '2026-10-10' });
  assert.match(md, /^# Website check-up: Bluebonnet Plumbing\n/);
  assert.match(md, /- ✗ Secure connection \(HTTPS\)/);
  assert.match(md, /- ✗ Built for phones/);
  assert.match(md, /## Mobile experience/);
  assert.match(md, /What to do: Rebuild the layout to be mobile-first/);
  assert.match(md, /## Where we would start\n\n1\. /);
  assert.ok(!/undefined|null/.test(md));
});

test('jsonc parsing keeps URLs inside strings', () => {
  const parsed = parseJsonc('{\n  // comment\n  "url": "https://x.dev/a//b", /* block */\n  "list": [1, 2,],\n}');
  assert.deepEqual(parsed, { url: 'https://x.dev/a//b', list: [1, 2] });
});

test('mb inbound imports website inquiries from D1 and writes audit reports', async () => {
  const dir = await tempDir();
  const store = await Store.open(dir);
  const saved = { ...process.env };
  Object.assign(process.env, { CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'acct', CLOUDFLARE_D1_DATABASE_ID: 'db1', MB_DATA_DIR: dir });
  const d1 = [];
  const original = globalThis.fetch;
  globalThis.fetch = fakeFetch({
    'https://www.google.com/generate_204': { status: 200, body: '' },
    'https://api.cloudflare.com/client/v4/accounts/acct/d1/database/db1/query': (url, init) => {
      const { sql, params } = JSON.parse(init.body);
      d1.push({ sql, params, auth: init.headers.authorization });
      const results = sql.startsWith('SELECT')
        ? [
            { id: 'r1', created_at: '2026-10-10T10:00:00Z', type: 'audit', name: 'Dana Hart', email: 'Dana@BluebonnetPlumbing.com', website: 'bluebonnetplumbing.com', service: 'websites', status: 'new' },
            { id: 'r2', created_at: '2026-10-10T11:00:00Z', type: 'contact', name: 'Sam Lee', email: 'sam@startup.io', company: 'Startup Inc', service: 'apps', message: 'We need an MVP app.', status: 'new' },
          ]
        : [];
      return { body: { success: true, errors: [], result: [{ results, success: true }] } };
    },
    'https://bluebonnetplumbing.com/': { error: 'ERR_TLS_CERT_ALTNAME_INVALID' },
    'http://bluebonnetplumbing.com/': { body: fixture('old-plumber.html') },
    'http://bluebonnetplumbing.com/contact.html': { body: fixture('old-plumber-contact.html') },
  });
  try {
    await inbound({ config: { ...config, audit: { ...config.audit, pagespeed: false } }, store }, { positionals: [], values: {} });
  } finally {
    globalThis.fetch = original;
    process.env = saved;
  }
  assert.equal(d1[0].auth, 'Bearer t');
  assert.match(d1[0].sql, /status = 'new'/);
  assert.deepEqual(d1.filter((q) => q.sql.startsWith('UPDATE')).map((q) => q.params[0]), ['r1', 'r2']);

  const plumber = await store.get('bluebonnetplumbing.com');
  assert.equal(plumber.stage, 'replied');
  assert.equal(plumber.inbound.type, 'audit');
  assert.equal(plumber.contacts[0].email, 'dana@bluebonnetplumbing.com');
  assert.equal(plumber.primaryService, 'websites');
  const startup = await store.get('name-startup-inc');
  assert.equal(startup.inbound.message, 'We need an MVP app.');
  const reports = (await import('node:fs')).readdirSync(`${dir}/reports`);
  assert.equal(reports.length, 1, 'only the audit request gets a report');
  assert.match(await readFile(`${dir}/reports/${reports[0]}`, 'utf8'), /Website check-up: Bluebonnet Plumbing/);
});

test('build brief carries facts, fixes, and the quality bar into Claude Code', async () => {
  const { buildBrief } = await import('../engine/commands/brief.js');
  const md = buildBrief(
    {
      id: 'bluebonnetplumbing.com',
      name: 'Bluebonnet Plumbing',
      domain: 'bluebonnetplumbing.com',
      website: 'https://bluebonnetplumbing.com',
      industry: 'plumbing',
      city: 'Waco',
      state: 'TX',
      phone: '(254) 555-0142',
      primaryService: 'websites',
      brand: { colors: ['#1d4f91'], services: ['Drain Cleaning'] },
      contacts: [{ id: 'p', firstName: 'Dana', email: 'dana@bluebonnetplumbing.com' }],
      primaryContactId: 'p',
      findings: [{ service: 'websites', weight: 24, kind: 'observed', title: 'Not mobile-friendly', point: 'the site isn’t set up for phones' }],
    },
    config,
  );
  assert.match(md, /^# Build brief: Bluebonnet Plumbing/);
  assert.match(md, /- \*\*Not mobile-friendly\*\*: the site isn’t set up for phones/);
  assert.match(md, /PageSpeed \(mobile\) 90\+/);
  assert.match(md, /Colors seen on their site: #1d4f91/);
  assert.ok(!/undefined|null|false/.test(md));
});
