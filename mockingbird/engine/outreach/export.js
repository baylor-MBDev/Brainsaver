import { renderEmail } from './context.js';
import { hasErrors } from './lint.js';
import { primaryContact } from '../lib/store.js';
import { toCsv } from '../lib/util.js';

/*
 * Turns approved pitches into rows for a cold-email sending tool.
 *
 * The sending tool (Instantly, Smartlead, ...) owns the actual sending:
 * warmed-up inboxes, throttling, reply detection, bounce handling, and
 * unsubscribes. We hand it fully written, per-lead copy as custom variables.
 * In the campaign, each step's body is just {{email_1}}, {{email_2}}, ...
 */

export const FORMATS = ['instantly', 'smartlead', 'csv', 'calls'];

/** Why a lead can't be exported right now, or null if it can. */
export function exportBlocker(company, suppression, store) {
  const contact = primaryContact(company);
  if (!company.pitch) return 'no pitch drafted';
  if (!contact?.email) return 'no email address';
  if (hasErrors(company.pitch.lint ?? [])) return 'pitch has lint errors';
  const suppressed = store.isSuppressed(company, suppression);
  if (suppressed) return suppressed;
  return null;
}

function bodies(company, config, { html }) {
  const out = {};
  for (const email of company.pitch.emails) {
    let text = renderEmail(email.body, { config, demoUrl: company.demo?.url });
    if (html) text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>');
    out[`email_${email.step}`] = text;
  }
  return out;
}

export function emailRow(company, config, { html = false } = {}) {
  const contact = primaryContact(company);
  const location = [company.city, company.state].filter(Boolean).join(', ');
  return {
    email: contact.email,
    first_name: contact.firstName ?? '',
    last_name: contact.lastName ?? '',
    company_name: company.name,
    website: company.website ?? '',
    phone: company.phone ?? contact.phone ?? '',
    location,
    personalization: company.pitch.firstLine,
    subject: company.pitch.subject,
    ...bodies(company, config, { html }),
    service: company.pitch.service,
    score: company.scores?.[company.pitch.service] ?? '',
    demo_url: company.demo?.url ?? '',
    lead_id: company.id,
  };
}

const EMAIL_COLUMNS = ['email', 'first_name', 'last_name', 'company_name', 'website', 'phone', 'location', 'personalization', 'subject', 'email_1', 'email_2', 'email_3', 'service', 'score', 'demo_url', 'lead_id'];

// Smartlead's importer recognizes these exact headers; the rest become custom fields.
const SMARTLEAD_RENAME = { phone: 'phone_number' };

/** A phone call list for leads with a number but no email (common for local businesses). */
export function callRow(company, config) {
  const points = (company.findings ?? []).filter((f) => f.service === company.primaryService && f.kind !== 'context').slice(0, 3);
  const me = `This is ${config.sender.firstName} with ${config.business.shortName ?? config.business.name}`;
  const opener = points[0]
    ? `Hi, is this the owner? ${me}. I was looking at ${company.domain ?? `${company.name} online`} and noticed ${points[0].point}. Is that something you've been meaning to get to?`
    : `Hi, is this the owner? ${me}. We build websites, automations, and apps for businesses like yours, and I had an idea for ${company.name}. Do you have a minute?`;
  return {
    company_name: company.name,
    phone: company.phone ?? primaryContact(company)?.phone ?? '',
    location: [company.city, company.state].filter(Boolean).join(', '),
    website: company.website ?? company.socialUrl ?? '',
    rating: company.rating ? `${company.rating} (${company.reviewCount ?? 0})` : '',
    service: company.primaryService ?? '',
    score: company.scores?.[company.primaryService] ?? '',
    talking_points: points.map((p) => p.point).join(' | '),
    opener,
    lead_id: company.id,
  };
}

export function toExportCsv(companies, format, config, opts = {}) {
  if (format === 'calls') return toCsv(companies.map((co) => callRow(co, config)));
  const rows = companies.map((co) => emailRow(co, config, opts));
  if (format === 'smartlead') {
    const renamed = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [SMARTLEAD_RENAME[k] ?? k, v])));
    return toCsv(renamed, EMAIL_COLUMNS.map((c) => SMARTLEAD_RENAME[c] ?? c));
  }
  return toCsv(rows, EMAIL_COLUMNS);
}
