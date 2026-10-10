import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import config from '../mockingbird.config.js';
import { audit, enrich, importCsv, pitch, source } from '../engine/commands/pipeline.js';
import { sync } from '../engine/commands/send.js';
import { approve, exportLeads, suppress, updatePitch } from '../engine/lib/actions.js';
import { createApollo, organizationToCompany, pickBestPerson, personToContact } from '../engine/sources/apollo.js';
import { placeToCompany, placesQueries } from '../engine/sources/places.js';
import { companiesFromCsv } from '../engine/sources/csv.js';
import { Store } from '../engine/lib/store.js';
import { parseCsv } from '../engine/lib/util.js';
import { fakeFetch, fixture, tempDir } from './helpers.js';

const ready = structuredClone({
  ...config,
  business: { ...config.business, postalAddress: '1 Test St, Waco, TX 76701' },
  sender: { ...config.sender, lastName: 'Tester' },
  audit: { ...config.audit, pagespeed: false },
});

const PLACES = {
  places: [
    {
      id: 'ChIJbluebonnet',
      displayName: { text: 'Bluebonnet Plumbing' },
      formattedAddress: '1200 Austin Ave, Waco, TX 76701, USA',
      addressComponents: [
        { longText: 'Waco', shortText: 'Waco', types: ['locality'] },
        { longText: 'Texas', shortText: 'TX', types: ['administrative_area_level_1'] },
        { longText: 'United States', shortText: 'US', types: ['country'] },
      ],
      websiteUri: 'http://bluebonnetplumbing.com/',
      nationalPhoneNumber: '(254) 555-0142',
      rating: 4.8,
      userRatingCount: 137,
      businessStatus: 'OPERATIONAL',
      primaryType: 'plumber',
      primaryTypeDisplayName: { text: 'Plumber' },
    },
    {
      id: 'ChIJjoes',
      displayName: { text: "Joe's Drain Service" },
      websiteUri: 'https://www.facebook.com/joesdrains',
      nationalPhoneNumber: '(254) 555-0199',
      rating: 4.6,
      userRatingCount: 58,
      businessStatus: 'OPERATIONAL',
      primaryTypeDisplayName: { text: 'Plumber' },
    },
    { id: 'ChIJclosed', displayName: { text: 'Closed Co' }, businessStatus: 'CLOSED_PERMANENTLY' },
    { id: 'ChIJchain', displayName: { text: 'BigChain Waco' }, websiteUri: 'https://bigchain.com/locations/waco/', businessStatus: 'OPERATIONAL' },
  ],
};

function withFetch(routes, fn) {
  const original = globalThis.fetch;
  const fake = fakeFetch(routes);
  globalThis.fetch = fake;
  return Promise.resolve(fn(fake)).finally(() => {
    globalThis.fetch = original;
  });
}

