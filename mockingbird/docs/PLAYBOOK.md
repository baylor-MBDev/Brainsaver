# Outreach playbook

How to run the system week to week, what to say when people reply, and the rules that keep your domain and your business out of trouble.

## The offer ladder

Every cold email asks for one small, free step, and each service has its own (edit them in `mockingbird.config.js` → `services.*.offer`):

| Service | Free first step | Paid next step | Ongoing |
| --- | --- | --- | --- |
| Websites | A concept homepage built from their current site (`mb demo`) | Fixed-scope site build | Hosting + care plan, SEO content |
| AI automations | A 20-minute audit of where calls, leads, and admin time go | A pilot on one workflow (e.g. after-hours calls) | Monitoring and new automations |
| Apps | A scoping call that ends with a one-page plan | MVP build | Releases, support, iteration |

The free step is a real deliverable, not a disguised sales call. It's what earns the reply.

## Weekly rhythm

| When | What | Time |
| --- | --- | --- |
| Monday | `mb run --icp <id> --limit 100` for one or two ICPs, then `mb demo` for website leads | 15 min (mostly waiting) |
| Tuesday | Review in `mb dashboard`: check each finding against the live site, tighten the copy, approve or skip | 30-45 min |
| Wednesday | `mb push instantly --campaign <id>` (or export and upload) | 5 min |
| Daily | Answer replies within a business hour; `mb mark <id> replied` or `meeting` | as needed |
| Friday | Export campaign results from the sending tool, `mb sync results.csv`, then `mb report` | 10 min |
| Weekly | Review and merge the blog post pull request | 15 min |

Start with one ICP per service line. After a few hundred sends, `mb report` will show which service, ICP, and finding types get replies. Double down on those and cut the rest.

## Reviewing a pitch (the 60-second check)

1. **Open their site.** Is the lead finding actually true right now? If not, edit it out or skip the lead.
2. **Read email 1 out loud.** Would you send it to a neighbor who runs this business? Cut anything that sounds like marketing.
3. **Check the name and greeting.** A wrong first name is worse than none.
4. **Check the ask.** It should be the configured free step, not a meeting request out of nowhere.
5. **Approve** (`a` in the dashboard) or **skip** (`x`) with a reason. Skip reasons show up in `mb report`, so they teach you which leads to stop sourcing.

## Replying

Speed matters more than polish. Templates to adapt:

**"Sure, send it over."** (website lead, demo built)
> Here it is: [link]. It's built from what's on your current site, so the copy is a starting point. Happy to walk you through it on a quick call if that's easier: [calendar link]

**"How much?"**
> It depends mostly on [number of pages / what it needs to connect to]. Most projects like yours land in a range we can pin down after a 15-minute call. Here's my calendar: [link]. If you'd rather, tell me a bit more and I'll send a ballpark by email.

**"Not right now."**
> Totally fair. Mind if I check back in [a few months]? Either way, the concept is yours to keep.

Then `mb mark <id> lost --note "check back in March"`.

**"Stop emailing me" / unsubscribe**
> Understood, I've removed you. Sorry for the interruption.

Then `mb suppress their@email.com --reason unsubscribed` right away, and make sure the sending tool has them unsubscribed too.

**"Who are you? How did you get my email?"**
Answer plainly: your name, the studio, that you found the business while looking at local [industry] companies, and what you noticed about their site. Offer to remove them.

## Discovery call outline (20 minutes)

1. Their goals in their words: what would make this worth it?
2. How leads and customers come in today, and where they get lost.
3. What they've tried (agencies, builders, software) and what they didn't like.
4. Walk through the concept or the audit findings.
5. Scope, timeline, and budget range. Agree on what goes in a proposal.
6. Next step on the calendar before you hang up.

## Deliverability rules

- Send from a **separate domain** with SPF, DKIM, and DMARC, on mailboxes that have warmed up for 2-3 weeks.
- About **30 new emails per mailbox per day**. Add mailboxes to scale; don't push volume per mailbox.
- **Plain text, no tracking.** Turn open and click tracking off, and keep links out of the first email (the config puts the demo link in email 2).
- **Only send to verified addresses.** Apollo's `verified` status is best. Emails found on websites (`info@`, `office@`) are fine for small local businesses but bounce more. Keep the bounce rate under about 2%.
- **Watch spam complaints.** Google and Yahoo expect bulk senders to keep complaint rates very low (under 0.3%, ideally 0.1%). If replies like "stop" spike, slow down and look at your targeting.
- **One person per company per campaign.** The pipeline already picks one contact per company.

## Compliance checklist

This is general guidance, not legal advice. Talk to a lawyer about your specific situation, especially before emailing outside the US.

**US email (CAN-SPAM):**
- Truthful "From" name, address, and subject line.
- A valid physical postal address in every email. The footer adds `business.postalAddress`, and exports are blocked until it's set.
- A clear way to opt out, honored within 10 business days. Every email ends with the opt-out line, and the sending tool handles unsubscribe links.
- Suppress opt-outs everywhere: `mb suppress` plus the sending tool's blocklist.

**Outside the US:** Canada (CASL), the UK, and the EU (GDPR / PECR) are stricter about consent for commercial email. The preconfigured ICPs target the United States. Change that only after checking the rules for that country.

**Phone (the `calls` export):**
- Dial by hand, with no autodialers or prerecorded messages.
- If a number may be someone's personal cell phone (common for sole proprietors), check the National Do Not Call Registry.
- Never text a prospect who hasn't texted you first or otherwise agreed to it.

**Data:**
- Lead data stays in `data/` (gitignored) or your sending tool.
- When someone asks to be forgotten, delete their file in `data/companies/` and suppress their address.

**Demo sites:**
- Always noindexed, always labeled as a concept, and never presented as the business's real site.
- Take a demo down if the business asks: delete `data/demos/<slug>/` and redeploy.

## Using Claude Code alongside this

This repo is built to be worked on with Claude Code. Useful requests:

- "Run `mb audit --id acme.com` and explain the findings in plain English for a sales call."
- "Turn the concept in `data/demos/<slug>/` into a real multi-page site for this client in a new folder, keeping their brand colors."
- "Add an ICP for property management companies in Dallas to `mockingbird.config.js`."
- "Read the last 50 skipped leads and suggest scoring changes."
- "Write a blog post for topic t005, matching the voice of the existing posts."
