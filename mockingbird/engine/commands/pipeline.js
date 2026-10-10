import { readFile } from 'node:fs/promises';
import { auditAndScore } from '../audit/index.js';
import { checkConnectivity } from '../audit/network.js';
import { companiesFromCsv } from '../sources/csv.js';
import { placesQueries, placeToCompany, searchPlaces } from '../sources/places.js';
import { createApollo, organizationToCompany, pickBestPerson } from '../sources/apollo.js';
import { writePitch } from '../outreach/writer.js';
import { createClaude, hasClaude } from '../lib/claude.js';
import { getIcp } from '../lib/config.js';
import { env } from '../lib/env.js';
import { c, log } from '../lib/log.js';
import { primaryContact, setStage, skip } from '../lib/store.js';
import { mapPool } from '../lib/util.js';

const intOpt = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

async function saveNew(store, companies) {
  let created = 0;
  let merged = 0;
  for (const company of companies) {
    const result = await store.upsertFromSource(company);
    if (result.created) created++;
    else merged++;
  }
  return { created, merged };
}

// --- mb source ---------------------------------------------------------------

export async function source({ config, store }, args) {
  const [provider] = args.positionals;
  if (!args.values.icp) throw new Error('Pass --icp <id>. ICPs are defined in mockingbird.config.js.');
  const icp = getIcp(config, args.values.icp);
  const limit = intOpt(args.values.limit, 50);

  if (provider === 'places') {
    const apiKey = env('GOOGLE_PLACES_API_KEY');
    const queries = placesQueries(icp, { city: args.values.city, query: args.values.query });
    const found = [];
    // Google bills per request, not per result, so take a full page (up to
    // 20) from each query in turn until we have enough.
    for (const query of queries) {
      if (found.length >= limit) break;
      log.step(`Google Places: "${query}"`);
      const places = await searchPlaces(query, { apiKey, maxResults: Math.min(20, limit - found.length) });
      found.push(...places.map((p) => placeToCompany(p, { icp, query })));
    }
    const open = found.filter((co) => !co.businessStatus || co.businessStatus === 'OPERATIONAL').slice(0, limit);
    const { created, merged } = await saveNew(store, open);
    log.ok(`${created} new businesses, ${merged} already known (${found.length - open.length} closed or over limit skipped)`);
    return { created, merged };
  }

  if (provider === 'apollo') {
    const apollo = createApollo({ apiKey: env('APOLLO_API_KEY') });
    const page = intOpt(args.values.page, 1);
    log.step(`Apollo company search for ${c.bold(icp.id)}, page ${page} (1 credit per page)`);
    const orgs = await apollo.searchOrganizations(icp.apollo?.organizations ?? {}, { page, perPage: Math.min(100, limit) });
    const withSites = orgs.filter((o) => o.website_url || o.primary_domain).slice(0, limit);
    // No people yet: decision makers are looked up (free) and their emails
    // revealed (paid) in `mb enrich`, only for companies that qualify.
    const { created, merged } = await saveNew(store, withSites.map((org) => organizationToCompany(org, { icp })));
    log.ok(`${created} new companies, ${merged} already known, ${orgs.length - withSites.length} without a website skipped. Next page: --page ${page + 1}`);
    return { created, merged };
  }

  throw new Error('Usage: mb source <apollo|places> --icp <id> [--limit N]');
}

// --- mb import ---------------------------------------------------------------

export async function importCsv({ config, store }, args) {
  const [file] = args.positionals;
  if (!file) throw new Error('Usage: mb import <file.csv> [--icp <id>] [--service websites|automation|apps]');
  const icp = args.values.icp ? getIcp(config, args.values.icp) : null;
  const { companies, skipped, columns } = companiesFromCsv(await readFile(file, 'utf8'), { icp, service: args.values.service });
  log.step(`Matched columns: ${Object.entries(columns).map(([k, v]) => `${k}←"${v}"`).join(', ')}`);
  const { created, merged } = await saveNew(store, companies);
  log.ok(`${created} new companies, ${merged} merged into existing, ${skipped} rows skipped`);
  return { created, merged, skipped };
}

