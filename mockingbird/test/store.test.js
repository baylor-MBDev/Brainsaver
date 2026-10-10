import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Store, companyId, mergeContacts, primaryContact, setStage } from '../engine/lib/store.js';
import { main } from '../engine/cli.js';
import { tempDir } from './helpers.js';

test('company ids: domain first, then place id, then name', () => {
  assert.equal(companyId({ domain: 'https://www.Acme.com/about' }), 'acme.com');
  assert.equal(companyId({ placeId: 'ChIJ-abc_123' }), 'place-ChIJ-abc_123');
  assert.equal(companyId({ name: "Joe's BBQ", city: 'Waco' }), 'name-joe-s-bbq-waco');
  assert.throws(() => companyId({}), /needs a domain/);
});

test('upsert from a second source fills gaps without touching progress', async () => {
  const store = await Store.open(await tempDir());
  const first = await store.upsertFromSource({ name: 'Acme', domain: 'acme.com', source: 'places', phone: '(254) 555-0100', contacts: [] });
  assert.equal(first.created, true);
  await store.update('acme.com', (co) => setStage(co, 'pitched'));

  const second = await store.upsertFromSource({
    name: 'Acme Plumbing LLC',
    domain: 'acme.com',
    source: 'apollo',
    employees: 12,
    contacts: [{ id: 'apollo-1', apolloId: '1', firstName: 'Dana', title: 'Owner' }],
  });
  assert.equal(second.created, false);
  const co = await store.get('acme.com');
  assert.equal(co.stage, 'pitched', 'stage kept');
  assert.equal(co.name, 'Acme', 'existing values win');
  assert.equal(co.employees, 12, 'gaps filled');
  assert.equal(co.contacts.length, 1);
  assert.ok(co.history.some((h) => h.event === 'stage:pitched'));
});

test('contacts merge by Apollo id or email; primary contact falls back sensibly', () => {
  const merged = mergeContacts(
    [{ id: 'a', apolloId: '1', firstName: 'Dana', email: null }],
    [{ id: 'a2', apolloId: '1', email: 'dana@acme.com', title: 'Owner' }, { id: 'b', email: 'SAM@acme.com' }],
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].email, 'dana@acme.com');
  assert.equal(merged[0].firstName, 'Dana');
  assert.equal(primaryContact({ contacts: merged }).email, 'dana@acme.com');
  assert.equal(primaryContact({ contacts: merged, primaryContactId: 'b' }).email, 'SAM@acme.com');
  assert.equal(primaryContact({ contacts: [] }), null);
});

test('list filters and survives a corrupt file; writes are atomic', async () => {
  const dir = await tempDir();
  const store = await Store.open(dir);
  await store.upsertFromSource({ name: 'A', domain: 'a.com', source: 'csv', contacts: [] });
  await store.upsertFromSource({ name: 'B', domain: 'b.com', source: 'csv', contacts: [] });
  await store.update('b.com', (co) => setStage(co, 'qualified'));
  await writeFile(path.join(dir, 'companies', 'broken.json'), '{ not json');
  assert.deepEqual((await store.list({ stage: 'qualified' })).map((co) => co.id), ['b.com']);
  assert.equal((await store.list()).length, 2);
  const leftovers = (await readdir(path.join(dir, 'companies'))).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(leftovers, []);
  assert.throws(() => setStage({}, 'nonsense'), /Unknown stage/);
});

test('suppression covers emails, domains, and email domains', async () => {
  const store = await Store.open(await tempDir());
  await store.suppress('Pat@Acme.com', 'unsubscribed');
  await store.suppress('https://www.blocked.io/x', 'asked');
  const list = await store.suppression();
  assert.match(store.isSuppressed({ contacts: [{ email: 'pat@acme.com' }] }, list), /pat@acme\.com/);
  assert.match(store.isSuppressed({ domain: 'blocked.io' }, list), /blocked\.io/);
  assert.match(store.isSuppressed({ contacts: [{ email: 'anyone@blocked.io' }] }, list), /blocked\.io/);
  assert.equal(store.isSuppressed({ domain: 'fine.com', contacts: [{ email: 'x@fine.com' }] }, list), null);
  await assert.rejects(store.suppress('not an email or domain'), /not an email address or a domain/);
});

test('CLI: unknown commands and bad flags fail cleanly', async () => {
  const lines = [];
  const original = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = (...args) => lines.push(args.join(' '));
  const exitCode = process.exitCode;
  try {
    await main(['definitely-not-a-command']);
    assert.equal(process.exitCode, 1);
    process.exitCode = undefined;
    await main(['list', '--no-such-flag']);
    assert.equal(process.exitCode, 1);
    process.exitCode = undefined;
    await main(['--help']);
    assert.equal(process.exitCode, undefined);
  } finally {
    Object.assign(console, original);
    process.exitCode = exitCode;
  }
  const output = lines.join('\n');
  assert.match(output, /Unknown command "definitely-not-a-command"/);
  assert.match(output, /Unknown option '--no-such-flag'/);
  assert.match(output, /Find and qualify leads/);
});

test('marking a lead "approved" still has to pass lint', async () => {
  const { mark } = await import('../engine/lib/actions.js');
  const config = (await import('../mockingbird.config.js')).default;
  const store = await Store.open(await tempDir());
  await store.upsertFromSource({ name: 'Acme', domain: 'acme.com', source: 'csv', contacts: [] });
  await store.update('acme.com', (co) => {
    co.pitch = { subject: 'hi', emails: [{ step: 1, body: 'Hi {{first_name}},\n\nBaylor' }], lint: [] };
    return setStage(co, 'pitched');
  });
  await assert.rejects(mark(store, 'acme.com', 'approved', undefined, { config }), (err) => err.status === 409 && err.details.some((i) => /placeholder/.test(i.message)));
  await assert.rejects(mark(store, 'acme.com', 'approved'), /approve\(\)/);
  assert.equal((await store.get('acme.com')).stage, 'pitched');
});
