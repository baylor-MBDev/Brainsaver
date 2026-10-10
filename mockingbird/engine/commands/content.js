import { spawn } from 'node:child_process';
import path from 'node:path';
import { buildDemo, writeDemoRootFiles } from '../demo/build.js';
import { createClaude, hasClaude } from '../lib/claude.js';
import { ROOT, dataDir, env } from '../lib/env.js';
import { c, log, table, displayPath } from '../lib/log.js';
import { addEvent } from '../lib/store.js';
import { mapPool } from '../lib/util.js';
import { loadTopics, planTopics, writePost } from '../seo/blog.js';

const intOpt = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

function runQuiet(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`))));
  });
}

// --- mb demo -----------------------------------------------------------------

export const demoDir = () => path.join(dataDir(), 'demos');

export async function demo({ config, store }, args) {
  const ids = args.values.id ? [].concat(args.values.id) : null;
  const all = await store.list();
  const eligible = (co) => co.primaryService === 'websites' && ['qualified', 'enriched', 'pitched', 'approved'].includes(co.stage);
  const targets = ids ? all.filter((co) => ids.includes(co.id)) : all.filter((co) => eligible(co) && !co.demo);
  const outDir = demoDir();
  await writeDemoRootFiles(outDir);

  if (targets.length) {
    const claude = !args.values['no-ai'] && hasClaude() ? createClaude({ model: config.ai.model }) : null;
    const batch = targets.slice(0, intOpt(args.values.limit, 10));
    log.step(`Building ${batch.length} concept homepages${claude ? ` (copy by ${config.ai.model})` : ' (template copy)'}`);
    await mapPool(batch, 2, async (company) => {
      try {
        const result = await buildDemo(company, { config, claude, outDir });
        await store.update(company.id, (co) => {
          co.demo = { slug: result.slug, url: result.url, source: result.source, at: result.at };
          addEvent(co, 'demo:built', result.url ?? result.slug);
          return co;
        });
        log.info(`  ${c.green('built')}  ${company.name}  ${c.dim(result.url ?? displayPath(result.file))}`);
      } catch (err) {
        log.error(`${company.id}: ${err.message}`);
      }
    });
    if (!config.site?.demoBaseUrl) log.warn('site.demoBaseUrl is empty in mockingbird.config.js, so demos have no public URL yet (the pitch won\'t link them).');
    log.info(c.dim(`Preview locally: open ${displayPath(outDir)}/<slug>/index.html`));
  } else {
    log.info('No website leads need a concept page. (Demos are built for qualified website leads.)');
  }

  if (args.values.deploy) {
    if (!env('CLOUDFLARE_API_TOKEN')) throw new Error('CLOUDFLARE_API_TOKEN is not set (see .env.example).');
    log.step('Deploying demos to Cloudflare (Worker "mockingbird-demos", static assets only)');
    await runQuiet('npx', ['--yes', 'wrangler@4', 'deploy', '--assets', outDir, '--name', 'mockingbird-demos', '--compatibility-date', '2026-10-01'], { cwd: ROOT });
    log.ok('Demos deployed. Point site.demoBaseUrl at the Worker URL or a custom domain, then re-run `mb pitch --id <id>` for leads that should link them.');
  }
}

// --- mb blog -----------------------------------------------------------------

export async function blog({ config }, args) {
  const [action = 'list'] = args.positionals;
  if (action === 'list') {
    const { topics } = await loadTopics();
    if (!topics.length) return log.info('No topics yet. Run `mb blog plan`.');
    log.info(
      table(topics, [
        { label: 'ID', get: (t) => t.id },
        { label: 'STATUS', get: (t) => t.status },
        { label: 'SERVICE', get: (t) => t.service },
        { label: 'TITLE', get: (t) => t.title, max: 70 },
      ]),
    );
    return;
  }
  if (!hasClaude()) throw new Error('`mb blog plan|write` needs ANTHROPIC_API_KEY in mockingbird/.env.');
  const claude = createClaude({ model: config.ai.model });

  if (action === 'plan') {
    const added = await planTopics({ config, claude, count: intOpt(args.values.count, 8), service: args.values.service });
    log.ok(`Added ${added.length} topics to content/topics.json:`);
    for (const t of added) log.info(`  ${c.dim(t.id)}  ${t.title}  ${c.dim(`[${t.service}]`)}`);
    return;
  }
  if (action === 'write') {
    const result = await writePost({ config, claude, topicId: args.values.topic, publish: Boolean(args.values.publish) });
    log.ok(`${result.words} words → ${displayPath(result.file)} (${result.topic.status})`);
    for (const p of result.problems) log.warn(`Left as a draft: ${p}`);
    log.info(c.dim('Preview it with `mb site dev --drafts`.'));
    return;
  }
  throw new Error('Usage: mb blog <plan|write|list> [--count 8] [--service apps] [--topic t001] [--publish]');
}

// --- mb site -----------------------------------------------------------------

export async function site({ config }, args) {
  const [action = 'build'] = args.positionals;
  if (action === 'build') {
    const { buildSite } = await import('../../site/build.js');
    const result = await buildSite({ config, includeDrafts: Boolean(args.values.drafts) });
    log.ok(`Built ${result.pages.length} pages and ${result.posts.length} posts into site/dist`);
    return;
  }
  if (action === 'dev') {
    const extra = [args.values.port ? ['--port', args.values.port] : [], args.values.drafts ? ['--drafts'] : []].flat();
    await runQuiet(process.execPath, [path.join(ROOT, 'site', 'dev.js'), ...extra], { cwd: ROOT });
    return;
  }
  if (action === 'deploy') {
    if (!env('CLOUDFLARE_API_TOKEN')) throw new Error('CLOUDFLARE_API_TOKEN is not set (see .env.example).');
    const { buildSite } = await import('../../site/build.js');
    await buildSite({ config });
    await runQuiet('npx', ['--yes', 'wrangler@4', 'deploy'], { cwd: path.join(ROOT, 'site') });
    return;
  }
  throw new Error('Usage: mb site <build|dev|deploy> [--drafts] [--port 8788]');
}

// --- mb dashboard --------------------------------------------------------------

export async function dashboard({ config, store }, args) {
  const { startDashboard } = await import('../dashboard/server.js');
  const { url } = await startDashboard({ store, config, port: intOpt(args.values.port, 4400) });
  log.ok(`Dashboard running at ${c.bold(url)}  ${c.dim('(Ctrl+C to stop)')}`);
}
