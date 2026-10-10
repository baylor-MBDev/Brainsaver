import { DEMO_TOKEN } from './context.js';

// Deterministic copy for when there's no ANTHROPIC_API_KEY (or --no-ai).
// Same rules as the AI writer: one real observation, one ask, no invented
// claims. Plainer than what Claude writes, but safe to send after review.

const sentence = (text) => {
  const t = String(text).trim();
  return t ? `${t[0].toUpperCase()}${t.slice(1)}${/[.?!]$/.test(t) ? '' : '.'}` : '';
};

function industryNoun(company, service) {
  const i = (company.industry ?? '').toLowerCase();
  if (i) return i.replace(/\s+(?:services?|companies|company|business(?:es)?)$/, '');
  return service === 'apps' ? 'local' : 'local service';
}

const LINES = {
  websites: {
    why: (company) =>
      `For a ${industryNoun(company, 'websites')} business, most new customers check the website on their phone before they call, so small things like that decide who gets the call.`,
    pitch: 'I run a small studio that builds fast, modern websites for businesses like yours.',
    noun: 'a new website',
  },
  automation: {
    why: () => 'The leads that come in after hours, or while everyone is busy, are usually the ones that slip away.',
    pitch: 'We set up AI receptionists and follow-up automations that answer in seconds, book appointments, and hand off to your team.',
    noun: 'automation',
  },
  apps: {
    why: () => 'When customers come back as often as yours do, an app with your name on it (bookings, rewards, reminders) is the easiest way to keep them coming back.',
    pitch: 'We design and build iPhone and Android apps for businesses like yours.',
    noun: 'an app',
  },
};

export function templateSequence(ctx) {
  const lines = LINES[ctx.service] ?? LINES.websites;
  const { company, contact, serviceInfo } = ctx;
  const greeting = contact.firstName ? `Hi ${contact.firstName},\n\n` : '';
  const sign = `\n\n${ctx.sender.firstName}`;
  const [first, second] = ctx.observed;
  const where = company.domain ?? 'your site';

  const opener = first
    ? company.hasWebsite
      ? `I was looking at ${where} and noticed ${first.point}.`
      : sentence(`I noticed ${first.point}`)
    : `I came across ${company.name} while looking at ${industryNoun(company, ctx.service)} businesses${company.city ? ` in ${company.city}` : ''}.`;

  const p = ctx.proof[0];
  const proof = p ? ` Recent work includes ${p.name}, ${(p.short ?? p.summary).replace(/^([A-Z])(?=[a-z])/, (ch) => ch.toLowerCase()).replace(/\.$/, '')}.` : '';
  const demoReady = Boolean(ctx.demoUrl) && ctx.demoLink !== 'never';
  const ask =
    ctx.service === 'websites' && demoReady
      ? ctx.demoLink === 'first'
        ? `I put together a quick concept of what a refreshed homepage could look like: ${DEMO_TOKEN}`
        : 'I put together a quick concept of what a refreshed homepage could look like. Want me to send it over?'
      : `If it'd help, I can offer ${serviceInfo.offer.replace(/\.$/, '')}. ${serviceInfo.cta}`;

  const email1 = `${greeting}${opener} ${lines.why(company)}\n\n${lines.pitch}${proof} ${ask}${sign}`;

  const second2 = second ? ` One more thing I noticed: ${second.point}.` : '';
  const demoFollow = demoReady && ctx.demoLink === 'followup' && ctx.service === 'websites' ? ` Here's the concept I mentioned: ${DEMO_TOKEN}` : '';
  const email2 = `${greeting}Following up on my note below.${second2}${demoFollow || ` The offer stands: ${serviceInfo.offer.replace(/\.$/, '')}.`}${sign}`;

  const email3 = `${greeting}I'll close the loop here. If ${lines.noun} moves up the list later, just reply to this email and I'll pick it back up.${sign}`;

  const shortName = company.name.replace(/,?\s+(?:llc|inc|co|corp|ltd|pllc|pc)\.?$/i, '');
  return {
    angle: `${serviceInfo.label} pitch led by: ${first?.title ?? 'industry fit'}`,
    subject: `${shortName.toLowerCase()} ${ctx.service === 'websites' ? 'website' : ctx.service === 'apps' ? 'app idea' : 'after-hours leads'}`,
    alt_subjects: [`idea for ${shortName.toLowerCase()}`, `${serviceInfo.label.toLowerCase()} for ${shortName.toLowerCase()}`],
    first_line: opener,
    emails: [
      { step: 1, body: email1 },
      { step: 2, body: email2 },
      { step: 3, body: email3 },
    ],
  };
}
