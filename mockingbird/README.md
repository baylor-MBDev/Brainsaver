# Mockingbird growth system

The machine that finds businesses that need a **website**, an **AI automation**, or an **app**, figures out which one each business needs and why, writes the outreach, builds a free concept site to open the conversation, and runs Mockingbird's own website and SEO blog.

It's modeled on a common agency stack: Apollo for leads, Swokei for website analysis and outreach, Soro for SEO blogging, Claude Code for building websites, and Cloudflare for hosting. Here every piece is code Mockingbird owns, aimed at all three service lines instead of websites alone.

| Job | The usual stack | Here |
| --- | --- | --- |
| Find leads | Apollo | `mb source apollo` (credit-efficient Apollo API), `mb source places` (Google Maps, best for local businesses), `mb import` (any CSV) |
| Analyze each business | Swokei | `mb audit`: 100+ checks per site (mobile, speed via Google PageSpeed, SEO, HTTPS, site builder, chat, booking, app links, analytics…), scored for websites / automation / apps |
| Write outreach | Swokei | `mb pitch`: Claude writes a 3-email sequence from verified findings, with a linter and a legal footer |
| Send campaigns | Swokei | `mb export` / `mb push` into Instantly or Smartlead (warmed inboxes, throttling, unsubscribes), `mb sync` to pull replies back |
| SEO blogging | Soro | `mb blog plan` / `mb blog write`, plus a weekly GitHub Action that opens a pull request with a new post |
| Build websites | Claude Code | `mb demo`: a concept homepage for each website lead. `mb brief` hands a won client to Claude Code with everything it needs |
| Hosting | Cloudflare | `site/`: the Mockingbird website on Cloudflare Workers (static site + contact form API + D1 database). Demos deploy to their own Worker |

## How a lead moves through it

```
source ──► audit ──► qualify ──► enrich ──► pitch (+ demo) ──► review ──► export/push ──► sync ──► report
Apollo     site +    score ≥     decision    Claude writes      you, in    Instantly /    replies,   funnel
Places     PageSpeed threshold   maker +     3 emails from      the        Smartlead      meetings,
CSV        checks    per service email       real findings      dashboard                 unsubscribes
```

Inbound works too. The website's free check-up form and contact form save submissions to Cloudflare D1. `mb inbound` pulls them in, audits each site, and writes a check-up report you can send back personally.

Credits only get spent on leads worth pitching: company search costs 1 Apollo credit per 100 results, the audit is free, and an email is only revealed (1 credit) after a company scores high enough.

Nothing is sent without a person approving it. The dashboard shows each lead's findings next to the drafted emails, and the linter blocks approval on unfilled placeholders, missing names, or copy that's far too long.

## Quick start

```bash
cd mockingbird
npm install
npm run mb -- init          # creates .env from .env.example
# 1. put your API keys in .env (all optional; see docs/SETUP.md)
# 2. fill in the TODOs in mockingbird.config.js (domain, postal address, sender name…)
npm run mb -- doctor        # what's configured, what's missing, ready to send?

npm run mb -- run --icp local-services-websites --limit 25
npm run mb -- dashboard     # review, edit, approve → http://127.0.0.1:4400
npm run mb -- export --format instantly
```

Run `npm link` once to use plain `mb` instead of `npm run mb --`.

