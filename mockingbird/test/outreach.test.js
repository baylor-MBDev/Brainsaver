import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../mockingbird.config.js';
import { writePitch } from '../engine/outreach/writer.js';
import { lintSequence, hasErrors } from '../engine/outreach/lint.js';
import { leadPrompt, systemPrompt } from '../engine/outreach/prompt.js';
import { pitchContext, renderEmail, DEMO_TOKEN } from '../engine/outreach/context.js';
import { emailRow, exportBlocker, toExportCsv } from '../engine/outreach/export.js';
import { createClaude } from '../engine/lib/claude.js';
import { parseCsv } from '../engine/lib/util.js';
import { Store } from '../engine/lib/store.js';
import { tempDir } from './helpers.js';

const cfg = structuredClone({ ...config, business: { ...config.business, postalAddress: '1 Test St, Waco, TX 76701' }, sender: { ...config.sender, lastName: 'Tester' } });

function plumber(overrides = {}) {
  return {
    id: 'bluebonnetplumbing.com',
    name: 'Bluebonnet Plumbing',
    domain: 'bluebonnetplumbing.com',
    website: 'https://bluebonnetplumbing.com',
    industry: 'plumbing',
    city: 'Waco',
    state: 'TX',
    primaryService: 'websites',
    scores: { websites: 88, automation: 50, apps: 0 },
    contacts: [{ id: 'p1', firstName: 'Dana', lastName: 'Hart', title: 'Owner', email: 'dana@bluebonnetplumbing.com' }],
    primaryContactId: 'p1',
    audit: { reachable: true },
    findings: [
      { service: 'websites', id: 'not-mobile', weight: 24, kind: 'observed', title: 'Not mobile-friendly', point: 'the site isn’t set up for phones, so it shows up shrunken and hard to tap on mobile' },
      { service: 'websites', id: 'stale-copyright', weight: 10, kind: 'observed', title: 'Footer says © 2016', point: 'the footer still says © 2016' },
      { service: 'automation', id: 'industry-fit', weight: 22, kind: 'context', title: 'x', point: 'new business arrives by phone' },
    ],
    ...overrides,
  };
}

test('template sequence: observation first, real offer, no placeholders, passes lint', async () => {
  const { pitch } = await writePitch(plumber(), { config: cfg, claude: null });
  assert.equal(pitch.source, 'template');
  assert.equal(pitch.emails.length, 3);
  assert.deepEqual(pitch.emails.map((e) => e.delayDays), [0, 3, 7]);
  const [e1, e2] = pitch.emails;
  assert.match(e1.body, /^Hi Dana,/);
  assert.match(e1.body, /I was looking at bluebonnetplumbing\.com and noticed the site isn’t set up for phones/);
  assert.match(e1.body, /free homepage concept built from your current site/);
  assert.match(e2.body, /© 2016/);
  assert.ok(!hasErrors(pitch.lint), JSON.stringify(pitch.lint));
});

test('template without a contact name skips the greeting', async () => {
  const { pitch } = await writePitch(plumber({ contacts: [{ id: 'x', email: 'office@bluebonnetplumbing.com' }], primaryContactId: 'x' }), { config: cfg, claude: null });
  assert.match(pitch.emails[0].body, /^I was looking at/);
  assert.ok(!/Hi\s*,/.test(pitch.emails[0].body));
});

test('demo link goes in the follow-up by default', async () => {
  const { pitch } = await writePitch(plumber({ demo: { url: 'https://demo.example/bluebonnet' } }), { config: cfg, claude: null });
  assert.ok(!pitch.emails[0].body.includes(DEMO_TOKEN));
  assert.ok(pitch.emails[1].body.includes(DEMO_TOKEN));
  const rendered = renderEmail(pitch.emails[1].body, { config: cfg, demoUrl: 'https://demo.example/bluebonnet' });
  assert.match(rendered, /https:\/\/demo\.example\/bluebonnet/);
  assert.match(rendered, /1 Test St, Waco, TX 76701/);
  assert.match(rendered, /reply "no thanks"/);
});

test('lint catches placeholders, nameless greetings, long copy, and spam phrases', () => {
  const issues = lintSequence({
    subject: 'ACT NOW!!',
    emails: [
      { step: 1, body: `Hi ,\n\n{{first_name}} this is a risk-free offer. ${'word '.repeat(150)}` },
      { step: 2, body: 'Just checking in! www.example.com' },
    ],
  });
  const text = issues.map((i) => `${i.level}:${i.message}`).join('\n');
  assert.ok(hasErrors(issues));
  assert.match(text, /error:Unfilled placeholder/);
  assert.match(text, /error:Greeting has no name/);
  assert.match(text, /error:\d+ words/);
  assert.match(text, /warn:Spam-trigger phrase: "risk-free"/);
  assert.match(text, /warn:Contains a link/);
  assert.match(text, /warn:Cliché/);
});

