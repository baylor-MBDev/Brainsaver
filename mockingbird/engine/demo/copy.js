import { z } from 'zod';

// Copy for a prospect's concept homepage. Claude rewrites what's already on
// their site into a clearer structure; it is told not to invent anything a
// visitor might rely on (licenses, years, guarantees, prices, reviews).

export const DemoCopySchema = z.object({
  headline: z.string().describe('Hero headline, 4-9 words, specific to their trade and area.'),
  subheadline: z.string().describe('One or two sentences under the headline.'),
  primary_cta: z.string().describe('Main button label, 2-4 words, e.g. "Get a free quote" or "Book online".'),
  services: z
    .array(z.object({ name: z.string(), description: z.string().describe('One sentence.') }))
    .describe('3 to 6 services they actually list on their site.'),
  highlights: z
    .array(z.object({ title: z.string(), text: z.string() }))
    .describe('Exactly 3 reasons to choose them, each backed by something stated on their site.'),
  about: z.string().describe('2-3 sentences about the business using only facts from their site.'),
});

export const DEMO_SYSTEM = `You write homepage copy for a concept redesign of a small business's website. You are given the text of their current homepage and some facts about them.

Rules:
- Use only facts present in the provided text and facts. Never invent licenses, certifications, years in business, awards, guarantees, prices, response times, staff names, or reviews. If the source doesn't support a claim, don't make it.
- Rewrite for clarity: short, concrete, customer-focused sentences in plain English. No hype words (premier, world-class, cutting-edge, unparalleled, seamless, elevate).
- Services must come from what the business actually lists. Use their wording for service names when it's clear.
- Highlights: three reasons a customer would pick them, each grounded in the source text (for example "Family owned since 1987" only if the text says so). If the text supports fewer than three, fill the rest with true statements about how the new site helps a customer act (for example "Request a quote online in under a minute").
- Keep the headline specific to their trade and, if known, their area.`;

export function demoPrompt({ company, brand, pageText }) {
  const facts = [
    `Business name: ${company.name}`,
    company.industry && `Industry: ${company.industry}`,
    (company.city || brand?.address?.city) && `Location: ${[company.city ?? brand.address.city, company.state ?? brand?.address?.region].filter(Boolean).join(', ')}`,
    company.phone && `Phone: ${company.phone}`,
    company.rating && `Google rating: ${company.rating} from ${company.reviewCount} reviews`,
    brand?.services?.length && `Services listed in their navigation/headings: ${brand.services.join('; ')}`,
    brand?.tagline && `Their current meta description: ${brand.tagline}`,
  ].filter(Boolean);
  return `FACTS\n${facts.join('\n')}\n\nCURRENT HOMEPAGE TEXT (may be messy)\n${pageText || '(unavailable)'}`;
}

/** Copy built only from extracted data, for when there's no Claude key. */
export function fallbackCopy({ company, brand }) {
  const city = company.city ?? brand?.address?.city;
  const trade = company.industry ? company.industry.replace(/\b\w/g, (ch) => ch.toUpperCase()) : 'Local service';
  const services = (brand?.services ?? []).slice(0, 6).map((name) => ({ name, description: `Ask about ${name.toLowerCase()}: call, or request a quote online.` }));
  return {
    headline: city ? `${trade} in ${city}, done right` : `${trade}, done right`,
    subheadline: brand?.tagline ?? `${company.name}${city ? ` serves ${city} and nearby areas` : ''}. Call or request a quote online.`,
    primary_cta: 'Request a quote',
    services: services.length ? services : [{ name: trade, description: `Get in touch with ${company.name} to talk through what you need.` }],
    highlights: [
      company.rating ? { title: `${company.rating}★ on Google`, text: `Rated ${company.rating} from ${company.reviewCount} Google reviews.` } : { title: 'Easy to reach', text: 'Call, or send a request online any time of day.' },
      { title: 'Fast on any phone', text: 'Every page loads quickly and every number is tap-to-call.' },
      { title: 'Clear next steps', text: 'Request a quote in under a minute, from any page.' },
    ],
    about: `${company.name}${city ? ` is based in ${city}` : ''}. This concept shows how the website could make it easier for customers to find you, trust you, and get in touch.`,
  };
}
