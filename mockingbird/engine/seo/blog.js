import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { parseFrontmatter } from '../../site/lib/frontmatter.js';
import { ROOT } from '../lib/env.js';
import { nowIso, slugify, wordCount } from '../lib/util.js';

// The SEO blog: a topic queue (content/topics.json, committed) and posts as
// markdown (content/blog/*.md) that the website build renders. Claude plans
// topics against the services and audiences in the config, then writes one
// post at a time. A weekly GitHub Action runs `mb blog write --publish` and
// opens a pull request, so a human reads every post before it goes live.

export const TOPICS_FILE = path.join(ROOT, 'content', 'topics.json');
export const POSTS_DIR = path.join(ROOT, 'content', 'blog');
const SERVICE_KEYS = ['websites', 'automation', 'apps'];

export async function loadTopics(file = TOPICS_FILE) {
  if (!existsSync(file)) return { topics: [] };
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function saveTopics(data, file = TOPICS_FILE) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

/** Existing posts as { slug, title, service, draft }, read with the site's own frontmatter parser. */
export async function existingPosts(dir = POSTS_DIR) {
  if (!existsSync(dir)) return [];
  const posts = [];
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.md'))) {
    let data = {};
    try {
      ({ data } = parseFrontmatter(await readFile(path.join(dir, file), 'utf8')));
    } catch {
      // A post with broken frontmatter still counts as taken; the site build reports the error.
    }
    posts.push({ slug: data.slug ?? file.replace(/\.md$/, ''), title: data.title ?? file, service: data.service ?? null, draft: data.draft === true });
  }
  return posts;
}

// --- frontmatter ----------------------------------------------------------

const yamlString = (s) => JSON.stringify(String(s));
const yamlTag = (t) => slugify(t, 40).replace(/-/g, ' ');

export function toMarkdownFile(meta, body) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) lines.push(`${key}: [${value.map(yamlTag).filter(Boolean).join(', ')}]`);
    else if (typeof value === 'boolean' || typeof value === 'number') lines.push(`${key}: ${value}`);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) lines.push(`${key}: ${value}`);
    else lines.push(`${key}: ${yamlString(value)}`);
  }
  lines.push('---', '', body.trim(), '');
  return lines.join('\n');
}

// --- planning ---------------------------------------------------------------

export const PlanSchema = z.object({
  topics: z.array(
    z.object({
      title: z.string().describe('Working title, written the way a searcher would phrase the question.'),
      keyword: z.string().describe('Primary search phrase, lowercase.'),
      secondary_keywords: z.array(z.string()),
      intent: z.enum(['informational', 'commercial', 'comparison', 'local']),
      service: z.enum(SERVICE_KEYS),
      audience: z.string(),
      angle: z.string().describe('What makes this post more useful than what already ranks.'),
      outline: z.array(z.string()).describe('5-8 H2 section headings.'),
    }),
  ),
});

function servicesBlock(config) {
  return SERVICE_KEYS.map((key) => {
    const s = config.services[key];
    return `- ${key} (${s.label}, page /${s.slug}/): ${s.summary}`;
  }).join('\n');
}

export function planSystem(config) {
  const b = config.business;
  return `You plan an SEO blog for ${b.name}, a small software studio${b.city ? ` in ${b.city}, ${b.region}` : ''}. The blog exists to bring in owners and operators who might hire the studio, by answering the questions they type into Google and AI search before they buy.

What the studio sells:
${servicesBlock(config)}

Audiences: ${config.seo.audiences.join('; ')}.
Regions for local topics: ${(config.seo.regions ?? []).join('; ') || 'none'}.

Plan topics that:
- Match real buyer questions (cost, timelines, comparisons, "do I need X", how-to, what to look for in a vendor, industry-specific use cases). Mix commercial-intent topics with a few broader informational ones.
- Are specific to an audience or industry where possible ("AI receptionist for dental offices" beats "AI for business").
- Could only be written well by a team that builds this software. Each angle should promise something concrete: a checklist, a cost breakdown, a decision framework, real tradeoffs.
- Don't duplicate or closely overlap the existing titles you're given.
- Keep keywords natural and lowercase.`;
}

export async function planTopics({ config, claude, count = 8, service, topicsFile = TOPICS_FILE, postsDir = POSTS_DIR }) {
  const data = await loadTopics(topicsFile);
  const posts = await existingPosts(postsDir);
  const existing = [...data.topics.map((t) => t.title), ...posts.map((p) => p.title)];
  const prompt = [
    `Plan ${count} new blog topics${service ? `, all for the ${service} service` : ', spread across the three services'}.`,
    existing.length ? `\nExisting titles (don't overlap):\n${existing.map((t) => `- ${t}`).join('\n')}` : '',
  ].join('\n');
  const { data: plan } = await claude.json({ system: planSystem(config), prompt, schema: PlanSchema, effort: config.ai.effort?.blogPlan ?? 'medium' });
  const nextId = data.topics.reduce((max, t) => Math.max(max, Number(String(t.id).replace(/\D/g, '')) || 0), 0) + 1;
  const added = plan.topics.slice(0, count).map((t, i) => ({
    id: `t${String(nextId + i).padStart(3, '0')}`,
    title: t.title,
    keyword: t.keyword,
    secondary: t.secondary_keywords,
    intent: t.intent,
    service: t.service,
    audience: t.audience,
    angle: t.angle,
    outline: t.outline,
    status: 'planned',
    createdAt: nowIso(),
  }));
  data.topics.push(...added);
  await saveTopics(data, topicsFile);
  return added;
}

// --- writing ----------------------------------------------------------------

