import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import config from '../mockingbird.config.js';
import { buildDemo, writeDemoRootFiles } from '../engine/demo/build.js';
import { themeFrom } from '../engine/demo/template.js';
import { checkPost, planTopics, toMarkdownFile, writePost, loadTopics } from '../engine/seo/blog.js';
import { pushToInstantly, pushToSmartlead } from '../engine/outreach/senders.js';
import { writePitch } from '../engine/outreach/writer.js';
import { createClaude } from '../engine/lib/claude.js';
import { fakeFetch, tempDir } from './helpers.js';

const cfg = structuredClone({ ...config, business: { ...config.business, postalAddress: '1 Test St, Waco, TX 76701' }, sender: { ...config.sender, lastName: 'Tester' } });

function fakeClaude(respond) {
  const calls = [];
  const client = {
    beta: {
      messages: {
        stream(params) {
          calls.push(params);
          return { finalMessage: async () => ({ stop_reason: 'end_turn', model: params.model, usage: {}, parsed_output: respond(params) }) };
        },
      },
    },
  };
  return { claude: createClaude({ client, model: 'claude-opus-5-5' }), calls };
}

test('demo page: noindex, honest banner, escaped data, readable theme', async () => {
  const dir = await tempDir();
  await writeDemoRootFiles(dir);
  assert.match(await readFile(path.join(dir, 'robots.txt'), 'utf8'), /Disallow: \//);
  assert.match(await readFile(path.join(dir, '_headers'), 'utf8'), /X-Robots-Tag: noindex/);

  const company = {
    id: 'evil.com',
    name: 'Evil <script>alert(1)</script> Co',
    industry: 'plumbing',
    city: 'Waco',
    phone: '(254) 555-0142',
    rating: 4.7,
    reviewCount: 90,
    brand: { colors: ['#ffe066'], services: ['Drain Cleaning', 'Water Heaters'] },
  };
  const result = await buildDemo(company, { config: { ...cfg, site: { ...cfg.site, demoBaseUrl: 'https://demo.example.com/' } }, claude: null, outDir: dir });
  assert.match(result.slug, /^evil-script-alert-1-script-co-[0-9a-f]{4}$/);
  assert.equal(result.url, `https://demo.example.com/${result.slug}/`);
  const html = await readFile(result.file, 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /not the official/);
  assert.ok(!html.includes('<script>alert(1)</script>'), 'business name is escaped');
  assert.match(html, /href="tel:2545550142"/);

  // A pale brand yellow gets darkened until white text on it is readable.
  const theme = themeFrom(['#ffe066']);
  assert.notEqual(theme.primary, '#ffe066');

  // Rebuilding keeps the same URL.
  const again = await buildDemo({ ...company, demo: { slug: result.slug } }, { config: cfg, claude: null, outDir: dir });
  assert.equal(again.slug, result.slug);
});

test('demo copy from Claude is constrained to facts on the page', async () => {
  const dir = await tempDir();
  const { claude, calls } = fakeClaude(() => ({
    headline: 'Plumbing repairs in Waco',
    subheadline: 'Family owned since 1987.',
    primary_cta: 'Get a quote',
    services: [{ name: 'Drain Cleaning', description: 'Clogs cleared.' }],
    highlights: [{ title: 'Family owned', text: 'Since 1987.' }, { title: 'Licensed', text: 'Licensed and insured.' }, { title: 'Easy', text: 'Quote online.' }],
    about: 'Bluebonnet Plumbing has served Waco since 1987.',
  }));
  const fetch = fakeFetch({ 'https://bluebonnetplumbing.com/': { body: '<html><body><p>Family owned since 1987. Licensed and insured.</p></body></html>' } });
  const company = { id: 'b', name: 'Bluebonnet Plumbing', website: 'https://bluebonnetplumbing.com', city: 'Waco', brand: {} };
  const result = await buildDemo(company, { config: cfg, claude, outDir: dir, fetch });
  assert.equal(result.source, 'claude-opus-5-5');
  assert.match(calls[0].system[0].text, /Never invent licenses/);
  assert.match(calls[0].messages[0].content, /Family owned since 1987/);
  assert.match(await readFile(result.file, 'utf8'), /Plumbing repairs in Waco/);
});

test('blog: plan topics, write a post with frontmatter, keep drafts when checks fail', async () => {
  const dir = await tempDir();
  const topicsFile = path.join(dir, 'topics.json');
  const postsDir = path.join(dir, 'blog');
  await writeFile(topicsFile, JSON.stringify({ topics: [{ id: 't001', title: 'Existing idea', status: 'published', service: 'apps' }] }));

  const plan = fakeClaude(() => ({
    topics: [
      { title: 'How much does a custom app cost?', keyword: 'custom app cost', secondary_keywords: ['app development cost'], intent: 'commercial', service: 'apps', audience: 'gyms', angle: 'Cost drivers', outline: ['What drives cost', 'Ways to save'] },
      { title: 'Do dental offices need an AI receptionist?', keyword: 'ai receptionist dental', secondary_keywords: [], intent: 'commercial', service: 'automation', audience: 'dental practices', angle: 'Decision framework', outline: ['When it pays off'] },
    ],
  }));
  const added = await planTopics({ config: cfg, claude: plan.claude, count: 2, topicsFile, postsDir });
  assert.deepEqual(added.map((t) => t.id), ['t002', 't003']);
  assert.match(plan.calls[0].messages[0].content, /Existing idea/, 'existing titles are passed to avoid duplicates');

  const body = `Custom apps cost what their features cost.\n\n## What drives custom app cost\n\n${'Real words about scope and tradeoffs. '.repeat(160)}\n\n## Next steps\n\nSee [Apps](/apps/) or [talk to us](/contact/).\n\n## Frequently asked questions\n\n### Is it cheaper to start with a web app?\n\nOften, yes.`;
  const writer = fakeClaude(() => ({ title: 'How Much Does a Custom App Cost?', description: 'What drives the cost of a custom app for a small business, and how to scope one without overspending.', slug: 'custom-app-cost', tags: ['Apps', 'Pricing'], body_markdown: body }));
  const result = await writePost({ config: cfg, claude: writer.claude, publish: true, today: '2026-10-10', topicsFile, postsDir });
  assert.equal(result.slug, 'custom-app-cost');
  assert.deepEqual(result.problems, []);
  assert.equal(writer.calls[0].output_config.effort, 'high');
  assert.match(writer.calls[0].system[0].text, /No fabricated facts/);
  assert.match(writer.calls[0].messages[0].content, /\[Apps\]\(\/apps\/\)/);
  const file = await readFile(result.file, 'utf8');
  assert.match(file, /^---\ntitle: "How Much Does a Custom App Cost\?"\n/);
  assert.match(file, /\ndate: 2026-10-10\n/);
  assert.match(file, /\ntags: \[apps, pricing\]\n/);
  assert.match(file, /\ndraft: false\n/);
  const topics = await loadTopics(topicsFile);
  assert.equal(topics.topics.find((t) => t.id === 't002').status, 'published');

  // A thin post with no FAQ stays a draft even with --publish.
  const thin = fakeClaude(() => ({ title: 'Short', description: 'x', slug: 'short', tags: [], body_markdown: 'Too short.' }));
  const second = await writePost({ config: cfg, claude: thin.claude, publish: true, topicsFile, postsDir });
  assert.ok(second.problems.length >= 2);
  assert.match(await readFile(second.file, 'utf8'), /draft: true/);
  assert.equal(checkPost({ body_markdown: '# Title\n', description: '' }, { minWords: 10 }).problems.includes('body contains an H1'), true);
  assert.match(toMarkdownFile({ title: 'He said "hi"', draft: false }, 'Body'), /title: "He said \\"hi\\""/);
});

test('push: Instantly bulk payload and Smartlead lead_list', async () => {
  const company = {
    id: 'bluebonnetplumbing.com',
    name: 'Bluebonnet Plumbing',
    website: 'https://bluebonnetplumbing.com',
    domain: 'bluebonnetplumbing.com',
    city: 'Waco',
    state: 'TX',
    primaryService: 'websites',
    scores: { websites: 90 },
    contacts: [{ id: 'p', firstName: 'Dana', email: 'dana@bluebonnetplumbing.com' }],
    primaryContactId: 'p',
    audit: { reachable: true },
    findings: [{ service: 'websites', kind: 'observed', weight: 20, title: 'x', point: 'the site isn’t set up for phones' }],
  };
  company.pitch = (await writePitch(company, { config: cfg, claude: null })).pitch;

  const fake = fakeFetch({
    'https://api.instantly.ai/api/v2/leads/add': { body: { leads_uploaded: 1, skipped_count: 0 } },
    're:server\\.smartlead\\.ai': { body: { upload_count: 1 } },
  });
  const i = await pushToInstantly([company], { apiKey: 'ik', campaignId: 'camp-1', config: cfg, fetch: fake });
  assert.equal(i.uploaded, 1);
  const call = fake.calls[0];
  assert.equal(call.init.headers.authorization, 'Bearer ik');
  assert.equal(call.body.campaign_id, 'camp-1');
  assert.equal(call.body.skip_if_in_campaign, true);
  const lead = call.body.leads[0];
  assert.equal(lead.email, 'dana@bluebonnetplumbing.com');
  assert.match(lead.custom_variables.email_1, /<br>/, 'line breaks survive as <br> by default');
  assert.ok(Object.values(lead.custom_variables).every((v) => ['string', 'number'].includes(typeof v)));

  const s = await pushToSmartlead([company], { apiKey: 's k', campaignId: '42', config: cfg, fetch: fake });
  assert.equal(s.uploaded, 1);
  const sCall = fake.calls[1];
  assert.match(sCall.url, /campaigns\/42\/leads\?api_key=s%20k$/);
  assert.equal(sCall.body.lead_list[0].custom_fields.subject, company.pitch.subject);
});
