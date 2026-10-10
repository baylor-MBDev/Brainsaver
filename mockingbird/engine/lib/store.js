import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { normalizeDomain, nowIso, slugify } from './util.js';

/*
 * Lead storage: one JSON file per company under data/companies/.
 *
 * One file per company keeps the CLI and the dashboard from clobbering each
 * other's edits, makes every write atomic, and makes deleting a person's data
 * on request a single `rm`. Plenty fast for the tens of thousands of leads a
 * small agency will ever touch.
 */

export const STAGES = [
  'sourced', // pulled from a lead source, not looked at yet
  'audited', // website analyzed and scored
  'qualified', // scored high enough to be worth a contact reveal / pitch
  'enriched', // has a reachable contact (email revealed)
  'pitched', // outreach sequence drafted, waiting for review
  'approved', // a human signed off on the copy
  'queued', // exported / pushed to the sending tool
  'contacted', // first email went out
  'replied',
  'meeting',
  'won',
  'lost',
  'skipped', // not a fit (see skipReason)
  'suppressed', // asked not to be contacted, bounced, or on the do-not-contact list
];

const HISTORY_LIMIT = 100;

export function companyId({ domain, placeId, name, city }) {
  const d = normalizeDomain(domain);
  if (d) return d;
  if (placeId) return `place-${String(placeId).replace(/[^A-Za-z0-9_-]/g, '')}`;
  const slug = slugify([name, city].filter(Boolean).join(' '));
  if (!slug) throw new Error('A company needs a domain, a place id, or a name');
  return `name-${slug}`;
}

export function addEvent(company, event, detail) {
  company.history = [...(company.history ?? []), { at: nowIso(), event, ...(detail ? { detail } : {}) }].slice(
    -HISTORY_LIMIT,
  );
  return company;
}

export function setStage(company, stage, detail) {
  if (!STAGES.includes(stage)) throw new Error(`Unknown stage "${stage}". Stages: ${STAGES.join(', ')}`);
  const from = company.stage;
  company.stage = stage;
  if (stage !== 'skipped') delete company.skipReason;
  addEvent(company, `stage:${stage}`, detail ?? (from ? `from ${from}` : undefined));
  return company;
}

export function skip(company, reason) {
  setStage(company, 'skipped', reason);
  company.skipReason = reason;
  return company;
}

export function primaryContact(company) {
  const contacts = company.contacts ?? [];
  return contacts.find((p) => p.id === company.primaryContactId) ?? contacts.find((p) => p.email) ?? contacts[0] ?? null;
}

const safeFileName = (id) => String(id).toLowerCase().replace(/[^a-z0-9._-]/g, '_');

async function atomicWrite(file, contents) {
  const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, contents);
  await rename(tmp, file);
}

export class Store {
  constructor(dir) {
    this.dir = dir;
    this.companyDir = path.join(dir, 'companies');
    this.suppressionFile = path.join(dir, 'suppression.json');
  }

  static async open(dir) {
    const store = new Store(dir);
    await mkdir(store.companyDir, { recursive: true });
    return store;
  }

  fileFor(id) {
    return path.join(this.companyDir, `${safeFileName(id)}.json`);
  }

  async get(id) {
    try {
      return JSON.parse(await readFile(this.fileFor(id), 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async put(company) {
    if (!company.id) throw new Error('company.id is required');
    company.updatedAt = nowIso();
    company.createdAt ??= company.updatedAt;
    await atomicWrite(this.fileFor(company.id), `${JSON.stringify(company, null, 2)}\n`);
    return company;
  }

  async update(id, mutate) {
    const company = await this.get(id);
    if (!company) throw new Error(`No lead with id "${id}"`);
    const next = (await mutate(company)) ?? company;
    return this.put(next);
  }

  async remove(id) {
    await rm(this.fileFor(id), { force: true });
  }

  /** All companies, newest first, optionally filtered. */
  async list(filter = {}) {
    let files;
    try {
      files = (await readdir(this.companyDir)).filter((f) => f.endsWith('.json'));
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
    const companies = [];
    for (const file of files) {
      try {
        companies.push(JSON.parse(await readFile(path.join(this.companyDir, file), 'utf8')));
      } catch {
        // A half-written or hand-mangled file shouldn't take down the whole run.
      }
    }
    return companies
      .filter((co) => matches(co, filter))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  /**
   * Insert a company from a lead source, or merge it into the existing record
   * without touching pipeline progress (stage, audit, pitch, history).
   */
  async upsertFromSource(incoming) {
    const id = incoming.id ?? companyId(incoming);
    const existing = await this.get(id);
    if (!existing) {
      const company = { ...incoming, id, stage: 'sourced', contacts: incoming.contacts ?? [], history: [] };
      addEvent(company, 'sourced', incoming.source);
      await this.put(company);
      return { company, created: true };
    }
    const merged = { ...existing };
    for (const [key, value] of Object.entries(incoming)) {
      if (['contacts', 'stage', 'history', 'id'].includes(key)) continue;
      if (merged[key] === undefined || merged[key] === null || merged[key] === '') merged[key] = value;
    }
    merged.contacts = mergeContacts(existing.contacts ?? [], incoming.contacts ?? []);
    await this.put(merged);
    return { company: merged, created: false };
  }

  // --- do-not-contact list ------------------------------------------------

  async suppression() {
    try {
      return JSON.parse(await readFile(this.suppressionFile, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return { emails: {}, domains: {} };
      throw err;
    }
  }

  async suppress(value, reason = 'manual') {
    const list = await this.suppression();
    const entry = { reason, at: nowIso() };
    const v = String(value).trim().toLowerCase();
    if (v.includes('@')) list.emails[v] = entry;
    else {
      const domain = normalizeDomain(v);
      if (!domain) throw new Error(`"${value}" is not an email address or a domain`);
      list.domains[domain] = entry;
    }
    await atomicWrite(this.suppressionFile, `${JSON.stringify(list, null, 2)}\n`);
    return list;
  }

  /** Returns the reason a company must not be contacted, or null. */
  isSuppressed(company, list) {
    const domain = normalizeDomain(company.domain);
    if (domain && list.domains[domain]) return `${domain} is on the do-not-contact list (${list.domains[domain].reason})`;
    for (const person of company.contacts ?? []) {
      const email = person.email?.toLowerCase();
      if (!email) continue;
      if (list.emails[email]) return `${email} is on the do-not-contact list (${list.emails[email].reason})`;
      const emailDomain = email.split('@')[1];
      if (list.domains[emailDomain]) return `${emailDomain} is on the do-not-contact list (${list.domains[emailDomain].reason})`;
    }
    return null;
  }
}

function matches(company, filter) {
  const want = (value, actual) =>
    value === undefined || value === null || (Array.isArray(value) ? value.includes(actual) : value === actual);
  return (
    want(filter.stage, company.stage) &&
    want(filter.icp, company.icp) &&
    want(filter.service, company.primaryService ?? company.serviceHint) &&
    want(filter.source, company.source)
  );
}

function contactKey(person) {
  return person.apolloId ?? person.email?.toLowerCase() ?? `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim().toLowerCase();
}

export function mergeContacts(existing, incoming) {
  const out = existing.map((p) => ({ ...p }));
  for (const person of incoming) {
    const key = contactKey(person);
    const match = key && out.find((p) => contactKey(p) === key);
    if (!match) {
      out.push({ ...person });
      continue;
    }
    for (const [k, v] of Object.entries(person)) {
      if (v !== undefined && v !== null && v !== '' && (match[k] === undefined || match[k] === null || match[k] === '')) match[k] = v;
    }
  }
  return out;
}
