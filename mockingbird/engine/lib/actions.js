import { exportBlocker, toExportCsv } from '../outreach/export.js';
import { lintPitch, hasErrors } from '../outreach/lint.js';
import { sendingBlockers } from './config.js';
import { addEvent, setStage, STAGES } from './store.js';
import { normalizeDomain, nowIso } from './util.js';

// Operations shared by the CLI and the dashboard, so both enforce the same
// rules (lint before approval, suppression before export, legal footer).

export class ActionError extends Error {
  constructor(message, { status = 400, details } = {}) {
    super(message);
    this.name = 'ActionError';
    this.status = status;
    this.details = details;
  }
}

async function load(store, id) {
  const company = await store.get(id);
  if (!company) throw new ActionError(`No lead with id "${id}"`, { status: 404 });
  return company;
}

function relint(company, config) {
  company.pitch.lint = lintPitch(company.pitch, company, config);
  return company.pitch.lint;
}

export async function approve(store, id, { config }) {
  const company = await load(store, id);
  if (!company.pitch) throw new ActionError('Nothing to approve: no pitch drafted yet', { status: 409 });
  const issues = relint(company, config);
  if (hasErrors(issues)) throw new ActionError('Fix the lint errors before approving', { status: 409, details: issues });
  setStage(company, 'approved');
  company.pitch.approvedAt = nowIso();
  return store.put(company);
}

export async function updatePitch(store, id, { subject, emails, altSubjects }, { config }) {
  const company = await load(store, id);
  if (!company.pitch) throw new ActionError('No pitch to edit', { status: 409 });
  if (typeof subject === 'string') company.pitch.subject = subject.trim();
  if (Array.isArray(altSubjects)) company.pitch.altSubjects = altSubjects.map((s) => String(s).trim()).filter(Boolean);
  if (Array.isArray(emails)) {
    for (const edit of emails) {
      const email = company.pitch.emails.find((e) => e.step === Number(edit.step));
      if (email && typeof edit.body === 'string') email.body = edit.body.replace(/\r\n/g, '\n').trim();
    }
  }
  company.pitch.edited = true;
  company.pitch.editedAt = nowIso();
  relint(company, config);
  // Editing an approved pitch sends it back for another look.
  if (company.stage === 'approved') setStage(company, 'pitched', 'edited after approval');
  else addEvent(company, 'pitch:edited');
  return store.put(company);
}

export async function mark(store, id, stage, note, { config } = {}) {
  if (!STAGES.includes(stage)) throw new ActionError(`Unknown stage "${stage}". Use one of: ${STAGES.join(', ')}`);
  // Approval has its own gate (lint must pass); don't let a stage change skip it.
  if (stage === 'approved') {
    if (!config) throw new ActionError('Use approve() to approve a pitch', { status: 409 });
    return approve(store, id, { config });
  }
  const company = await load(store, id);
  setStage(company, stage, note || undefined);
  if (stage === 'skipped') company.skipReason = note || 'skipped by reviewer';
  return store.put(company);
}

export async function addNote(store, id, note) {
  const company = await load(store, id);
  company.notes = String(note ?? '');
  addEvent(company, 'note');
  return store.put(company);
}

export async function setPrimaryContact(store, id, contactId) {
  const company = await load(store, id);
  if (!(company.contacts ?? []).some((p) => p.id === contactId)) throw new ActionError('No such contact on this lead', { status: 404 });
  company.primaryContactId = contactId;
  addEvent(company, 'contact:primary', contactId);
  return store.put(company);
}

/** Add an email or domain to the do-not-contact list and pull matching leads. */
export async function suppress(store, value, reason = 'manual') {
  await store.suppress(value, reason);
  const list = await store.suppression();
  const v = String(value).trim().toLowerCase();
  const domain = v.includes('@') ? null : normalizeDomain(v);
  const affected = [];
  for (const company of await store.list()) {
    const hit = domain ? normalizeDomain(company.domain) === domain || company.contacts?.some((p) => p.email?.endsWith(`@${domain}`)) : company.contacts?.some((p) => p.email?.toLowerCase() === v);
    if (hit && company.stage !== 'suppressed' && store.isSuppressed(company, list)) {
      setStage(company, 'suppressed', reason);
      await store.put(company);
      affected.push(company.id);
    }
  }
  return affected;
}

/**
 * Build an export for a sending tool. Returns the CSV plus what was left out
 * and why. With `markQueued`, exported leads move to "queued".
 */
export async function exportLeads(store, config, { format = 'instantly', html = false, markQueued = true, stage } = {}) {
  if (format !== 'calls') {
    const blockers = sendingBlockers(config);
    if (blockers.length) throw new ActionError(`Not ready to send:\n- ${blockers.join('\n- ')}`, { status: 412, details: blockers });
  }
  if (format !== 'calls' && stage && !['approved', 'queued'].includes(stage)) {
    throw new ActionError('Only approved leads can be exported for email (or "queued" ones, to re-export).', { status: 400 });
  }
  const suppression = await store.suppression();
  const all = await store.list();
  let candidates;
  if (format === 'calls') {
    candidates = all.filter((co) => (stage ? co.stage === stage : co.stage === 'enriched' && co.channel === 'phone'));
  } else {
    candidates = all.filter((co) => co.stage === (stage ?? 'approved'));
  }
  const ready = [];
  const blocked = [];
  for (const company of candidates) {
    const reason = format === 'calls' ? (company.phone ? store.isSuppressed(company, suppression) : 'no phone number') : exportBlocker(company, suppression, store);
    if (reason) blocked.push({ id: company.id, name: company.name, reason });
    else ready.push(company);
  }
  const csv = ready.length ? toExportCsv(ready, format, config, { html }) : '';
  if (markQueued && format !== 'calls') {
    for (const company of ready) {
      setStage(company, 'queued', `exported (${format})`);
      company.queuedAt = nowIso();
      await store.put(company);
    }
  }
  return { csv, exported: ready.map((co) => co.id), blocked, companies: ready };
}
