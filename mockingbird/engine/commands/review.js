import { approve, mark, suppress } from '../lib/actions.js';
import { c, log, table } from '../lib/log.js';
import { primaryContact, STAGES } from '../lib/store.js';
import { renderEmail } from '../outreach/context.js';
import { hasErrors } from '../outreach/lint.js';

const score = (co) => (co.primaryService && co.scores ? `${co.primaryService} ${co.scores[co.primaryService]}` : '');

export async function list({ store }, args) {
  const filter = { stage: args.values.stage, service: args.values.service, icp: args.values.icp };
  const companies = (await store.list(filter)).slice(0, Number(args.values.limit) || 50);
  if (!companies.length) return log.info('No leads match.');
  log.info(
    table(companies, [
      { label: 'ID', get: (co) => co.id, max: 34 },
      { label: 'NAME', get: (co) => co.name, max: 30 },
      { label: 'STAGE', get: (co) => co.stage },
      { label: 'SCORE', get: score },
      { label: 'CONTACT', get: (co) => primaryContact(co)?.email ?? (co.channel === 'phone' ? co.phone : ''), max: 32 },
      { label: 'NOTE', get: (co) => co.skipReason ?? co.findings?.[0]?.title ?? '', max: 40 },
    ]),
  );
}

export async function show({ store, config }, args) {
  const [id] = args.positionals;
  const co = id && (await store.get(id));
  if (!co) throw new Error(`Usage: mb show <id>   (no lead "${id ?? ''}")`);
  const contact = primaryContact(co);
  log.info(`${c.bold(co.name ?? co.id)}  ${c.dim(co.website ?? co.socialUrl ?? '')}`);
  log.info(`${c.dim('stage')} ${co.stage}${co.skipReason ? c.dim(` (${co.skipReason})`) : ''}   ${c.dim('icp')} ${co.icp ?? '-'}   ${c.dim('location')} ${[co.city, co.state].filter(Boolean).join(', ') || '-'}`);
  if (co.scores) log.info(`${c.dim('scores')} websites ${co.scores.websites} · automation ${co.scores.automation} · apps ${co.scores.apps}  → ${c.bold(co.primaryService)}`);
  if (contact) log.info(`${c.dim('contact')} ${[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '(no name)'} ${contact.title ? `· ${contact.title}` : ''} ${contact.email ? `· ${contact.email}` : ''}`);
  if (co.findings?.length) {
    log.info(c.bold('\nFindings'));
    for (const f of co.findings.filter((f) => f.weight > 0).slice(0, 10)) log.info(`  ${String(f.weight).padStart(3)}  ${c.dim(f.service.padEnd(10))} ${f.point}`);
  }
  if (co.pitch) {
    log.info(c.bold(`\nPitch (${co.pitch.source})`) + c.dim(`  ${co.pitch.angle ?? ''}`));
    log.info(`${c.dim('Subject:')} ${co.pitch.subject}`);
    for (const email of co.pitch.emails) {
      log.info(c.dim(`\n--- email ${email.step} (day ${email.delayDays}) ---`));
      log.info(renderEmail(email.body, { config, demoUrl: co.demo?.url }));
    }
    for (const issue of co.pitch.lint ?? []) log.info(`${issue.level === 'error' ? c.red('error') : c.yellow('warn')}  email ${issue.step}: ${issue.message}`);
  }
}

export async function approveCmd({ store, config }, args) {
  let ids = args.positionals;
  if (args.values.all) {
    ids = (await store.list({ stage: 'pitched' })).filter((co) => !hasErrors(co.pitch?.lint ?? [])).map((co) => co.id);
    if (!ids.length) return log.info('No clean pitched leads to approve.');
    log.warn(`Approving ${ids.length} pitches without reading them. You're responsible for every email that goes out.`);
  }
  if (!ids.length) throw new Error('Usage: mb approve <id...> | --all');
  for (const id of ids) {
    try {
      await approve(store, id, { config });
      log.ok(`approved ${id}`);
    } catch (err) {
      log.error(`${id}: ${err.message}${err.details ? `\n  ${err.details.map((i) => `${i.level}: ${i.message}`).join('\n  ')}` : ''}`);
    }
  }
}