No keys at all? It still works end to end: `mb import leads.csv`, then `audit`, `enrich` (emails found on prospects' own sites), and `pitch`, which falls back to templates.

## Commands

| Command | What it does |
| --- | --- |
| `mb run --icp <id>` | source → audit → enrich → pitch in one go (`--source apollo\|places`, `--limit`, `--demo` to build concept sites first) |
| `mb source apollo --icp <id>` | Apollo company search (1 credit per page of 100) (`--limit`, `--page`) |
| `mb source places --icp <id>` | Google Maps businesses from the ICP's queries × cities (`--city`, `--query`, `--limit`) |
| `mb import <file.csv>` | Apollo exports, Maps scrapes, spreadsheets; columns matched loosely (`--icp`, `--service`) |
| `mb audit` | Analyze and score sourced leads (`--limit`, `--no-psi`, `--force`, `--id`) |
| `mb enrich` | Find the decision maker and reveal their email; falls back to emails on their site |
| `mb pitch` | Draft sequences with Claude, or templates (`--no-ai`, `--id`, `--limit`) |
| `mb demo` | Concept homepages for website leads (`--id`, `--limit`, `--deploy`) |
| `mb dashboard` | Local review UI: findings, editable emails, approve/skip, export |
| `mb list` / `mb show <id>` | Leads table / one lead in detail |
| `mb approve <id…>` | Approve from the terminal (`--all` approves every clean pitch, at your own risk) |
| `mb export` | CSV for your sending tool (`--format instantly\|smartlead\|csv\|calls`, `--br`, `--dry-run`) |
| `mb push <instantly\|smartlead>` | Send approved leads into a campaign by API (`--campaign <id>`) |
| `mb sync <file.csv>` | Read a campaign export: replies and meetings advance, bounces and unsubscribes are suppressed |
| `mb mark <id> <stage>` | replied, meeting, won, lost, … (`--note`) |
| `mb suppress <email\|domain>` | Do-not-contact list |
| `mb report` | Funnel, reply and meeting rates, why leads were skipped |
| `mb check <url>` | Audit any site right now and write a plain-English check-up report (`--name`, `--save`) |
| `mb inbound` | Pull contact-form and free-audit requests from the website's D1 database, audit them, write reports |
| `mb brief <id>` | Build brief for a client who said yes: facts, brand, fixes, scope, quality bar, ready for Claude Code |
| `mb blog plan` / `write` / `list` | SEO topic queue and posts (`--count`, `--service`, `--topic`, `--publish`) |
| `mb site build` / `dev` / `deploy` | The Mockingbird website |

## Targeting

Everything about the business lives in **`mockingbird.config.js`**: services and the free first step offered for each, real proof points, ideal customer profiles (ICPs), scoring threshold, and outreach rules.

Five ICPs come preconfigured:

| ICP | Service | Who |
| --- | --- | --- |
| `local-services-websites` | Websites | HVAC, plumbing, roofing, landscaping… owner-run, phone-driven |
| `appointment-practices-automation` | AI automations | Dental, med spa, chiropractic, vet, law practices |
| `ops-heavy-smb-automation` | AI automations | 20-200 person companies with manual back-office work |
| `membership-businesses-apps` | Apps | Gyms, studios, churches, car washes, coffee: weekly repeat customers |
| `startups-apps` | Apps | Early-stage startups shipping an MVP or v2 |

The audit scores every lead for all three services, whatever ICP it came from. A dental office with a fast modern site but no online booking or chat becomes an **automation** lead. A gym running memberships through Mindbody with no app becomes an **apps** lead. A roofer whose site has no mobile layout and a 2016 footer becomes a **websites** lead. Each finding is a sentence the prospect can verify in ten seconds ("the footer still says © 2016"), and the pitch leads with those.

## What it costs to run

- **Apollo:** about 1 credit per 100 companies searched, plus 1 credit per email revealed for qualified leads.
- **Claude** (default `claude-opus-5-5`, override with `MB_MODEL`): roughly a few cents per drafted sequence and per demo, and on the order of tens of cents per blog post. `mb pitch` prints token usage so you can track it.
- **Google:** PageSpeed Insights is free. Places Text Search is billed per request by Google; check current pricing.
- **Cloudflare:** the website fits the free plan. The `send_email` notification binding is free when sending to your own verified address.
- **Sending tool:** an Instantly or Smartlead subscription, plus mailboxes on a separate domain.

## Data, privacy, and compliance

- Lead data lives in `data/` as one JSON file per company. It's **gitignored**, and this repository is public, so keep it that way. To delete someone's data, remove their file and add them with `mb suppress`.
- Exports are blocked until `business.postalAddress` and the sender's full name are set: CAN-SPAM requires a physical address and a working opt-out in every commercial email. Every email gets a footer with both.
- Unsubscribes, bounces, and `mb suppress` entries are checked at audit and export time.
- Cold email goes through a cold-email platform on a **separate domain** with warmed-up inboxes. Never send it through Resend, SendGrid, or Postmark: their policies forbid unsolicited email, and they're for the site's contact-form notifications only.
- Demo sites are noindexed, carry a "concept, not the official site" banner, and deploy outside this repo.

The full sending checklist is in [docs/PLAYBOOK.md](docs/PLAYBOOK.md).

## Layout

```
mockingbird.config.js   the business: services, offers, proof, ICPs, scoring, outreach rules
bin/mb.js               CLI entry
engine/
  sources/              Apollo, Google Places, CSV
  audit/                fetch + HTML signals + tech fingerprints + PageSpeed + scoring
  outreach/             prompts, Claude writer, templates, linter, export, Instantly/Smartlead push
  demo/                 concept homepage generator
  seo/                  blog planning and writing
  dashboard/            local review UI
  lib/                  store (one JSON file per lead), actions, config, Claude client, http
content/                topics.json (blog queue) and blog/*.md posts
site/                   Mockingbird website: generator, templates, Worker (contact API), D1 migrations
test/                   node:test suites (`npm test`)
docs/                   SETUP.md (accounts, keys, DNS, Cloudflare) and PLAYBOOK.md (how to run outreach)
```

## Development

```bash
npm test                 # all suites, no network
npm run site:dev         # preview the website at http://127.0.0.1:8788
MB_DEBUG=1 npm run mb -- audit --id example.com   # stack traces on errors
```

The engine is plain Node 20+ ESM with three dependencies: `@anthropic-ai/sdk`, `zod`, and `marked`.