// --- mb audit ----------------------------------------------------------------

function applyAudit(company, result, config) {
  company.audit = result.audit;
  company.scores = result.scores;
  company.primaryService = result.primaryService;
  company.findings = result.findings;
  const s = result.audit.signals;
  if (s) {
    company.phone ??= s.phones[0] ?? null;
    company.siteEmails = s.emails;
    company.social = s.social;
  }
  if (result.audit.brand) company.brand = result.audit.brand;
  setStage(company, 'audited', `${result.primaryService} ${result.scores[result.primaryService]}`);
  const best = result.scores[result.primaryService];
  if (best >= config.scoring.qualifyAt) setStage(company, 'qualified', `${result.primaryService} score ${best}`);
  else skip(company, `low opportunity score (${result.primaryService} ${best}, needs ${config.scoring.qualifyAt})`);
  return company;
}

export async function audit({ config, store }, args) {
  const ids = args.values.id ? [].concat(args.values.id) : null;
  const all = await store.list();
  let targets = ids
    ? all.filter((co) => ids.includes(co.id))
    : all.filter((co) => (args.values.force ? ['sourced', 'audited', 'qualified', 'enriched', 'skipped'].includes(co.stage) : co.stage === 'sourced'));
  if (args.values.icp) targets = targets.filter((co) => co.icp === args.values.icp);
  targets = targets.slice(0, intOpt(args.values.limit, 50));
  if (!targets.length) {
    log.info('Nothing to audit. Pull leads with `mb source` or `mb import` first.');
    return { audited: 0 };
  }

  const net = await checkConnectivity();
  if (!net.online) {
    throw new Error(
      `Can't reach the internet from Node (${net.reason}), so every site would look down. Not auditing.\nBehind a proxy? Re-run with NODE_USE_ENV_PROXY=1 (Node 22.21+).`,
    );
  }
  const suppression = await store.suppression();
  const pagespeed = args.values['no-psi'] ? false : config.audit.pagespeed;
  const psiKey = env('PAGESPEED_API_KEY');
  if (pagespeed && !psiKey) log.warn('No PAGESPEED_API_KEY: PageSpeed runs unauthenticated and may be rate limited.');
  log.step(`Auditing ${targets.length} sites${pagespeed ? ' (with PageSpeed, ≈20s each)' : ''}`);

  const tally = { qualified: 0, skipped: 0, suppressed: 0, failed: 0 };
  await mapPool(targets, intOpt(args.values.concurrency, config.audit.concurrency), async (company) => {
    try {
      const blocked = store.isSuppressed(company, suppression);
      if (blocked) {
        await store.update(company.id, (co) => setStage(co, 'suppressed', blocked));
        tally.suppressed++;
        return;
      }
      if (company.chainLocation) {
        await store.update(company.id, (co) => skip(co, 'location page of a chain website'));
        tally.skipped++;
        return;
      }
      const icpService = company.icp ? config.icps[company.icp]?.service : company.serviceHint;
      const result = await auditAndScore(company, { config, icpService, pagespeed, psiKey, timeoutMs: config.audit.timeoutMs });
      const updated = await store.update(company.id, (co) => applyAudit(co, result, config));
      tally[updated.stage === 'qualified' ? 'qualified' : 'skipped']++;
      const best = updated.scores[updated.primaryService];
      const mark = updated.stage === 'qualified' ? c.green('qualified') : c.dim('skipped');
      log.info(`  ${mark}  ${updated.name ?? updated.id}  ${c.dim(`${updated.primaryService} ${best}`)}${result.findings[0] ? c.dim(` · ${result.findings[0].title}`) : ''}`);
    } catch (err) {
      tally.failed++;
      log.error(`${company.id}: ${err.message}`);
    }
  });
  log.ok(`Audit done: ${tally.qualified} qualified, ${tally.skipped} skipped, ${tally.suppressed} suppressed, ${tally.failed} failed`);
  return tally;
}

