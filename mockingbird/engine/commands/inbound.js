import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditAndScore } from '../audit/index.js';
import { checkConnectivity } from '../audit/network.js';
import { auditReport } from '../audit/report.js';
import { d1Query } from '../lib/cloudflare.js';
import { dataDir, env } from '../lib/env.js';
import { c, log, displayPath } from '../lib/log.js';
import { addEvent, companyId, setStage } from '../lib/store.js';
import { normalizeDomain, nowIso, truncate } from '../lib/util.js';

const reportsDir = () => path.join(dataDir(), 'reports');

async function writeReport(company, config) {
  await mkdir(reportsDir(), { recursive: true });
  const file = path.join(reportsDir(), `${company.id}-${nowIso().slice(0, 10)}.md`);
  await writeFile(file, auditReport(company, { config }));
  return file;
}

async function requireOnline() {
  const net = await checkConnectivity();
  if (!net.online) throw new Error(`Can't reach the internet from Node (${net.reason}). Behind a proxy? Re-run with NODE_USE_ENV_PROXY=1.`);
}

function printFindings(company) {
  const scores = company.scores;
  log.info(`${c.bold(company.name ?? company.domain)}  ${c.dim(`websites ${scores.websites} · automation ${scores.automation} · apps ${scores.apps} → ${company.primaryService}`)}`);
  for (const f of (company.findings ?? []).filter((x) => x.weight > 0).slice(0, 8)) {
    log.info(`  ${String(f.weight).padStart(3)}  ${c.dim(f.service.padEnd(10))} ${f.point}`);
  }
}

/** mb check <url>: audit any site right now and write a plain-English report. */
export async function checkCmd({ config, store }, args) {
  const [url] = args.positionals;
  const domain = normalizeDomain(url);
  if (!domain) throw new Error('Usage: mb check <url> [--name "Business name"] [--no-psi] [--save]');
  await requireOnline();
  const company = { id: companyId({ domain }), name: args.values.name ?? domain, website: url, domain, source: 'manual', contacts: [] };
  log.step(`Checking ${domain}${args.values['no-psi'] ? '' : ' (with PageSpeed, ≈20s)'}`);
  const result = await auditAndScore(company, {
    config,
    pagespeed: args.values['no-psi'] ? false : config.audit.pagespeed,
    psiKey: env('PAGESPEED_API_KEY'),
    timeoutMs: config.audit.timeoutMs,
  });
  Object.assign(company, { audit: result.audit, scores: result.scores, primaryService: result.primaryService, findings: result.findings });
  if (!args.values.name && result.audit.brand?.name) company.name = result.audit.brand.name;
  printFindings(company);
  const file = await writeReport(company, config);
  log.ok(`Report: ${displayPath(file)}`);
  if (args.values.save) {
    const { id, name, website, source } = company;
    await store.upsertFromSource({ id, name, website, domain, source, contacts: [] });
    await store.update(id, (co) => {
      Object.assign(co, { audit: result.audit, scores: result.scores, primaryService: result.primaryService, findings: result.findings, brand: result.audit.brand });
      return setStage(co, 'audited', 'mb check');
    });
    log.ok(`Saved to the pipeline as ${id}`);
  }
}

/**
 * mb inbound: pull contact-form and free-audit requests from the website's D1
 * database into the pipeline. Audit requests get their site checked and a
 * report written, ready to send back personally.
 */
export async function inbound({ config, store }, args) {
  const rows = await d1Query("SELECT * FROM inbound_leads WHERE status = 'new' ORDER BY created_at LIMIT ?", [Number(args.values.limit) || 50]);
  if (!rows.length) return log.info('No new inquiries.');
  const anyWebsite = rows.some((r) => normalizeDomain(r.website));
  if (anyWebsite) await requireOnline();

  for (const row of rows) {
    const domain = normalizeDomain(row.website);
    const [firstName, ...rest] = String(row.name ?? '').trim().split(/\s+/);
    const contact = { id: row.email.toLowerCase(), firstName: firstName || null, lastName: rest.join(' ') || null, email: row.email.toLowerCase(), emailStatus: 'inbound', source: 'inbound' };
    const incoming = {
      source: 'inbound',
      name: row.company || domain || row.name,
      website: domain ? row.website : null,
      domain,
      serviceHint: ['websites', 'automation', 'apps'].includes(row.service) ? row.service : null,
      industry: row.business_type || null,
      contacts: [contact],
    };
    const { company } = await store.upsertFromSource({ ...incoming, id: companyId({ domain, name: incoming.name }) });

    let result = null;
    if (domain) {
      result = await auditAndScore(company, { config, icpService: incoming.serviceHint, pagespeed: config.audit.pagespeed, psiKey: env('PAGESPEED_API_KEY'), timeoutMs: config.audit.timeoutMs });
    }
    const updated = await store.update(company.id, (co) => {
      co.inbound = { type: row.type ?? 'contact', service: row.service ?? null, budget: row.budget ?? null, message: row.message ?? null, page: row.page ?? null, at: row.created_at };
      co.primaryContactId = contact.id;
      co.channel = 'email';
      if (result) Object.assign(co, { audit: result.audit, scores: result.scores, primaryService: result.primaryService, findings: result.findings, brand: result.audit.brand });
      if (result?.audit.brand?.name && co.name === domain) co.name = result.audit.brand.name;
      addEvent(co, 'inbound', `${co.inbound.type} via website`);
      // They wrote to us: the conversation has started.
      if (!['meeting', 'won'].includes(co.stage)) setStage(co, 'replied', 'inbound inquiry');
      return co;
    });

    const report = updated.inbound.type === 'audit' && result ? await writeReport(updated, config) : null;
    log.info(`\n${c.bold(updated.name)}  ${c.dim(`${row.type ?? 'contact'} · ${row.email}${row.service ? ` · ${row.service}` : ''}`)}`);
    if (row.message) log.info(`  “${truncate(row.message.replace(/\s+/g, ' '), 200)}”`);
    if (report) log.info(`  ${c.green('report')} ${displayPath(report)}`);
    else if (result) log.info(c.dim(`  best fit: ${updated.primaryService} (${updated.scores[updated.primaryService]})`));

    if (!args.values['dry-run']) await d1Query("UPDATE inbound_leads SET status = 'imported' WHERE id = ?", [row.id]);
  }
  log.ok(`${rows.length} inquiries imported; they're marked "replied" in the pipeline.`);
  log.info(c.dim('Reports are drafts: the site promises a person reviews each one, so open their site on a phone, check the report, and edit before sending.'));
}