export async function markCmd({ store }, args) {
  const [id, stage] = args.positionals;
  if (!id || !stage) throw new Error(`Usage: mb mark <id> <stage> [--note "..."]\nStages: ${STAGES.join(', ')}`);
  const co = await mark(store, id, stage, args.values.note);
  log.ok(`${co.id} → ${co.stage}`);
}

export async function suppressCmd({ store }, args) {
  const [value] = args.positionals;
  if (!value) throw new Error('Usage: mb suppress <email|domain> [--reason "unsubscribed"]');
  const affected = await suppress(store, value, args.values.reason ?? 'manual');
  log.ok(`${value} is on the do-not-contact list${affected.length ? `; moved ${affected.length} lead(s) to suppressed` : ''}`);
}

export async function report({ store }) {
  const all = await store.list();
  if (!all.length) return log.info('No leads yet. Start with `mb run --icp <id>`.');
  // A lead "reached" a stage if it's there now or passed through it (every
  // stage change is in its history), so lost deals still count as replies.
  const reached = (stage) =>
    stage === 'sourced' ? all.length : all.filter((co) => co.stage === stage || co.history?.some((h) => h.event === `stage:${stage}`)).length;
  const now = all.reduce((acc, co) => ((acc[co.stage] = (acc[co.stage] ?? 0) + 1), acc), {});

  log.info(c.bold('Pipeline') + c.dim('   (now / ever reached)'));
  for (const stage of ['sourced', 'audited', 'qualified', 'enriched', 'pitched', 'approved', 'queued', 'contacted', 'replied', 'meeting', 'won']) {
    log.info(`  ${stage.padEnd(10)} ${String(now[stage] ?? 0).padStart(5)}  ${c.dim(String(reached(stage)).padStart(5))}`);
  }
  for (const stage of ['lost', 'skipped', 'suppressed']) if (now[stage]) log.info(c.dim(`  ${stage.padEnd(10)} ${String(now[stage]).padStart(5)}`));

  // Outbound rates only count leads we actually sent to; inbound inquiries
  // start at "replied" and would inflate them.
  const passed = (co, stage) => co.stage === stage || co.history?.some((h) => h.event === `stage:${stage}`);
  const sentLeads = all.filter((co) => passed(co, 'queued'));
  if (sentLeads.length) {
    const pct = (stage) => `${((sentLeads.filter((co) => passed(co, stage)).length / sentLeads.length) * 100).toFixed(1)}%`;
    log.info(`\n${c.bold('Outbound:')} of ${sentLeads.length} sent, ${pct('replied')} replied, ${pct('meeting')} booked a meeting, ${pct('won')} won`);
  }
  const inboundLeads = all.filter((co) => co.source === 'inbound' || co.inbound);
  if (inboundLeads.length) {
    log.info(`${c.bold('Inbound:')} ${inboundLeads.length} inquiries, ${inboundLeads.filter((co) => passed(co, 'meeting')).length} meetings, ${inboundLeads.filter((co) => passed(co, 'won')).length} won`);
  }

  const qualified = all.filter((co) => co.scores && co.stage !== 'skipped');
  if (qualified.length) {
    log.info(c.bold('\nPrimary service (qualified and beyond)'));
    const services = qualified.reduce((acc, co) => ((acc[co.primaryService] = (acc[co.primaryService] ?? 0) + 1), acc), {});
    for (const [service, n] of Object.entries(services)) log.info(`  ${service.padEnd(10)} ${String(n).padStart(5)}`);
  }

  const skipReasons = all.filter((co) => co.stage === 'skipped').reduce((acc, co) => {
    const reason = (co.skipReason ?? 'unknown').replace(/\s*\(.*\)$/, '');
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});
  if (Object.keys(skipReasons).length) {
    log.info(c.bold('\nWhy leads were skipped'));
    for (const [reason, n] of Object.entries(skipReasons).sort((a, b) => b[1] - a[1]).slice(0, 6)) log.info(`  ${String(n).padStart(5)}  ${reason}`);
  }
}
