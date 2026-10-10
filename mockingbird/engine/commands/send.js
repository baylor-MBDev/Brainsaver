import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ActionError, exportLeads, suppress } from '../lib/actions.js';
import { sendingBlockers } from '../lib/config.js';
import { ROOT, env } from '../lib/env.js';
import { c, log, displayPath, plural } from '../lib/log.js';
import { setStage } from '../lib/store.js';
import { nowIso, parseCsv } from '../lib/util.js';
import { FORMATS } from '../outreach/export.js';
import { pushToInstantly, pushToSmartlead } from '../outreach/senders.js';

function reportBlocked(blocked) {
  if (!blocked.length) return;
  log.warn(`${blocked.length} left out:`);
  for (const b of blocked.slice(0, 15)) log.info(c.dim(`  ${b.id}: ${b.reason}`));
  if (blocked.length > 15) log.info(c.dim(`  …and ${blocked.length - 15} more`));
}

export async function exportCmd({ store, config }, args) {
  const format = args.values.format ?? 'instantly';
  if (!FORMATS.includes(format)) throw new Error(`--format must be one of: ${FORMATS.join(', ')}`);
  const markQueued = !args.values['dry-run'];
  try {
    const { csv, exported, blocked } = await exportLeads(store, config, { format, html: Boolean(args.values.br), markQueued, stage: args.values.stage });
    reportBlocked(blocked);
    if (!exported.length) return log.info(format === 'calls' ? 'No phone-only leads to export.' : 'Nothing approved to export. Approve pitches in `mb dashboard` or with `mb approve`.');
    const out = args.values.out ?? path.join(ROOT, 'exports', `${nowIso().slice(0, 10)}-${format}.csv`);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, csv);
    log.ok(`${plural(exported.length, 'lead')} → ${displayPath(out)}${markQueued && format !== 'calls' ? ' (marked queued)' : ''}`);
    if (format === 'instantly' || format === 'smartlead') {
      log.info(c.dim(`In the campaign: subject {{subject}}, step bodies {{email_1}} / {{email_2}} / {{email_3}}, follow-ups as replies in the same thread.`));
    }
  } catch (err) {
    if (err instanceof ActionError && err.status === 412) throw new Error(`${err.message}\nFix these in mockingbird.config.js, then export again.`);
    throw err;
  }
}

export async function push({ store, config }, args) {
  const [tool] = args.positionals;
  if (!['instantly', 'smartlead'].includes(tool)) throw new Error('Usage: mb push <instantly|smartlead> --campaign <id>');
  const blockers = sendingBlockers(config);
  if (blockers.length) throw new Error(`Not ready to send:\n- ${blockers.join('\n- ')}`);

  // Same selection and checks as a CSV export, without writing a file or
  // marking anything until the sending tool accepts the leads.
  const { companies, blocked } = await exportLeads(store, config, { format: tool, markQueued: false });
  reportBlocked(blocked);
  if (!companies.length) return log.info('Nothing approved to push.');
  const campaignId = args.values.campaign;
  const options = { campaignId, config, html: !args.values['no-br'] };
  const totals =
    tool === 'instantly'
      ? await pushToInstantly(companies, { ...options, apiKey: env('INSTANTLY_API_KEY') })
      : await pushToSmartlead(companies, { ...options, apiKey: env('SMARTLEAD_API_KEY') });
  for (const company of companies) {
    await store.update(company.id, (co) => {
      setStage(co, 'queued', `pushed to ${tool} campaign ${campaignId}`);
      co.queuedAt = nowIso();
      co.campaign = { tool, id: campaignId };
      return co;
    });
  }
  log.ok(`${tool}: ${totals.uploaded} uploaded, ${totals.skipped} skipped, ${totals.duplicates} duplicates, ${totals.invalid} invalid${totals.blocklisted ? `, ${totals.blocklisted} blocklisted` : ''}`);
}

// Statuses as the sending tools word them, most decisive first.
const SYNC_RULES = [
  [/unsubscrib|do not contact|blocklist/i, 'suppress', 'unsubscribed'],
  [/bounce/i, 'suppress', 'bounced'],
  [/won|closed|customer/i, 'won'],
  [/meeting/i, 'meeting'],
  [/not interested|wrong person|lost/i, 'lost'],
  [/interested|replied|reply|responded/i, 'replied'],
  [/completed|contacted|sent|active|in progress/i, 'contacted'],
];
const ORDER = ['queued', 'contacted', 'replied', 'meeting', 'won'];

/**
 * Pull outcomes back from the sending tool: export the campaign's leads as CSV
 * from Instantly/Smartlead and run `mb sync file.csv`. Unsubscribes and
 * bounces go on the do-not-contact list; replies and meetings advance stages.
 */
export async function sync({ store }, args) {
  const [file] = args.positionals;
  if (!file) throw new Error('Usage: mb sync <campaign-export.csv>');
  const rows = parseCsv(await readFile(file, 'utf8'));
  const emailKey = rows[0] && Object.keys(rows[0]).find((k) => /e-?mail/i.test(k));
  if (!emailKey) throw new Error('No email column in that CSV.');
  const byEmail = new Map();
  for (const co of await store.list()) for (const p of co.contacts ?? []) if (p.email) byEmail.set(p.email.toLowerCase(), co);

  const tally = { advanced: 0, suppressed: 0, unmatched: 0, unchanged: 0 };
  for (const row of rows) {
    const email = row[emailKey]?.trim().toLowerCase();
    if (!email) continue;
    const statusText = Object.entries(row).filter(([k]) => k !== emailKey && /status|interest|reply|replied|unsub|bounce|outcome/i.test(k)).map(([k, v]) => (/^(?:true|yes|1)$/i.test(v) ? k : v)).join(' ');
    const rule = SYNC_RULES.find(([re]) => re.test(statusText));
    const company = byEmail.get(email);
    if (!company) {
      if (rule?.[1] === 'suppress') {
        await suppress(store, email, rule[2]);
        tally.suppressed++;
      } else tally.unmatched++;
      continue;
    }
    if (!rule) {
      tally.unchanged++;
      continue;
    }
    if (rule[1] === 'suppress') {
      await suppress(store, email, rule[2]);
      tally.suppressed++;
      continue;
    }
    const target = rule[1];
    const forward = target === 'lost' ? company.stage !== 'won' : ORDER.indexOf(target) > ORDER.indexOf(company.stage);
    if (!forward || company.stage === target) {
      tally.unchanged++;
      continue;
    }
    await store.update(company.id, (co) => setStage(co, target, `synced from ${file.split('/').pop()}`));
    tally.advanced++;
  }
  log.ok(`Sync: ${tally.advanced} advanced, ${tally.suppressed} suppressed, ${tally.unchanged} unchanged, ${tally.unmatched} not in the pipeline`);
  return tally;
}
