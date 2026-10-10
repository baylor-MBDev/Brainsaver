import { copyFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { sendingBlockers } from '../lib/config.js';
import { ROOT, dataDir, env } from '../lib/env.js';
import { c, log } from '../lib/log.js';

const KEYS = [
  ['ANTHROPIC_API_KEY', 'Claude writes outreach, demo copy, and blog posts', 'templates are used instead of AI copy'],
  ['APOLLO_API_KEY', 'company search + email reveals', 'use Google Places or CSV import for leads'],
  ['GOOGLE_PLACES_API_KEY', 'local business search', 'use Apollo or CSV import for leads'],
  ['PAGESPEED_API_KEY', 'Google PageSpeed scores in audits', 'PageSpeed runs unauthenticated (rate limited)'],
  ['INSTANTLY_API_KEY', '`mb push instantly`', 'export CSV and upload it instead'],
  ['SMARTLEAD_API_KEY', '`mb push smartlead`', 'export CSV and upload it instead'],
  ['CLOUDFLARE_API_TOKEN', 'deploying the site and demo sites', 'deploy from the Cloudflare dashboard or CI'],
  ['CLOUDFLARE_ACCOUNT_ID', 'deploying the site and demo sites', ''],
];

export async function init() {
  const target = path.join(ROOT, '.env');
  if (existsSync(target)) {
    log.info('.env already exists; leaving it alone.');
  } else {
    await copyFile(path.join(ROOT, '.env.example'), target);
    log.ok('Created mockingbird/.env from .env.example. Add your API keys there.');
  }
  log.info(`Then fill in the TODOs in ${c.bold('mockingbird.config.js')} and run ${c.cyan('mb doctor')}.`);
}

export async function doctor({ config, store }) {
  log.info(c.bold('Integrations'));
  for (const [key, what, fallback] of KEYS) {
    const set = Boolean(env(key));
    log.info(`  ${set ? c.green('●') : c.dim('○')} ${key.padEnd(22)} ${set ? what : c.dim(fallback ? `not set: ${fallback}` : 'not set')}`);
  }

  log.info(c.bold('\nConfig'));
  const source = await readFile(path.join(ROOT, 'mockingbird.config.js'), 'utf8');
  const todos = source.split('\n').filter((line) => /TODO/.test(line) && !/^\s*\/\/ Fields marked/.test(line));
  log.info(`  ${todos.length ? c.yellow(`${todos.length} TODOs left`) : c.green('no TODOs left')} in mockingbird.config.js`);
  for (const line of todos.slice(0, 12)) log.info(c.dim(`    ${line.trim().slice(0, 110)}`));

  const blockers = sendingBlockers(config);
  log.info(c.bold('\nReady to send cold email?'));
  if (blockers.length) for (const b of blockers) log.info(`  ${c.red('✗')} ${b}`);
  else log.info(`  ${c.green('✓')} sender identity and postal address are set`);
  log.info(c.dim('  Also required, outside this tool: a separate sending domain with SPF, DKIM and DMARC, and warmed-up inboxes in your sending tool (docs/SETUP.md).'));

  const leads = await store.list();
  log.info(c.bold('\nData'));
  log.info(`  ${leads.length} leads in ${path.relative(process.cwd(), dataDir()) || dataDir()}  ${c.dim('(never committed: data/ is gitignored)')}`);
  log.info(`  AI model: ${config.ai.model}`);
}
