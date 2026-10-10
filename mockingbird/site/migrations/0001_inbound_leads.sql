-- Leads from the website's contact form and free website check-up form,
-- written by site/worker/index.js.
-- Apply from site/: npx wrangler d1 migrations apply mockingbird --remote

CREATE TABLE IF NOT EXISTS inbound_leads (
  id TEXT PRIMARY KEY,                  -- random UUID
  created_at TEXT NOT NULL,             -- ISO 8601, UTC
  type TEXT NOT NULL DEFAULT 'contact', -- contact | audit
  status TEXT NOT NULL DEFAULT 'new',   -- stays 'new' until someone works the lead
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  website TEXT,                         -- required for audit requests
  business_type TEXT,                   -- audit form: "plumbing", "dental practice", ...
  service TEXT,                         -- websites | automation | apps | other
  budget TEXT,
  message TEXT,                         -- required for contact, optional for audit
  page TEXT,                            -- path of the page the form was sent from
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  ip_hash TEXT,                         -- SHA-256 of the (salted) IP; the raw IP is never stored
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_inbound_leads_created_at ON inbound_leads (created_at);