// --- mb enrich ---------------------------------------------------------------

const ROLE_EMAIL = /^(?:info|contact|hello|office|admin|sales|support|team|service|appointments?|frontdesk|reception|inquiries|mail)@/i;

function siteContact(company) {
  const emails = company.siteEmails ?? [];
  if (!emails.length) return null;
  const own = emails.filter((e) => company.domain && e.endsWith(`@${company.domain}`));
  const personal = own.find((e) => !ROLE_EMAIL.test(e));
  const email = personal ?? own[0] ?? emails[0];
  return { id: email, email, emailStatus: 'from_website', source: 'website', firstName: null, lastName: null, title: null };
}

export async function enrich({ config, store }, args) {
  const limit = intOpt(args.values.limit, 25);
  const targets = (await store.list({ stage: 'qualified' })).slice(0, limit);
  if (!targets.length) {
    log.info('No qualified leads waiting for a contact. Run `mb audit` first.');
    return { enriched: 0 };
  }
  const apolloKey = env('APOLLO_API_KEY');
  const apollo = apolloKey ? createApollo({ apiKey: apolloKey }) : null;
  if (!apollo) log.warn('No APOLLO_API_KEY: using emails found on prospects’ websites only.');

  // Decision makers (free search), then one email reveal per company (paid).
  const picks = new Map();
  if (apollo) {
    const needPeople = targets.filter((co) => !primaryContact(co)?.email && (co.apolloOrgId || co.domain));
    const byIcp = groupBy(needPeople, (co) => co.icp ?? '');
    for (const [icpId, group] of byIcp) {
      const filters = config.icps[icpId]?.apollo?.people ?? {};
      const found = await apollo.findPeople(group, filters);
      for (const co of group) {
        const person = pickBestPerson([...(co.contacts ?? []), ...(found.get(co.id) ?? [])], filters.person_titles);
        if (person?.apolloId) picks.set(co.id, person);
      }
    }
    const toReveal = [...picks.values()].filter((p) => !p.email).map((p) => p.apolloId);
    const revealed = toReveal.length ? await apollo.revealEmails(toReveal) : new Map();
    for (const [id, person] of picks) picks.set(id, { ...person, ...(revealed.get(person.apolloId) ?? {}) });
    log.step(`Apollo: ${picks.size} decision makers found, ${[...revealed.values()].filter((p) => p.email).length} emails revealed (≈1 credit each)`);
  }

  const tally = { email: 0, phone: 0, none: 0 };
  for (const company of targets) {
    await store.update(company.id, (co) => {
      const person = picks.get(co.id);
      if (person) {
        co.contacts = [...(co.contacts ?? []).filter((x) => x.apolloId !== person.apolloId), person];
        if (person.email) co.primaryContactId = person.id;
      }
      if (!primaryContact(co)?.email) {
        const fromSite = siteContact(co);
        if (fromSite) {
          co.contacts = [...(co.contacts ?? []).filter((x) => x.email !== fromSite.email), fromSite];
          co.primaryContactId = fromSite.id;
        }
      }
      const contact = primaryContact(co);
      if (contact?.email) {
        co.channel = 'email';
        setStage(co, 'enriched', `${contact.email} (${contact.emailStatus ?? contact.source ?? 'unknown'})`);
        tally.email++;
      } else if (co.phone) {
        co.channel = 'phone';
        setStage(co, 'enriched', `phone only: ${co.phone}`);
        tally.phone++;
      } else {
        skip(co, 'no email or phone found');
        tally.none++;
      }
      return co;
    });
  }
  log.ok(`Contacts: ${tally.email} by email, ${tally.phone} phone-only (see \`mb export --format calls\`), ${tally.none} unreachable`);
  return tally;
}

