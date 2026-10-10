import { DEMO_TOKEN } from './context.js';
import { wordCount } from '../lib/util.js';

// Checks a drafted sequence before a human approves it. "error" blocks
// approval and export; "warn" is shown to the reviewer.

const SPAMMY = /\b(?:act now|limited time|risk[- ]free|100% (?:free|guaranteed)|guarantee[ds]?|click here|buy now|urgent|winner|congratulations|no obligation|special promotion|earn (?:money|\$)|cash bonus|lowest price|double your|once in a lifetime)\b|\${2,}/i;
const CLICHES = /\b(?:hope this (?:email )?finds you well|quick question|just checking in|touch base|circle back|per my last email|synergy|leverage|game[- ]changer|revolutioni[sz]e|cutting[- ]edge|supercharge|skyrocket)\b/i;
const PLACEHOLDER = /\{\{[^}]*\}\}|\{[a-z_]+\}|\[(?:first ?name|company|name|your name)\]/i;
const LINK = /https?:\/\/|www\.[a-z]/i;

/** Word limits per sequence step; step 1 comes from config.outreach.maxWords. */
export const wordLimits = (maxWords = 110) => ({ 1: maxWords, 2: 70, 3: 45 });

export function lintSequence(pitch, { maxWords = 110, demoLink = 'followup', allowCaps = [] } = {}) {
  const okCaps = new Set(['HVAC', 'HTTPS', 'HTML', 'SEO', 'CRM', 'LLC', 'PLLC', 'USA', 'ASAP', ...allowCaps.map((w) => w.toUpperCase())]);
  const issues = [];
  const add = (level, step, message) => issues.push({ level, step, message });

  if (!pitch?.subject?.trim()) add('error', 1, 'Missing subject line');
  else {
    if (pitch.subject.length > 60) add('warn', 1, 'Subject is long (over 60 characters)');
    if (/[A-Z]{4,}/.test(pitch.subject)) add('warn', 1, 'Subject has ALL CAPS');
    if (/!/.test(pitch.subject)) add('warn', 1, 'Subject has an exclamation mark');
  }
  if (!Array.isArray(pitch?.emails) || pitch.emails.length === 0) {
    add('error', 1, 'No emails in the sequence');
    return issues;
  }

  for (const email of pitch.emails) {
    const step = email.step;
    const body = String(email.body ?? '');
    if (!body.trim()) {
      add('error', step, 'Empty email');
      continue;
    }
    const limit = wordLimits(maxWords)[step] ?? 70;
    const words = wordCount(body.replace(DEMO_TOKEN, ''));
    if (words > limit * 1.25) add('error', step, `${words} words; keep it under ${limit}`);
    else if (words > limit) add('warn', step, `${words} words; aim for under ${limit}`);
    if (PLACEHOLDER.test(body)) add('error', step, `Unfilled placeholder: ${body.match(PLACEHOLDER)[0]}`);
    if (/^hi\s*,/im.test(body)) add('error', step, 'Greeting has no name ("Hi ,")');
    if (LINK.test(body.replace(DEMO_TOKEN, ''))) add('warn', step, 'Contains a link; links in cold email hurt deliverability');
    if (body.includes(DEMO_TOKEN) && step === 1 && demoLink !== 'first') add('warn', step, 'Demo link in the first email (config says follow-up only)');
    if (/!/.test(body)) add('warn', step, 'Uses an exclamation mark');
    if (SPAMMY.test(body)) add('warn', step, `Spam-trigger phrase: "${body.match(SPAMMY)[0]}"`);
    if (CLICHES.test(body)) add('warn', step, `Cliché: "${body.match(CLICHES)[0]}"`);
    const caps = body.match(/\b[A-Z]{4,}\b/g)?.filter((w) => !okCaps.has(w));
    if (caps?.length) add('warn', step, `ALL CAPS: ${caps.slice(0, 3).join(', ')}`);
  }
  return issues;
}

export const hasErrors = (issues) => issues.some((i) => i.level === 'error');

/** Lint a lead's pitch with the settings from config. */
export function lintPitch(pitch, company, config) {
  return lintSequence(pitch, {
    maxWords: config.outreach.maxWords,
    demoLink: config.outreach.demoLink,
    allowCaps: [...(config.proof ?? []).map((p) => p.name), company.name ?? '', ...String(company.name ?? '').split(/\s+/)],
  });
}
