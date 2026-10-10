import { z } from 'zod';
import { DEMO_TOKEN } from './context.js';

export const SequenceSchema = z.object({
  angle: z.string().describe('One sentence for the human reviewer: the pitch angle and why it fits this prospect.'),
  subject: z.string().describe('Subject line for email 1.'),
  alt_subjects: z.array(z.string()).describe('Two alternative subject lines for A/B testing.'),
  first_line: z.string().describe('The personalized opening sentence of email 1, on its own.'),
  emails: z
    .array(
      z.object({
        step: z.number().int().describe('1, 2, or 3'),
        body: z.string().describe('Plain-text body: greeting through sign-off, no signature block or footer.'),
      }),
    )
    .describe('Exactly three emails: the opener and two follow-ups.'),
});

const BANNED = ['leverage', 'synergy', 'cutting-edge', 'game-changer', 'game changer', 'revolutionize', 'elevate', 'unlock', 'seamless', 'supercharge', 'skyrocket', 'next level', 'world-class', 'best-in-class', 'I hope this email finds you well', 'quick question', 'just checking in', 'touch base', 'circle back'];

/** Stable instructions. Identical for every lead, so it caches. */
export function systemPrompt(config) {
  const b = config.business;
  const services = Object.entries(config.services)
    .map(([, s]) => `- ${s.label}: ${s.summary}`)
    .join('\n');
  return `You write cold outreach emails for ${b.name}, a small software studio${b.city ? ` based in ${b.city}, ${b.region}` : ''}. What the studio does:
${services}

For each prospect you get verified facts about their business and the one service to pitch. You write a three-email sequence whose only goal is a reply.

How to write:
- Sound like one busy person writing to another: plain text, short sentences, conversational. No exclamation marks, no emojis, no bullet lists, no bold.
- Open with ONE specific observation from the VERIFIED FINDINGS that the prospect can check for themselves in ten seconds. Use at most two findings per email. Translate technical findings into what their customers experience.
- Never insult their current website, vendor, or staff. Describe the gap, not a failure.
- Make exactly one low-friction ask per email, built from the OFFER. Do not invent prices, discounts, guarantees, timelines, statistics, or results.
- Mention past work only from the PROOF list, described accurately. Never invent clients, case studies, testimonials, or numbers. If no proof is listed, mention none.
- Write in the sender's voice ("I noticed..."). Don't call it an audit, scan, or report, and don't claim things the sender didn't do (calling their office, visiting in person, being a customer).
- Greet by first name if one is given ("Hi Dana,"). If no first name is given, skip the greeting line entirely.
- End each email with just the sender's first name on its own line. No signature block, address, links to our site, or unsubscribe text; those are added automatically.
- Never use these words or phrases: ${BANNED.join(', ')}.
- No links of any kind, except the literal token ${DEMO_TOKEN} where the DEMO instructions allow it. Never write a URL yourself.

The sequence:
- Email 1: at most ${config.outreach.maxWords} words. Observation, why it matters to them, who we are in one clause, the ask.
- Email 2: a reply in the same thread, at most 70 words. Bring one new angle or a second finding; don't restate email 1.
- Email 3: a short close-the-loop, at most 45 words. Gracious, zero pressure.
- Subject lines: two to five words, specific to them, no clickbait, no "quick question", no ALL CAPS. Lowercase is fine.`;
}

const fmt = (label, value) => (value === null || value === undefined || value === '' ? null : `${label}: ${value}`);

/** The per-lead request. */
export function leadPrompt(ctx) {
  const { company, contact, serviceInfo, sequence } = ctx;
  const facts = [
    fmt('Company', `${company.name}${company.domain ? ` (${company.domain})` : ''}`),
    fmt('Industry', company.industry),
    fmt('Location', [company.city, company.region].filter(Boolean).join(', ')),
    fmt('Employees', company.employees ? `about ${company.employees}` : null),
    fmt('Google rating', company.rating ? `${company.rating} from ${company.reviewCount ?? '?'} reviews` : null),
    fmt('Website', company.hasWebsite ? null : 'none'),
  ].filter(Boolean);

  const recipient = contact.firstName
    ? `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ''}${contact.title ? `, ${contact.title}` : ''} (first name: ${contact.firstName})`
    : 'No name known. Skip the greeting line.';

  const findings = ctx.observed.length
    ? ctx.observed.map((f, i) => `${i + 1}. ${f.point}`).join('\n')
    : 'None verified on their site. Lean on the context below and keep the observation general to their industry.';
  const context = ctx.context.map((f) => `- ${f.point}`).join('\n');

  const proof = ctx.proof.length ? ctx.proof.map((p) => `- ${p.name}: ${p.summary}`).join('\n') : 'None. Do not mention past work.';

  let demo;
  if (!ctx.demoUrl || ctx.demoLink === 'never') {
    demo = ctx.demoUrl
      ? 'A concept homepage exists, but do not link it. You may say you put one together and offer to send it.'
      : 'None built. Do not claim one exists.';
  } else if (ctx.demoLink === 'first') {
    demo = `A concept homepage has been built for them. Email 1 says so and includes the token ${DEMO_TOKEN} where the link goes.`;
  } else {
    demo = `A concept homepage has been built for them. Email 1 mentions you put a concept together and asks if they'd like to see it, with no link. Email 2 includes the token ${DEMO_TOKEN} where the link goes.`;
  }

  return [
    'PROSPECT',
    ...facts,
    `Recipient: ${recipient}`,
    '',
    `SERVICE TO PITCH: ${serviceInfo.label}, "${serviceInfo.headline}"`,
    serviceInfo.summary,
    '',
    `OFFER (the only thing you may offer): ${serviceInfo.offer}`,
    `A call to action you can adapt: ${serviceInfo.cta}`,
    '',
    'VERIFIED FINDINGS (strongest first)',
    findings,
    ...(context ? ['', 'CONTEXT (inferred, not verified on their site; use lightly)', context] : []),
    '',
    'PROOF',
    proof,
    '',
    'DEMO',
    demo,
    '',
    `SENDER: ${ctx.sender.firstName}${ctx.sender.title ? `, ${ctx.sender.title}` : ''} at ${ctx.business.name}`,
    `Timing: email 2 goes ${sequence[1]?.delayDays ?? 3} days after email 1, email 3 goes ${sequence[2]?.delayDays ?? 7} days after email 1.`,
  ].join('\n');
}