function groupBy(items, key) {
  const out = new Map();
  for (const item of items) {
    const k = key(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

// --- mb pitch ----------------------------------------------------------------

export async function pitch({ config, store }, args) {
  const ids = args.values.id ? [].concat(args.values.id) : null;
  const all = await store.list();
  const targets = (ids ? all.filter((co) => ids.includes(co.id)) : all.filter((co) => co.stage === 'enriched' && co.channel === 'email'))
    .filter((co) => primaryContact(co)?.email)
    .slice(0, intOpt(args.values.limit, 25));
  if (!targets.length) {
    log.info('No leads ready to pitch. Run `mb enrich` first.');
    return { pitched: 0 };
  }
  const useAi = !args.values['no-ai'] && hasClaude();
  const claude = useAi ? createClaude({ model: config.ai.model }) : null;
  log.step(`Drafting ${targets.length} sequences with ${useAi ? config.ai.model : 'templates (no ANTHROPIC_API_KEY or --no-ai)'}`);

  const tally = { pitched: 0, failed: 0, inputTokens: 0, outputTokens: 0 };
  await mapPool(targets, intOpt(args.values.concurrency, 3), async (company) => {
    try {
      const { pitch: drafted, usage } = await writePitch(company, { config, claude });
      tally.inputTokens += usage?.input_tokens ?? 0;
      tally.outputTokens += usage?.output_tokens ?? 0;
      await store.update(company.id, (co) => {
        co.pitch = drafted;
        setStage(co, config.outreach.requireApproval ? 'pitched' : 'approved', drafted.source);
        return co;
      });
      tally.pitched++;
      const errors = drafted.lint.filter((i) => i.level === 'error').length;
      log.info(`  ${c.green('drafted')}  ${company.name}  ${c.dim(drafted.subject)}${errors ? c.red(` · ${errors} lint error(s)`) : ''}`);
    } catch (err) {
      tally.failed++;
      log.error(`${company.id}: ${err.message}`);
    }
  });
  const tokens = tally.inputTokens ? c.dim(` (${tally.inputTokens.toLocaleString()} in / ${tally.outputTokens.toLocaleString()} out tokens)`) : '';
  log.ok(`${tally.pitched} drafted, ${tally.failed} failed${tokens}. Review them with \`mb dashboard\`.`);
  return tally;
}

// --- mb run ------------------------------------------------------------------

export async function run(ctx, args) {
  if (!args.values.icp) throw new Error(`Pass --icp <id>. Defined in mockingbird.config.js: ${Object.keys(ctx.config.icps).join(', ')}`);
  const icp = getIcp(ctx.config, args.values.icp);
  let provider = args.values.source;
  if (!provider) {
    if (icp.places && env('GOOGLE_PLACES_API_KEY')) provider = 'places';
    else if (icp.apollo && env('APOLLO_API_KEY')) provider = 'apollo';
    else throw new Error('No lead source configured: set GOOGLE_PLACES_API_KEY or APOLLO_API_KEY in .env, or `mb import` a CSV and run audit/enrich/pitch.');
  }
  log.info(c.bold(`\n1/4 Source (${provider})`));
  await source(ctx, { ...args, positionals: [provider] });
  log.info(c.bold('\n2/4 Audit'));
  await audit(ctx, { ...args, values: { ...args.values, id: undefined } });
  log.info(c.bold('\n3/4 Find contacts'));
  await enrich(ctx, args);
  if (args.values.demo) {
    log.info(c.bold('\n   Concept sites for website leads'));
    const { demo } = await import('./content.js');
    await demo(ctx, { ...args, values: { ...args.values, id: undefined, deploy: false } });
  }
  log.info(c.bold('\n4/4 Draft outreach'));
  await pitch(ctx, { ...args, values: { ...args.values, id: undefined } });
  log.info(`\nNext: ${c.cyan('mb dashboard')} to review and approve, then ${c.cyan('mb export --format instantly')}.`);
}

