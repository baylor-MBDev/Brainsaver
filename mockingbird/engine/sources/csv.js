import { companyId } from '../lib/store.js';
import { isPlatformProfile, normalizeDomain, parseCsv, slugify } from '../lib/util.js';

// Import leads from any CSV: an Apollo export, a Google Maps scrape
// (Outscraper, Apify), a trade-show list, a spreadsheet you built by hand.
// Column names are matched loosely ("Company Name", "company_name", "Company").

const ALIASES = {
  company: ['company', 'companyname', 'organization', 'organizationname', 'account', 'accountname', 'business', 'businessname'],
  website: ['website', 'websiteurl', 'url', 'domain', 'companywebsite', 'companydomain', 'site', 'web'],
  email: ['email', 'emailaddress', 'workemail', 'contactemail', 'businessemail'],
  firstName: ['firstname', 'first', 'fname', 'givenname'],
  lastName: ['lastname', 'last', 'lname', 'surname', 'familyname'],
  fullName: ['fullname', 'contactname', 'personname', 'contact'],
  jobTitle: ['jobtitle', 'position', 'role', 'persontitle'],
  phone: ['phone', 'phonenumber', 'companyphone', 'telephone', 'mobile', 'mobilephone', 'workdirectphone', 'corporatephone'],
  address: ['address', 'fulladdress', 'streetaddress', 'street'],
  city: ['city', 'companycity', 'town'],
  state: ['state', 'companystate', 'region', 'province', 'stateprovince'],
  country: ['country', 'companycountry'],
  industry: ['industry', 'category', 'categoryname', 'categories', 'primarytype', 'businesstype', 'niche'],
  employees: ['employees', 'numberofemployees', 'employeecount', 'numemployees', 'companysize', 'headcount'],
  linkedin: ['linkedin', 'linkedinurl', 'personlinkedinurl', 'contactlinkedin'],
  rating: ['rating', 'totalscore', 'stars', 'googlerating'],
  reviewCount: ['reviews', 'reviewcount', 'reviewscount', 'userratingcount', 'numberofreviews'],
};

const norm = (h) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

function columnMap(headers) {
  const normalized = new Map(headers.map((h) => [norm(h), h]));
  const map = {};
  for (const [field, aliases] of Object.entries(ALIASES)) {
    const hit = aliases.find((a) => normalized.has(a));
    if (hit) map[field] = normalized.get(hit);
  }
  // "Title" is a person's job title in Apollo exports but the business name
  // in Google Maps scrapes. If there's no company column, it's the business.
  if (normalized.has('title')) {
    if (map.company) map.jobTitle ??= normalized.get('title');
    else map.company = normalized.get('title');
  }
  if (!map.company && normalized.has('name') && !map.firstName) map.company = normalized.get('name');
  return map;
}

const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function companiesFromCsv(text, { icp, service } = {}) {
  const rows = parseCsv(text);
  if (!rows.length) return { companies: [], skipped: 0, columns: {} };
  const columns = columnMap(Object.keys(rows[0]));
  if (!columns.company && !columns.website) {
    throw new Error(`Couldn't find a company name or website column. Headers: ${Object.keys(rows[0]).join(', ')}`);
  }
  const get = (row, field) => (columns[field] ? row[columns[field]]?.trim() || null : null);

  const byId = new Map();
  let skipped = 0;
  for (const row of rows) {
    const site = get(row, 'website');
    const profile = site && isPlatformProfile(site);
    const name = get(row, 'company') ?? normalizeDomain(site);
    if (!name && !site) {
      skipped++;
      continue;
    }
    const base = {
      source: 'csv',
      icp: icp?.id,
      serviceHint: service ?? icp?.service,
      name,
      website: site && !profile ? (site.includes('://') ? site : `https://${site}`) : null,
      domain: site && !profile ? normalizeDomain(site) : null,
      socialUrl: profile ? site : null,
      phone: get(row, 'phone'),
      address: get(row, 'address'),
      city: get(row, 'city'),
      state: get(row, 'state'),
      country: get(row, 'country'),
      industry: get(row, 'industry'),
      employees: num(get(row, 'employees')),
      rating: num(get(row, 'rating')),
      reviewCount: num(get(row, 'reviewCount')),
      contacts: [],
    };
    let id;
    try {
      id = companyId(base);
    } catch {
      skipped++;
      continue;
    }
    const company = byId.get(id) ?? { ...base, id };

    let firstName = get(row, 'firstName');
    let lastName = get(row, 'lastName');
    const fullName = get(row, 'fullName');
    if (!firstName && fullName) {
      const [first, ...rest] = fullName.split(/\s+/);
      firstName = first;
      lastName = rest.join(' ') || null;
    }
    const email = get(row, 'email')?.toLowerCase() ?? null;
    if (firstName || email) {
      company.contacts.push({
        id: email ?? `csv-${slugify(`${firstName ?? ''} ${lastName ?? ''}`)}`,
        firstName,
        lastName,
        title: get(row, 'jobTitle'),
        email,
        emailStatus: email ? 'imported' : null,
        linkedin: get(row, 'linkedin'),
        source: 'csv',
      });
    }
    byId.set(id, company);
  }
  return { companies: [...byId.values()], skipped, columns };
}
