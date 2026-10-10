import { primaryContact } from '../lib/store.js';
import { senderName } from '../lib/config.js';

export const DEMO_TOKEN = '[DEMO_LINK]';

/** Everything the writer (AI or template) needs about one lead. */
export function pitchContext(company, config) {
  const service = company.primaryService ?? company.serviceHint ?? 'websites';
  const contact = primaryContact(company);
  const findings = (company.findings ?? []).filter((f) => f.service === service && f.weight > 0);
  const observed = findings.filter((f) => f.kind !== 'context');
  const context = findings.filter((f) => f.kind === 'context');
  return {
    service,
    serviceInfo: config.services[service],
    company: {
      name: company.name ?? company.audit?.brand?.name,
      domain: company.domain,
      industry: company.industry ?? null,
      city: company.city ?? company.audit?.brand?.address?.city ?? null,
      region: company.state ?? company.audit?.brand?.address?.region ?? null,
      employees: company.employees ?? null,
      rating: company.rating ?? null,
      reviewCount: company.reviewCount ?? null,
      hasWebsite: !company.audit?.noWebsite,
    },
    contact: contact
      ? { firstName: contact.firstName || null, lastName: contact.lastName || null, title: contact.title || null }
      : { firstName: null, lastName: null, title: null },
    observed,
    context,
    proof: (config.proof ?? []).filter((p) => p.service === service),
    demoUrl: company.demo?.url ?? null,
    demoLink: config.outreach.demoLink,
    sender: { firstName: config.sender.firstName, name: senderName(config), title: config.sender.title },
    business: config.business,
    sequence: config.outreach.sequence,
    maxWords: config.outreach.maxWords,
  };
}

/** Footer appended to every email: identity, postal address, opt-out. */
export function emailFooter(config) {
  const b = config.business;
  const lines = [
    `${senderName(config)}${config.sender.title ? `, ${config.sender.title}` : ''}`,
    b.name,
    b.siteUrl?.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    b.postalAddress,
  ].filter(Boolean);
  return `\n\n--\n${lines.join('\n')}\n\n${config.outreach.optOutLine}`;
}

/** Final email text as it will be sent. */
export function renderEmail(body, { config, demoUrl }) {
  let text = String(body).trim();
  if (demoUrl) text = text.split(DEMO_TOKEN).join(demoUrl);
  return `${text}${emailFooter(config)}`;
}
