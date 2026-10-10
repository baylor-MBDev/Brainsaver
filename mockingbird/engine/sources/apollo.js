import { requestJson } from '../lib/http.js';
import { companyId } from '../lib/store.js';
import { mapPool, normalizeDomain } from '../lib/util.js';

/*
 * Apollo.io, spent carefully:
 *
 *   1. Company search  POST /mixed_companies/search   1 credit per page of 100
 *   2. (we audit every site for free and score it)
 *   3. People search   POST /mixed_people/api_search   free, but no emails
 *   4. Reveal          POST /people/bulk_match         1 credit per email
 *
 * Steps 3-4 only run for companies that scored high enough to pitch, so a
 * 500-company search costs ~5 credits plus one per qualified lead.
 */

const BASE = 'https://api.apollo.io/api/v1';

export function createApollo({ apiKey, fetch } = {}) {
  if (!apiKey) throw new Error('APOLLO_API_KEY is not set. See docs/SETUP.md.');

  const call = (path, { json, query } = {}) =>
    requestJson(`${BASE}${path}${query ? `?${new URLSearchParams(query)}` : ''}`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'cache-control': 'no-cache', accept: 'application/json' },
      json: json ?? {},
      fetch,
      retries: 4,
    }).catch((err) => {
      if (err.status === 403) {
        throw new Error(`Apollo refused ${path} (403). Your API key needs access to this endpoint: in Apollo, edit the key and enable it (or make it a master key).`);
      }
      throw err;
    });

  return {
    /** One page of companies matching the ICP's organization filters. */
    async searchOrganizations(filters, { page = 1, perPage = 100 } = {}) {
      const data = await call('/mixed_companies/search', { json: { ...filters, page, per_page: perPage } });
      return [...(data.organizations ?? []), ...(data.accounts ?? [])];
    },

    /** Free people search. Returns previews: id, first name, title (no email). */
    async searchPeople(filters, { perPage = 10 } = {}) {
      const data = await call('/mixed_people/api_search', { json: { ...filters, page: 1, per_page: perPage } });
      return data.people ?? [];
    },

    /** Decision makers at each company, keyed by our company id. */
    async findPeople(companies, personFilters = {}, { concurrency = 3 } = {}) {
      const out = new Map();
      await mapPool(companies, concurrency, async (company) => {
        const where = company.apolloOrgId
          ? { organization_ids: [company.apolloOrgId] }
          : company.domain
            ? { q_organization_domains_list: [company.domain] }
            : null;
        if (!where) return;
        const people = await this.searchPeople({ ...personFilters, ...where }, { perPage: 10 });
        out.set(company.id, people.map(personToContact));
      });
      return out;
    },

    /** Reveal emails (1 credit each when found). Returns Map(apolloId -> contact fields). */
    async revealEmails(apolloIds) {
      const out = new Map();
      for (let i = 0; i < apolloIds.length; i += 10) {
        const batch = apolloIds.slice(i, i + 10);
        const data = await call('/people/bulk_match', {
          json: { details: batch.map((id) => ({ id })) },
          query: { reveal_personal_emails: 'false' },
        });
        for (const match of data.matches ?? []) {
          if (match?.id) out.set(match.id, personToContact(match));
        }
      }
      return out;
    },
  };
}

export function organizationToCompany(org, { icp } = {}) {
  const website = org.website_url ?? (org.primary_domain ? `https://${org.primary_domain}` : null);
  const company = {
    source: 'apollo',
    icp: icp?.id,
    serviceHint: icp?.service,
    apolloOrgId: org.id,
    name: org.name ?? null,
    website,
    domain: normalizeDomain(org.primary_domain ?? website),
    phone: org.primary_phone?.number ?? org.phone ?? org.sanitized_phone ?? null,
    linkedin: org.linkedin_url ?? null,
    industry: org.industry ?? null,
    keywords: (org.keywords ?? []).slice(0, 15),
    employees: org.estimated_num_employees ?? null,
    city: org.city ?? null,
    state: org.state ?? null,
    country: org.country ?? null,
    foundedYear: org.founded_year ?? null,
    fundingStage: org.latest_funding_stage ?? null,
    totalFunding: org.total_funding ?? null,
    contacts: [],
  };
  company.id = companyId(company);
  return company;
}

export function personToContact(person) {
  return {
    id: `apollo-${person.id}`,
    apolloId: person.id,
    firstName: person.first_name ?? null,
    lastName: person.last_name ?? null,
    lastNameHint: person.last_name_obfuscated ?? null,
    title: person.title ?? null,
    seniority: person.seniority ?? null,
    email: person.email && !/email_not_unlocked|domain\.com$/i.test(person.email) ? person.email.toLowerCase() : null,
    emailStatus: person.email_status ?? (person.has_email === false ? 'unavailable' : null),
    linkedin: person.linkedin_url ?? null,
    city: person.city ?? null,
    state: person.state ?? null,
    source: 'apollo',
  };
}

const SENIORITY_RANK = ['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director', 'manager', 'senior', 'entry'];

/**
 * The one person to email at a company: the closest match to the ICP's title
 * list (earlier titles win), then seniority, preferring verified emails.
 */
export function pickBestPerson(contacts, preferredTitles = []) {
  const candidates = contacts.filter((p) => p.emailStatus !== 'unavailable');
  if (!candidates.length) return null;
  const titles = preferredTitles.map((t) => t.toLowerCase());
  const titleRank = (p) => {
    const t = (p.title ?? '').toLowerCase();
    const i = titles.findIndex((want) => t.includes(want));
    return i === -1 ? titles.length : i;
  };
  const seniorityRank = (p) => {
    const i = SENIORITY_RANK.indexOf(p.seniority ?? '');
    return i === -1 ? SENIORITY_RANK.length : i;
  };
  return [...candidates].sort(
    (a, b) =>
      Number(Boolean(b.email)) - Number(Boolean(a.email)) ||
      titleRank(a) - titleRank(b) ||
      seniorityRank(a) - seniorityRank(b) ||
      Number(b.emailStatus === 'verified') - Number(a.emailStatus === 'verified'),
  )[0];
}
