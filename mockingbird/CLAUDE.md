# Mockingbird growth system

Node 20+ ESM, no build step. Three dependencies: `@anthropic-ai/sdk`, `zod`, `marked`. Everything else is hand-written on Node built-ins.

## Rules

- **Never commit lead data.** `data/`, `exports/`, and `.env` are gitignored, and this repository is public. Don't move lead data anywhere tracked, and don't paste real prospect details into tests, fixtures, docs, or commit messages.
- **The outreach writer must not invent facts.** Prompts in `engine/outreach/prompt.js`, `engine/demo/copy.js`, and `engine/seo/blog.js` forbid invented clients, stats, prices, and guarantees. Keep those rules when editing them, and only cite `proof` from `mockingbird.config.js`.
- **Every write to a lead goes through `engine/lib/actions.js` or `engine/lib/store.js`** (`setStage`, `addEvent`) so history and the do-not-contact list stay consistent. The CLI and the dashboard share the actions.
- **Cold email is never sent from this code.** It exports to or pushes into a cold-email platform (Instantly or Smartlead). Don't add SMTP or transactional-email sending for outreach.
- **Claude calls go through `engine/lib/claude.js`**: structured outputs via zod, adaptive thinking, and an explicit effort level. The default model comes from `mockingbird.config.js` (`ai.model`), overridable with `MB_MODEL`.

## Commands

- `npm test`: all suites, offline (network is faked via `test/helpers.js` `fakeFetch`).
- `npm run mb -- <command>`: the CLI. `npm run mb -- --help` lists commands.
- `npm run site:dev`: preview the website.

## Layout

- `engine/sources/`: lead sources.
- `engine/audit/`: site analysis. `signals.js` is pure HTML → signals; `score.js` turns signals into scored findings.
- `engine/outreach/`: copy and export.
- `engine/commands/`: CLI command implementations.
- `site/`: the Mockingbird website and its Cloudflare Worker.
- `content/`: blog topics and posts.

When adding an audit check, add the signal in `signals.js` (or a fingerprint in `fingerprints.js`), the finding in `score.js` with a `point` sentence a prospect can verify, a fix in `audit/report.js`, and a fixture-based test in `test/audit.test.js`.