function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k];
  return Promise.resolve(fn()).finally(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

test('places → audit → enrich → pitch → approve → export → sync', async () => {
  const store = await Store.open(await tempDir());
  const ctx = { config: ready, store };
  const routes = {
    'https://www.google.com/generate_204': { status: 200, body: '' },
    'https://places.googleapis.com/v1/places:searchText': { body: PLACES },
    'https://bluebonnetplumbing.com/': { error: 'ERR_TLS_CERT_ALTNAME_INVALID' },
    'http://bluebonnetplumbing.com/': { body: fixture('old-plumber.html') },
    'http://bluebonnetplumbing.com/contact.html': { body: fixture('old-plumber-contact.html') },
  };

  await withEnv({ GOOGLE_PLACES_API_KEY: 'test-key', APOLLO_API_KEY: undefined, ANTHROPIC_API_KEY: undefined, ANTHROPIC_AUTH_TOKEN: undefined }, () =>
    withFetch(routes, async (fake) => {
      await source(ctx, { positionals: ['places'], values: { icp: 'local-services-websites', query: 'plumbers in Waco, TX', limit: '10' } });
      const searchCall = fake.calls.find((call) => call.url.includes('places:searchText'));
      assert.equal(searchCall.init.headers['X-Goog-Api-Key'], 'test-key');
      assert.match(searchCall.init.headers['X-Goog-FieldMask'], /places\.websiteUri/);
      assert.equal(searchCall.body.textQuery, 'plumbers in Waco, TX');

      let all = await store.list();
      assert.equal(all.length, 3, 'closed business is dropped');
      assert.ok(all.every((co) => co.stage === 'sourced'));

      await audit(ctx, { positionals: [], values: {} });
      await enrich(ctx, { positionals: [], values: {} });
      await pitch(ctx, { positionals: [], values: {} });
    }),
  );

  const plumber = await store.get('bluebonnetplumbing.com');
  assert.equal(plumber.stage, 'pitched');
  assert.equal(plumber.primaryService, 'websites');
  assert.equal(plumber.channel, 'email');
  assert.equal(plumber.contacts[0].email, 'office@bluebonnetplumbing.com');
  assert.equal(plumber.pitch.source, 'template');
  assert.ok(plumber.history.some((h) => h.event === 'stage:qualified'));

  const joes = await store.get('place-ChIJjoes');
  assert.equal(joes.audit.noWebsite, true);
  assert.equal(joes.stage, 'enriched');
  assert.equal(joes.channel, 'phone');

  const chain = await store.get('bigchain.com');
  assert.equal(chain.stage, 'skipped');
  assert.match(chain.skipReason, /chain/);

  // Review: edit, approve, export.
  await updatePitch(store, plumber.id, { subject: 'bluebonnet on phones' }, { config: ready });
  await approve(store, plumber.id, { config: ready });
  const { csv, exported, blocked } = await exportLeads(store, ready, { format: 'instantly' });
  assert.deepEqual(exported, ['bluebonnetplumbing.com']);
  assert.deepEqual(blocked, []);
  const [row] = parseCsv(csv);
  assert.equal(row.subject, 'bluebonnet on phones');
  assert.equal((await store.get(plumber.id)).stage, 'queued');

  const calls = await exportLeads(store, ready, { format: 'calls' });
  assert.deepEqual(calls.exported, ['place-ChIJjoes']);

  // Outcomes come back from the sending tool.
  const dir = await tempDir();
  const file = path.join(dir, 'campaign.csv');
  await writeFile(file, 'Email,Lead Status,Interest Status\noffice@bluebonnetplumbing.com,Completed,Meeting Booked\nstranger@elsewhere.com,Unsubscribed,\n');
  const tally = await sync(ctx, { positionals: [file], values: {} });
  assert.equal(tally.advanced, 1);
  assert.equal(tally.suppressed, 1);
  assert.equal((await store.get(plumber.id)).stage, 'meeting');
  assert.ok((await store.suppression()).emails['stranger@elsewhere.com']);
});

test('audit refuses to run offline instead of flagging every site as down', async () => {
  const store = await Store.open(await tempDir());
  await store.upsertFromSource({ name: 'Fine Co', domain: 'fine.com', website: 'https://fine.com', source: 'csv' });
  await withFetch({}, () => assert.rejects(audit({ config: ready, store }, { positionals: [], values: {} }), /Can't reach the internet/));
  assert.equal((await store.get('fine.com')).stage, 'sourced');
});

test('export refuses to run until the postal address and sender name are set', async () => {
  const store = await Store.open(await tempDir());
  await assert.rejects(exportLeads(store, config, { format: 'instantly' }), (err) => err.status === 412 && /postalAddress/.test(err.message));
});

test('suppressing a domain pulls every lead at that company', async () => {
  const store = await Store.open(await tempDir());
  await store.upsertFromSource({ name: 'Acme', domain: 'acme.com', website: 'https://acme.com', source: 'csv', contacts: [{ id: 'a', email: 'pat@acme.com' }] });
  const affected = await suppress(store, 'https://www.acme.com/', 'asked to stop');
  assert.deepEqual(affected, ['acme.com']);
  assert.equal((await store.get('acme.com')).stage, 'suppressed');
});

test('CSV import understands Apollo exports and Google Maps scrapes', async () => {
  const apolloCsv = 'First Name,Last Name,Title,Company,Email,Website,Industry,# Employees,City,State\nDana,Hart,Owner,Bluebonnet Plumbing,dana@bluebonnetplumbing.com,www.bluebonnetplumbing.com,construction,8,Waco,Texas\nSam,Lee,Office Manager,Bluebonnet Plumbing,sam@bluebonnetplumbing.com,bluebonnetplumbing.com,construction,8,Waco,Texas\n';
  const a = companiesFromCsv(apolloCsv, { service: 'websites' });
  assert.equal(a.companies.length, 1, 'two people at one company merge');
  assert.equal(a.companies[0].id, 'bluebonnetplumbing.com');
  assert.equal(a.companies[0].contacts.length, 2);
  assert.equal(a.companies[0].contacts[0].title, 'Owner');
  assert.equal(a.companies[0].employees, 8);

  const mapsCsv = 'title,website,phone,categoryName,totalScore,reviewsCount,city\n"Joe\'s Drains","https://facebook.com/joesdrains",(254) 555-0199,Plumber,4.6,58,Waco\n';
  const m = companiesFromCsv(mapsCsv, {});
  assert.equal(m.companies[0].name, "Joe's Drains");
  assert.equal(m.companies[0].website, null);
  assert.equal(m.companies[0].socialUrl, 'https://facebook.com/joesdrains');
  assert.equal(m.companies[0].reviewCount, 58);

  const store = await Store.open(await tempDir());
  const dir = await tempDir();
  await writeFile(path.join(dir, 'leads.csv'), apolloCsv);
  const result = await importCsv({ config, store }, { positionals: [path.join(dir, 'leads.csv')], values: { service: 'websites' } });
  assert.equal(result.created, 1);
});

test('Apollo: company search, free people search, batched reveals', async () => {
  const fake = fakeFetch({
    'https://api.apollo.io/api/v1/mixed_companies/search': {
      body: { organizations: [{ id: 'org1', name: 'Bluebonnet Plumbing', website_url: 'http://www.bluebonnetplumbing.com', primary_domain: 'bluebonnetplumbing.com', primary_phone: { number: '+1 254-555-0142' }, estimated_num_employees: 8, industry: 'construction', city: 'Waco', state: 'Texas' }], pagination: { total_entries: 1 } },
    },
    'https://api.apollo.io/api/v1/mixed_people/api_search': {
      body: { people: [
        { id: 'p-mgr', first_name: 'Sam', last_name_obfuscated: 'L***e', title: 'Office Manager', has_email: true },
        { id: 'p-owner', first_name: 'Dana', last_name_obfuscated: 'H***t', title: 'Owner', has_email: true },
      ] },
    },
    're:people/bulk_match': { body: { matches: [{ id: 'p-owner', first_name: 'Dana', last_name: 'Hart', email: 'dana@bluebonnetplumbing.com', email_status: 'verified', title: 'Owner' }] } },
  });
  const apollo = createApollo({ apiKey: 'k', fetch: fake });
  const orgs = await apollo.searchOrganizations({ q_organization_keyword_tags: ['plumbing'] }, { perPage: 25 });
  const company = organizationToCompany(orgs[0], { icp: { id: 'local-services-websites', service: 'websites' } });
  assert.equal(company.id, 'bluebonnetplumbing.com');
  assert.equal(company.employees, 8);
  const orgCall = fake.calls[0];
  assert.equal(orgCall.init.headers['x-api-key'], 'k');
  assert.deepEqual(orgCall.body, { q_organization_keyword_tags: ['plumbing'], page: 1, per_page: 25 });

  const people = await apollo.findPeople([company], { person_titles: ['owner', 'office manager'] });
  const peopleCall = fake.calls.find((call) => call.url.endsWith('/mixed_people/api_search'));
  assert.deepEqual(peopleCall.body.organization_ids, ['org1']);
  const best = pickBestPerson(people.get(company.id), ['owner', 'president', 'office manager']);
  assert.equal(best.firstName, 'Dana');

  const revealed = await apollo.revealEmails(Array.from({ length: 12 }, (_, i) => (i === 0 ? 'p-owner' : `p${i}`)));
  assert.equal(fake.calls.filter((call) => call.url.includes('bulk_match')).length, 2, '12 ids → 2 calls of ≤10');
  assert.equal(revealed.get('p-owner').email, 'dana@bluebonnetplumbing.com');
  assert.match(fake.calls.find((call) => call.url.includes('bulk_match')).url, /reveal_personal_emails=false/);
  assert.equal(personToContact({ id: 'x', email: 'email_not_unlocked@domain.com' }).email, null);
});

test('Places helpers: query expansion and chain detection', () => {
  const icp = { id: 'x', places: { queries: ['plumbers in {city}', 'hvac in {city}'], cities: ['Waco, TX', 'Austin, TX'] } };
  assert.deepEqual(placesQueries(icp), ['plumbers in Waco, TX', 'hvac in Waco, TX', 'plumbers in Austin, TX', 'hvac in Austin, TX']);
  assert.deepEqual(placesQueries(icp, { city: 'Dallas, TX' }), ['plumbers in Dallas, TX', 'hvac in Dallas, TX']);
  const chain = placeToCompany({ id: 'c', displayName: { text: 'Chain' }, websiteUri: 'https://chain.com/locations/waco' });
  assert.equal(chain.chainLocation, true);
});
