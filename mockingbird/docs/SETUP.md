# Setup

Everything is optional except Node 20.12+. Turn things on in this order and run `npm run mb -- doctor` after each step to see what's live.

## 1. Install

```bash
cd mockingbird
npm install
npm run mb -- init     # creates .env from .env.example
npm link               # optional: lets you type `mb` instead of `npm run mb --`
```

## 2. Fill in `mockingbird.config.js`

Search the file for `TODO`. At minimum:

- `business.siteUrl` and `business.email`: your real domain and public contact address.
- `business.postalAddress`: **required before any cold email goes out** (CAN-SPAM). A PO box or a registered mailbox address is fine.
- `sender.lastName`: emails come from a real, named person.
- `business.city` / `region`: used for local SEO and the site footer.
- `business.calendarUrl`: a Cal.com or Calendly link for intro calls.
- `icps.*`: narrow `organization_locations` and the Places `cities` to the markets you want.
- `proof`: add real client work as you deliver it. The outreach writer only ever cites what's listed here.

## 3. Claude (outreach, demo copy, blog)

1. Create an API key at https://platform.claude.com/settings/keys.
2. Put it in `.env` as `ANTHROPIC_API_KEY`.

The default model is `claude-opus-5-5`. Set `MB_MODEL` in `.env` to use a different one. Without a key, `mb pitch` and `mb demo` fall back to templates, and `mb blog` won't run.

## 4. Apollo (B2B leads)

1. In Apollo: Settings → Integrations → API → create a key.
2. Enable these endpoints for the key, or make it a master key:
   - `mixed_companies/search`: company search, 1 credit per page of up to 100;
   - `mixed_people/api_search`: people search, free, returns no emails;
   - `people/bulk_match`: email reveal, 1 credit per email found.
3. Put it in `.env` as `APOLLO_API_KEY`.

Check which endpoints your plan includes. A 403 error from `mb` means the key isn't allowed to call that endpoint.

## 5. Google (local leads + PageSpeed)

1. In Google Cloud Console, create a project and enable **Places API (New)** and **PageSpeed Insights API**.
2. Create one API key per API under Credentials. Restrict each key to its API.
3. Set `GOOGLE_PLACES_API_KEY` and `PAGESPEED_API_KEY` in `.env`.

Places Text Search is billed per request, so set a budget alert in Cloud Billing. PageSpeed is free, and a key just raises the rate limit.

## 6. Sending cold email (do this a few weeks before your first campaign)

Cold email lives or dies on deliverability. The system writes and checks the copy; a cold-email platform does the sending.

1. **Buy a separate sending domain** that looks like yours, e.g. `trymockingbird.com` or `mockingbirdstudio.com`. Never send cold email from your main domain: if it gets flagged, your everyday email and your website's reputation go with it.
2. **Create 2-3 mailboxes** on that domain with Google Workspace or Microsoft 365, under real names (e.g. `baylor@trymockingbird.com`).
3. **Set up DNS** for the sending domain:
   - SPF: the record your mail provider gives you;
   - DKIM: turn it on in Workspace/365 admin;
   - DMARC: start with `v=DMARC1; p=none; rua=mailto:you@yourdomain.com`;
   - redirect the sending domain's website to your main site.
4. **Connect the mailboxes to Instantly or Smartlead** and turn on warmup. Give it 2-3 weeks before sending real campaigns.
5. **Create a campaign:**
   - step 1 subject: `{{subject}}`;
   - step bodies: `{{email_1}}`, `{{email_2}}`, `{{email_3}}`;
   - steps 2 and 3 reply in the same thread;
   - delays of 3 and 4 days (matching `outreach.sequence` in the config);
   - open tracking and link tracking **off**.
6. **Keep volume low:** about 30 new emails per mailbox per day, ramping up only while bounce and spam rates stay low.
7. Either upload `mb export --format instantly`, or set `INSTANTLY_API_KEY` (or `SMARTLEAD_API_KEY`) and run `mb push instantly --campaign <id>`.

If your sending tool's editor flattens line breaks, export with `--br`. `mb push` sends `<br>` line breaks by default.

## 7. Cloudflare (the website)

The site deploys as a Cloudflare Worker: static files, plus a small API for the contact and free-audit forms, plus a D1 database for submissions.

1. Create a Cloudflare account, add your domain, and point its nameservers at Cloudflare.
2. Create the database and paste its id into `site/wrangler.jsonc` (`database_id`):
   ```bash
   cd mockingbird/site
   npx wrangler@4 login
   npx wrangler@4 d1 create mockingbird
   ```
3. Create the tables, then deploy:
   ```bash
   npx wrangler@4 d1 migrations apply mockingbird --remote
   npx wrangler@4 deploy        # or `npm run mb -- site deploy` from mockingbird/
   ```
4. In Workers & Pages → mockingbird-site → Settings → Domains & Routes, add your domain.
5. **Spam protection (optional):**
   - create a Turnstile widget;
   - put the site key in `site.turnstileSiteKey` in the config;
   - set the secret: `npx wrangler@4 secret put TURNSTILE_SECRET_KEY`.
6. **Email notifications for new inquiries (optional):**
   - in Email Routing, add and verify the address that should receive notifications;
   - uncomment the `send_email` block in `site/wrangler.jsonc` with that address;
   - set `NOTIFY_TO` (that address) and `NOTIFY_FROM` (an address on your Cloudflare domain);
   - redeploy.

   Every submission is saved in D1 even without notifications. To read them: `npx wrangler@4 d1 execute mockingbird --remote --command "SELECT * FROM inbound_leads ORDER BY created_at DESC LIMIT 20"`.
7. **Analytics (optional):** turn on Cloudflare Web Analytics and put its token in `site.analyticsToken`.

### Deploy from GitHub instead

Add these repository secrets (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN`: create it with the "Edit Cloudflare Workers" template, plus D1 Edit;
- `CLOUDFLARE_ACCOUNT_ID`.

The `Mockingbird site` workflow then tests, migrates, and deploys on every push to `main` that touches `mockingbird/`. Until the secrets and `database_id` are set, the deploy step skips with a notice.

## 8. Weekly blog posts

1. Add an `ANTHROPIC_API_KEY` repository secret.
2. Turn on **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests**.

Every Monday the `Mockingbird weekly blog post` workflow writes the next planned topic and opens a pull request. Merging it publishes the post through the site workflow. Run it by hand from the Actions tab any time, and give it a topic id if you want a specific one.

Pull requests opened by the workflow don't trigger other workflows (a GitHub rule). Push any commit to the branch, or close and reopen the PR, if you want CI to run on it.

## 9. Demo sites

1. Build concept pages: `mb demo` (they're written to `data/demos/`, outside git).
2. Deploy them as their own Worker: `mb demo --deploy` (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in `.env`).
3. Give that Worker a custom domain like `demo.yourdomain.com`.
4. Set `site.demoBaseUrl` to that URL.
5. Re-run `mb pitch --id <id>` for leads whose emails should link their concept.

Demo pages are noindexed and every page says it's a concept, not the business's official site.
