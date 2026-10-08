-- Run once in Supabase > SQL Editor. Safe to run again.
-- ── 68. SaaS: license/support status, branding, invoices, payouts ───────
-- license_status: unpaid | paid | flex_active | past_due | suspended
-- support_status: none | active | past_due | cancelled
-- Customer branding + payouts are paid-only features (checked on the server).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS branding            JSONB;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS license_status      TEXT DEFAULT 'unpaid';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS support_status      TEXT DEFAULT 'none';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS support_started_at  TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS flex_status         TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS flex_total          NUMERIC;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS flex_paid           NUMERIC;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_notes       TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id  TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_account_id   TEXT;  -- the customer's OWN Stripe account (payouts)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS payout_status       TEXT DEFAULT 'not_connected';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_email         TEXT;

CREATE TABLE IF NOT EXISTS public.license_invoices (
  id            BIGSERIAL PRIMARY KEY,
  org_id        TEXT,
  email         TEXT,
  company       TEXT,
  kind          TEXT NOT NULL,          -- license | flex_down | flex_installment | support | other
  description   TEXT,
  amount        NUMERIC NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'open',   -- open | paid | failed | void
  provider      TEXT DEFAULT 'stripe',  -- stripe | square | manual
  provider_ref  TEXT,
  due_date      DATE,
  paid_at       TIMESTAMPTZ,
  meta          JSONB,                  -- e.g. {"flex_total":19995,"tier":"fleet"}
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.license_invoices ADD COLUMN IF NOT EXISTS meta JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS license_invoices_ref_idx ON public.license_invoices (provider, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS license_invoices_org_idx   ON public.license_invoices (org_id);
CREATE INDEX IF NOT EXISTS license_invoices_email_idx ON public.license_invoices (lower(email));
-- Service-role only: RLS on, deliberately NO anon policy.
ALTER TABLE public.license_invoices ENABLE ROW LEVEL SECURITY;

-- Existing paying customers: mark the companies you already sold as paid
-- (edit the slug list, or just use the Licenses tab in Admin afterwards).
-- UPDATE organizations SET license_status='paid' WHERE slug IN ('your-slug-here');

SELECT 'SaaS billing/branding columns + license_invoices ready' AS status;