export const PostSchema = z.object({
  title: z.string().describe('Final title, under 65 characters, includes the primary keyword naturally.'),
  description: z.string().describe('Meta description, 140-155 characters.'),
  slug: z.string().describe('URL slug: lowercase words separated by hyphens.'),
  tags: z.array(z.string()).describe('2-4 short lowercase tags.'),
  body_markdown: z.string().describe('The full post body in Markdown, without the title.'),
});

export function writeSystem(config) {
  const b = config.business;
  const proof = (config.proof ?? []).map((p) => `- ${p.name} (${p.service}): ${p.summary}`).join('\n') || '- none yet';
  return `You write blog posts for ${b.name}, a small software studio${b.city ? ` in ${b.city}, ${b.region}` : ''} that builds websites, AI automations, and apps. Posts are read by business owners and operators deciding whether and how to buy this kind of work.

Voice: ${config.seo.voice}

Rules:
- Be genuinely useful: concrete steps, tradeoffs, checklists, examples, and the questions a buyer should ask. Write from the perspective of people who build this.
- No fabricated facts. Don't invent statistics, studies, quotes, client stories, or prices. When a number helps, give a clearly-labeled typical range with the factors that move it, or explain how to estimate it instead. Never attribute numbers to sources you can't name.
- Mention the studio's own work only from this list, accurately:
${proof}
- Open with the answer or the core idea in the first two sentences. No throat-clearing intros ("In today's digital world...").
- Use the primary keyword naturally in the first 100 words and in at least one H2. Never stuff keywords.
- Structure: short intro, 5-8 H2 sections (## ), H3s (### ) where useful, short paragraphs, bullet lists where they genuinely help, at least one table or checklist if it fits.
- End the body with a section "## Frequently asked questions" containing 3-5 questions as ### headings, each answered in 2-4 sentences.
- Just before the FAQ, add a short closing section that points readers to the relevant service page and the contact page using the exact Markdown links provided. One or two sentences, helpful rather than salesy.
- Link to 1-3 of the related posts provided where they fit naturally, using their exact URLs. Don't link to anything else on our site, and don't add external links.
- Don't include the post title as a heading; the page renders it.
- No hype words (leverage, cutting-edge, seamless, game-changer, revolutionize, unlock, elevate, supercharge).`;
}

export function writePrompt({ topic, config, posts }) {
  const service = config.services[topic.service] ?? config.services.websites;
  const related = posts.filter((p) => !p.draft).slice(0, 15).map((p) => `- [${p.title}](/blog/${p.slug}/)`).join('\n');
  return [
    `Write a post of about ${config.seo.minWords}-${config.seo.minWords + 600} words.`,
    '',
    `Working title: ${topic.title}`,
    `Primary keyword: ${topic.keyword}`,
    topic.secondary?.length ? `Secondary keywords: ${topic.secondary.join(', ')}` : null,
    `Search intent: ${topic.intent}`,
    `Audience: ${topic.audience}`,
    `Angle: ${topic.angle}`,
    topic.outline?.length ? `Suggested outline (improve it if you can):\n${topic.outline.map((h) => `- ${h}`).join('\n')}` : null,
    '',
    `Relevant service: ${service.label}. ${service.summary}`,
    `Service page link: [${service.label}](/${service.slug}/)`,
    `Contact link: [talk to us](/contact/)`,
    `Free first step we offer: ${service.offer}`,
    '',
    related ? `Related posts you may link to:\n${related}` : 'No related posts yet.',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function checkPost(post, { minWords }) {
  const problems = [];
  const words = wordCount(post.body_markdown);
  if (words < minWords * 0.75) problems.push(`only ${words} words`);
  if (/^#\s/m.test(post.body_markdown)) problems.push('body contains an H1');
  if (!/^##\s+Frequently asked questions/im.test(post.body_markdown)) problems.push('missing the FAQ section');
  if (post.description.length > 170) problems.push('meta description over 170 characters');
  return { words, problems };
}

export async function writePost({ config, claude, topicId, publish = false, today = nowIso().slice(0, 10), topicsFile = TOPICS_FILE, postsDir = POSTS_DIR }) {
  const data = await loadTopics(topicsFile);
  const topic = topicId ? data.topics.find((t) => t.id === topicId) : data.topics.find((t) => t.status === 'planned');
  if (!topic) throw new Error(topicId ? `No topic "${topicId}" in content/topics.json` : 'No planned topics left. Run `mb blog plan` first.');
  const posts = await existingPosts(postsDir);

  const { data: post } = await claude.json({
    system: writeSystem(config),
    prompt: writePrompt({ topic, config, posts }),
    schema: PostSchema,
    effort: config.ai.effort?.blogWrite ?? 'high',
    maxTokens: 64000,
  });
  const { words, problems } = checkPost(post, { minWords: config.seo.minWords });

  let slug = slugify(post.slug || post.title, 70);
  for (let n = 2; existsSync(path.join(postsDir, `${slug}.md`)); n++) slug = `${slugify(post.slug || post.title, 66)}-${n}`;
  const file = path.join(postsDir, `${slug}.md`);
  await mkdir(postsDir, { recursive: true });
  await writeFile(
    file,
    toMarkdownFile(
      { title: post.title, description: post.description, date: today, slug, service: topic.service, keyword: topic.keyword, tags: post.tags.slice(0, 4), draft: !publish || problems.length > 0 },
      post.body_markdown,
    ),
  );
  topic.status = publish && !problems.length ? 'published' : 'drafted';
  topic.slug = slug;
  topic.writtenAt = nowIso();
  await saveTopics(data, topicsFile);
  return { topic, file, slug, words, problems };
}
