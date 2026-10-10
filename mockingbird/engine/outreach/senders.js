import { emailRow } from './export.js';
import { requestJson } from '../lib/http.js';

// Push approved leads straight into a campaign in the sending tool, as an
// alternative to CSV upload. In the campaign, set each step's body to
// {{email_1}}, {{email_2}}, {{email_3}} and the first step's subject to
// {{subject}}; follow-up steps reply in the same thread.

const CUSTOM_FIELDS = ['subject', 'email_1', 'email_2', 'email_3', 'service', 'score', 'demo_url', 'lead_id', 'location'];

function customVariables(row) {
  // Instantly only accepts flat string/number/boolean/null values.
  return Object.fromEntries(CUSTOM_FIELDS.filter((k) => row[k] !== undefined && row[k] !== '').map((k) => [k, typeof row[k] === 'number' ? row[k] : String(row[k])]));
}

/** Instantly API v2: up to 1,000 leads per call. */
export async function pushToInstantly(companies, { apiKey, campaignId, config, html = true, fetch }) {
  if (!apiKey) throw new Error('INSTANTLY_API_KEY is not set.');
  if (!campaignId) throw new Error('Pass --campaign <Instantly campaign id>.');
  const totals = { uploaded: 0, skipped: 0, duplicates: 0, invalid: 0, blocklisted: 0 };
  for (let i = 0; i < companies.length; i += 500) {
    const leads = companies.slice(i, i + 500).map((company) => {
      const row = emailRow(company, config, { html });
      return {
        email: row.email,
        first_name: row.first_name || undefined,
        last_name: row.last_name || undefined,
        company_name: row.company_name,
        website: row.website || undefined,
        phone: row.phone || undefined,
        personalization: row.personalization || undefined,
        custom_variables: customVariables(row),
      };
    });
    const data = await requestJson('https://api.instantly.ai/api/v2/leads/add', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      json: { campaign_id: campaignId, leads, skip_if_in_campaign: true },
      fetch,
    });
    totals.uploaded += data.leads_uploaded ?? data.created_leads?.length ?? 0;
    totals.skipped += data.skipped_count ?? 0;
    totals.duplicates += data.duplicated_leads ?? 0;
    totals.invalid += data.invalid_email_count ?? 0;
    totals.blocklisted += data.in_blocklist ?? 0;
  }
  return totals;
}

/** Smartlead: up to 400 leads per call, API key in the query string. */
export async function pushToSmartlead(companies, { apiKey, campaignId, config, html = true, fetch }) {
  if (!apiKey) throw new Error('SMARTLEAD_API_KEY is not set.');
  if (!campaignId) throw new Error('Pass --campaign <Smartlead campaign id>.');
  const totals = { uploaded: 0, skipped: 0, duplicates: 0, invalid: 0 };
  for (let i = 0; i < companies.length; i += 400) {
    const leadList = companies.slice(i, i + 400).map((company) => {
      const row = emailRow(company, config, { html });
      return {
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        company_name: row.company_name,
        website: row.website,
        phone_number: row.phone,
        location: row.location,
        custom_fields: customVariables(row),
      };
    });
    const url = `https://server.smartlead.ai/api/v1/campaigns/${encodeURIComponent(campaignId)}/leads?api_key=${encodeURIComponent(apiKey)}`;
    const data = await requestJson(url, {
      method: 'POST',
      json: {
        lead_list: leadList,
        settings: { ignore_global_block_list: false, ignore_unsubscribe_list: false, ignore_duplicate_leads_in_other_campaign: false },
      },
      fetch,
    });
    // The documented and observed response shapes differ; accept both.
    totals.uploaded += data.upload_count ?? data.added_count ?? 0;
    totals.skipped += data.skipped_count ?? data.already_added_to_campaign ?? 0;
    totals.duplicates += data.duplicate_count ?? 0;
    totals.invalid += data.invalid_email_count ?? 0;
  }
  return totals;
}