test('prompt only offers configured proof and the configured offer', () => {
  const ctx = pitchContext(plumber(), cfg);
  const prompt = leadPrompt(ctx);
  assert.match(prompt, /OFFER \(the only thing you may offer\): a free homepage concept/);
  assert.match(prompt, /1\. the site isn’t set up for phones/);
  assert.match(prompt, /PROOF\nNone\. Do not mention past work\./, 'no website proof configured yet');
  assert.match(prompt, /first name: Dana/);
  const appsPrompt = leadPrompt(pitchContext(plumber({ primaryService: 'apps' }), cfg));
  assert.match(appsPrompt, /DOOMTYPE/);
  const system = systemPrompt(cfg);
  assert.match(system, /Never invent clients/);
  assert.ok(system.length < 8000);
});

test('Claude writer: sends a cached system prompt with structured output, uses the result', async () => {
  let captured;
  const fakeClient = {
    beta: {
      messages: {
        stream(params) {
          captured = params;
          return {
            finalMessage: async () => ({
              stop_reason: 'end_turn',
              model: 'claude-opus-5-5',
              usage: { input_tokens: 900, output_tokens: 300 },
              parsed_output: {
                angle: 'Mobile experience',
                subject: 'bluebonnet on phones',
                alt_subjects: ['your homepage', 'mobile site'],
                first_line: 'Hi Dana, I noticed your site shrinks on phones.',
                emails: [
                  { step: 2, body: 'Hi Dana,\n\nFollow-up.\n\nBaylor' },
                  { step: 1, body: 'Hi Dana,\n\nI noticed the site is hard to use on a phone. Want me to send a concept?\n\nBaylor' },
                  { step: 3, body: 'Hi Dana,\n\nClosing the loop.\n\nBaylor' },
                ],
              },
            }),
          };
        },
      },
    },
  };
  const claude = createClaude({ client: fakeClient, model: 'claude-opus-5-5' });
  const { pitch } = await writePitch(plumber(), { config: cfg, claude });
  assert.equal(captured.model, 'claude-opus-5-5');
  assert.deepEqual(captured.thinking, { type: 'adaptive' });
  assert.equal(captured.output_config.effort, 'medium');
  assert.equal(captured.output_config.format.type, 'json_schema');
  assert.deepEqual(captured.system[0].cache_control, { type: 'ephemeral' });
  assert.equal(captured.fallbacks, 'default');
  assert.deepEqual(captured.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(pitch.source, 'claude-opus-5-5');
  assert.deepEqual(pitch.emails.map((e) => e.step), [1, 2, 3], 'sorted by step');
  assert.match(pitch.emails[0].body, /hard to use on a phone/);
});

test('Claude refusal surfaces as an error instead of a bad pitch', async () => {
  const client = { beta: { messages: { stream: () => ({ finalMessage: async () => ({ stop_reason: 'refusal', stop_details: { category: 'general_harms' }, parsed_output: null }) }) } } };
  await assert.rejects(writePitch(plumber(), { config: cfg, claude: createClaude({ client }) }), /declined/);
});

test('export: Instantly CSV round-trips multi-line copy; blockers enforced', async () => {
  const store = await Store.open(await tempDir());
  const { pitch } = await writePitch(plumber(), { config: cfg, claude: null });
  const ready = plumber({ pitch, stage: 'approved' });
  const csv = toExportCsv([ready], 'instantly', cfg);
  const [row] = parseCsv(csv);
  assert.equal(row.email, 'dana@bluebonnetplumbing.com');
  assert.equal(row.first_name, 'Dana');
  assert.equal(row.subject, pitch.subject);
  assert.match(row.email_1, /^Hi Dana,\n\nI was looking at/);
  assert.match(row.email_1, /1 Test St, Waco, TX 76701/);
  assert.equal(emailRow(ready, cfg, { html: true }).email_1.includes('<br>'), true);

  const smartlead = parseCsv(toExportCsv([ready], 'smartlead', cfg))[0];
  assert.ok('phone_number' in smartlead);

  assert.equal(exportBlocker(ready, { emails: {}, domains: {} }, store), null);
  assert.match(exportBlocker(ready, { emails: { 'dana@bluebonnetplumbing.com': { reason: 'unsubscribed' } }, domains: {} }, store), /do-not-contact/);
  assert.equal(exportBlocker(plumber({ pitch, contacts: [{ id: 'z' }], primaryContactId: 'z' }), { emails: {}, domains: {} }, store), 'no email address');

  const calls = parseCsv(toExportCsv([plumber({ phone: '(254) 555-0142' })], 'calls', cfg))[0];
  assert.equal(calls.phone, '(254) 555-0142');
  assert.match(calls.opener, /This is Baylor with Mockingbird/);
});

test('CSV export defuses spreadsheet formulas but keeps phone numbers', async () => {
  const { toCsv } = await import('../engine/lib/util.js');
  const csv = toCsv([{ name: '=HYPERLINK("http://x","click")', phone: '+1 254 555 0142', note: '@SUM(A1)', minus: '-cmd|calc' }]);
  const [row] = parseCsv(csv);
  assert.equal(row.name, `'=HYPERLINK("http://x","click")`);
  assert.equal(row.phone, '+1 254 555 0142');
  assert.equal(row.note, `'@SUM(A1)`);
  assert.equal(row.minus, `'-cmd|calc`);
});
