import { parseArgs } from 'node:util';
import { loadConfig } from './lib/config.js';
import { dataDir, loadEnv } from './lib/env.js';
import { c, log } from './lib/log.js';
import { Store } from './lib/store.js';

const HELP = `${c.bold('mb')}: Mockingbird growth system

${c.bold('Setup')}
  init                         Create .env from .env.example
  doctor                       Check API keys, config TODOs, and send-readiness

${c.bold('Find and qualify leads')}
  run --icp <id>               Everything below in one go: source → audit → enrich → (demo) → pitch [--demo]
  source apollo --icp <id>     Companies from Apollo (1 credit per 100)   [--limit 50 --page 1]
  source places --icp <id>     Local businesses from Google Maps           [--limit 50 --city "Waco, TX" --query "..."]
  import <file.csv>            Leads from any CSV (Apollo export, Maps scrape, spreadsheet) [--icp <id> --service ...]
  audit                        Analyze each site and score websites / automation / apps [--limit 50 --no-psi --force --id <id>]
  enrich                       Find the decision maker and reveal their email (Apollo), else use site emails [--limit 25]

${c.bold('Write and review outreach')}
  pitch                        Draft a 3-email sequence per lead with Claude (or templates) [--limit 25 --no-ai --id <id>]
  demo                         Build concept homepages for website leads   [--id <id> --limit 10 --deploy]
  dashboard                    Review, edit, and approve pitches in the browser [--port 4400]
  list                         Leads table                                 [--stage --service --icp --limit]
  show <id>                    One lead: findings, contact, pitch
  approve <id...> | --all      Approve pitches from the terminal
  brief <id>                   Build brief for a won client, ready for a Claude Code session

${c.bold('Send and track')}
  export                       CSV for your sending tool [--format instantly|smartlead|csv|calls --br --dry-run --out file]
  push <instantly|smartlead>   Send approved leads into a campaign via API [--campaign <id>]
  sync <file.csv>              Pull replies, meetings, bounces, unsubscribes back from a campaign export
  mark <id> <stage>            Move a lead (replied, meeting, won, lost, ...) [--note "..."]
  suppress <email|domain>      Add to the do-not-contact list              [--reason "..."]
  report                       Funnel and reply rates

${c.bold('Inbound')}
  check <url>                  Audit any site now and write a plain-English report [--name "..." --no-psi --save]
  inbound                      Pull contact-form and free-audit requests from the website (Cloudflare D1) [--dry-run]

${c.bold('Content and site')}
  blog plan                    Plan SEO posts with Claude                  [--count 8 --service apps]
  blog write                   Write the next planned post (or --topic <id>) [--publish]
  blog list                    Topic queue and status
  site build | dev | deploy    Build, preview, or deploy the Mockingbird website (Cloudflare)

New here? ${c.cyan('mb init')}, then ${c.cyan('mb doctor')}. The full guide is in README.md and docs/.`;

const OPTIONS = {
  icp: { type: 'string' },
  limit: { type: 'string' },
  page: { type: 'string' },
  city: { type: 'string' },
  query: { type: 'string' },
  source: { type: 'string' },
  service: { type: 'string' },
  stage: { type: 'string' },
  id: { type: 'string', multiple: true },
  concurrency: { type: 'string' },
  force: { type: 'boolean' },
  'no-psi': { type: 'boolean' },
  'no-ai': { type: 'boolean' },
  all: { type: 'boolean' },
  note: { type: 'string' },
  reason: { type: 'string' },
  format: { type: 'string' },
  out: { type: 'string' },
  br: { type: 'boolean' },
  'no-br': { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  campaign: { type: 'string' },
  port: { type: 'string' },
  deploy: { type: 'boolean' },
  count: { type: 'string' },
  topic: { type: 'string' },
  publish: { type: 'boolean' },
  drafts: { type: 'boolean' },
  name: { type: 'string' },
  save: { type: 'boolean' },
  demo: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
};

const lazy = (file, name) => async (...args) => (await import(file))[name](...args);

const COMMANDS = {
  init: { run: lazy('./commands/setup.js', 'init'), needsStore: false },
  doctor: { run: lazy('./commands/setup.js', 'doctor') },
  source: { run: lazy('./commands/pipeline.js', 'source') },
  import: { run: lazy('./commands/pipeline.js', 'importCsv') },
  audit: { run: lazy('./commands/pipeline.js', 'audit') },
  enrich: { run: lazy('./commands/pipeline.js', 'enrich') },
  pitch: { run: lazy('./commands/pipeline.js', 'pitch') },
  run: { run: lazy('./commands/pipeline.js', 'run') },
  list: { run: lazy('./commands/review.js', 'list') },
  show: { run: lazy('./commands/review.js', 'show') },
  approve: { run: lazy('./commands/review.js', 'approveCmd') },
  mark: { run: lazy('./commands/review.js', 'markCmd') },
  suppress: { run: lazy('./commands/review.js', 'suppressCmd') },
  report: { run: lazy('./commands/review.js', 'report') },
  export: { run: lazy('./commands/send.js', 'exportCmd') },
  push: { run: lazy('./commands/send.js', 'push') },
  sync: { run: lazy('./commands/send.js', 'sync') },
  brief: { run: lazy('./commands/brief.js', 'brief') },
  check: { run: lazy('./commands/inbound.js', 'checkCmd') },
  inbound: { run: lazy('./commands/inbound.js', 'inbound') },
  demo: { run: lazy('./commands/content.js', 'demo') },
  blog: { run: lazy('./commands/content.js', 'blog') },
  site: { run: lazy('./commands/content.js', 'site'), needsStore: false },
  dashboard: { run: lazy('./commands/content.js', 'dashboard') },
};

export async function main(argv = process.argv.slice(2)) {
  const [name, ...rest] = argv;
  if (!name || name === 'help' || name === '--help' || name === '-h') {
    log.info(HELP);
    return;
  }
  const command = COMMANDS[name];
  if (!command) {
    log.error(`Unknown command "${name}".`);
    log.info(HELP);
    process.exitCode = 1;
    return;
  }

  let args;
  try {
    args = parseArgs({ args: rest, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (err) {
    log.error(err.message);
    process.exitCode = 1;
    return;
  }
  if (args.values.help) {
    log.info(HELP);
    return;
  }

  loadEnv();
  try {
    const config = await loadConfig();
    const store = command.needsStore === false ? null : await Store.open(dataDir());
    await command.run({ config, store }, args);
  } catch (err) {
    log.error(err.message);
    if (process.env.MB_DEBUG) console.error(err);
    process.exitCode = 1;
  }
}
