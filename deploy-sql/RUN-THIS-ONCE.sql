-- ═══════════════════════════════════════════════════════════════════
-- RUN-THIS-ONCE.sql — everything the new POTENT OS bundle needs, in order.
-- Supabase > SQL Editor > paste ALL > Run. Safe to run more than once.
-- Run it BEFORE you upload the new site. Does not delete any data.
-- If it stops with an error, nothing is changed — send me the error text.
-- ═══════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL OR to_regclass('public.org_users') IS NULL THEN
    RAISE EXCEPTION 'organizations / org_users tables are missing. The company-accounts setup SQL was never run. Tell Claude — nothing was changed.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS org_users_email_idx ON org_users (lower(email));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pricing_config JSONB;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_trucks    INTEGER;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_drivers   INTEGER;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_dispatch  INTEGER;

-- ===== part 68 =====
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

-- ===== part 70 =====
-- SQL 70 — Get Started checklist, trucking profile, send-from email, POTENT-assisted setup.
-- Run BEFORE uploading the new site. Safe to run twice.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS dot_number TEXT,
  ADD COLUMN IF NOT EXISTS mc_number TEXT,
  ADD COLUMN IF NOT EXISTS mail_from_name TEXT,
  ADD COLUMN IF NOT EXISTS mail_reply_to TEXT,
  ADD COLUMN IF NOT EXISTS assist_blocked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS setup_done JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.assist_sessions (
  id BIGSERIAL PRIMARY KEY,
  org_id TEXT NOT NULL,
  staff_uid TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);
ALTER TABLE public.assist_sessions ENABLE ROW LEVEL SECURITY;  -- no policies: only the server can read or write it
REVOKE ALL ON public.assist_sessions FROM anon;

SELECT 'SQL 70 ready' AS status;

-- ===== part 71 =====
-- SQL 71 — saved translations (each phrase is translated once, then reused for everyone).
-- Run BEFORE uploading the new site. Safe to run twice.
CREATE TABLE IF NOT EXISTS public.ui_translations (
  lang TEXT NOT NULL,
  src  TEXT NOT NULL,
  dst  TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (lang, src)
);
ALTER TABLE public.ui_translations ENABLE ROW LEVEL SECURITY;  -- no policies: only the server reads and writes it
REVOKE ALL ON public.ui_translations FROM anon;
SELECT 'SQL 71 ready' AS status;

-- ===== part 72 =====
-- ═══════════════════════════════════════════════════════════════════
-- SQL 72 — job operations: route legs, job clock, scope changes, vendors, disposal
-- Run AFTER 68-71 (RUN-THIS-ONCE.sql already includes this). Safe to run twice.
-- No anon access: the app reaches these only through the company gateway.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.job_route_legs (
  id BIGSERIAL PRIMARY KEY, org_id TEXT, job_id TEXT NOT NULL,
  trip_no INT DEFAULT 1, leg_no INT, purpose TEXT,   -- DEADHEAD | PICKUP | DELIVERY | DISPOSAL | CONTAINER | RETURN_TO_BASE | ...
  origin TEXT, destination TEXT, miles NUMERIC, minutes NUMERIC,
  provider TEXT,                                      -- osrm | estimate
  calculated_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS job_route_legs_job_idx ON public.job_route_legs (org_id, job_id);

CREATE TABLE IF NOT EXISTS public.job_events (        -- add-only audit trail + job clock
  id BIGSERIAL PRIMARY KEY, org_id TEXT, job_id TEXT NOT NULL,
  event TEXT NOT NULL, kind TEXT DEFAULT 'stage',     -- stage | exception
  note TEXT, actor TEXT, actor_role TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS job_events_job_idx ON public.job_events (org_id, job_id, created_at);

CREATE TABLE IF NOT EXISTS public.job_scope_changes (
  id BIGSERIAL PRIMARY KEY, org_id TEXT, job_id TEXT NOT NULL,
  kind TEXT, submitted TEXT, actual TEXT, notes TEXT,
  status TEXT DEFAULT 'pending',                      -- pending | authorized | declined
  old_price NUMERIC, new_price NUMERIC,
  actor TEXT, actor_role TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_by TEXT, decided_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS job_scope_changes_job_idx ON public.job_scope_changes (org_id, job_id);

CREATE TABLE IF NOT EXISTS public.vendors (
  id BIGSERIAL PRIMARY KEY, org_id TEXT, category TEXT,  -- CONTAINERS | OVERFLOW | LABOR | SPECIALTY
  name TEXT NOT NULL, phone TEXT, email TEXT, service_area TEXT, pricing TEXT, capacity TEXT,
  accepted_materials TEXT, prohibited_materials TEXT, availability TEXT, notes TEXT,
  status TEXT DEFAULT 'NEEDS CONFIRMATION', last_verified DATE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS vendors_org_idx ON public.vendors (org_id, category);

CREATE TABLE IF NOT EXISTS public.disposal_facilities (
  id BIGSERIAL PRIMARY KEY, org_id TEXT, name TEXT NOT NULL, address TEXT, phone TEXT, website TEXT,
  materials TEXT, gate_fee TEXT, per_ton TEXT, min_charge TEXT, hours TEXT, restrictions TEXT, service_area TEXT, notes TEXT,
  status TEXT DEFAULT 'NEEDS CONFIRMATION', last_verified DATE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS disposal_facilities_org_idx ON public.disposal_facilities (org_id);

-- Service-role only: RLS on, deliberately NO anon policy.
ALTER TABLE public.job_route_legs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_scope_changes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disposal_facilities ENABLE ROW LEVEL SECURITY;

-- Existing rows (none yet) would belong to POTENT; stamp just in case.
DO $$ DECLARE t text; potent text; BEGIN
  SELECT id::text INTO potent FROM public.organizations WHERE slug='potent-logistics' LIMIT 1;
  IF potent IS NOT NULL THEN
    FOREACH t IN ARRAY ARRAY['job_route_legs','job_events','job_scope_changes','vendors','disposal_facilities'] LOOP
      EXECUTE format('UPDATE public.%I SET org_id=%L WHERE org_id IS NULL', t, potent);
    END LOOP;
  END IF; END $$;

SELECT 'job operations tables ready' AS status;

-- ===== part 73 =====
-- SQL 73 — properties + terms-acceptance records (service-role only via the gateway)
CREATE TABLE IF NOT EXISTS public.properties (
  id BIGSERIAL PRIMARY KEY, org_id TEXT, company TEXT, name TEXT NOT NULL, address TEXT,
  manager TEXT, phone TEXT, email TEXT, access_notes TEXT, loading_area TEXT, delivery_area TEXT,
  hours TEXT, restrictions TEXT, parking TEXT, dock_info TEXT, preferred_disposal TEXT, notes TEXT,
  account_type TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS properties_org_idx ON public.properties (org_id, company);

CREATE TABLE IF NOT EXISTS public.quote_terms_acceptance (
  id BIGSERIAL PRIMARY KEY, org_id TEXT, job_id TEXT, terms_version TEXT, tos_version TEXT,
  accepted BOOLEAN DEFAULT TRUE, customer_name TEXT, customer_email TEXT, source TEXT,
  ip TEXT, user_agent TEXT, accepted_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS qta_org_job_idx ON public.quote_terms_acceptance (org_id, job_id);

ALTER TABLE public.properties              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_terms_acceptance  ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; potent text; BEGIN
  SELECT id::text INTO potent FROM public.organizations WHERE slug='potent-logistics' LIMIT 1;
  IF potent IS NOT NULL THEN
    FOREACH t IN ARRAY ARRAY['properties','quote_terms_acceptance'] LOOP
      EXECUTE format('UPDATE public.%I SET org_id=%L WHERE org_id IS NULL', t, potent);
    END LOOP;
  END IF; END $$;

SELECT 'properties + terms records ready' AS status;


-- ===== part 74 =====
-- SQL 74 — job tables belong to one company each; heavy fee / weight columns; terms-version columns; photo stage
DO $$ DECLARE potent text; t text; BEGIN
  SELECT id::text INTO potent FROM public.organizations WHERE slug='potent-logistics' LIMIT 1;

  -- org_id on every core job table
  FOREACH t IN ARRAY ARRAY['jobs','junk_jobs','job_photos','jobs_backup'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id TEXT', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id)', t||'_org_idx', t);
    END IF;
  END LOOP;

  -- heavy items and weight, saved as their own fields (not buried in the total)
  IF to_regclass('public.jobs') IS NOT NULL THEN
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS heavy_fee NUMERIC DEFAULT 0;
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS heavy_lbs NUMERIC DEFAULT 0;
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS heavy_items JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS est_total_lbs NUMERIC;
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS trips INT;
  END IF;
  IF to_regclass('public.junk_jobs') IS NOT NULL THEN
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS heavy_fee NUMERIC DEFAULT 0;
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS heavy_lbs NUMERIC DEFAULT 0;
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS heavy_items JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS price_disposal NUMERIC;
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS price_travel NUMERIC;
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS est_total_lbs NUMERIC;
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS trips INT;
  END IF;

  -- photo stage (arrival, before, after, disposal, complete) and time taken
  IF to_regclass('public.job_photos') IS NOT NULL THEN
    ALTER TABLE public.job_photos ADD COLUMN IF NOT EXISTS stage TEXT;
    ALTER TABLE public.job_photos ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- sign-up page records which agreement version was accepted
  IF to_regclass('public.waitlist') IS NOT NULL THEN
    ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS agreement_version TEXT;
    ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS agreed_at TIMESTAMPTZ;
  END IF;

  -- existing rows: photos take their job's company; everything else that has no company is POTENT's
  IF to_regclass('public.job_photos') IS NOT NULL AND to_regclass('public.jobs') IS NOT NULL THEN
    UPDATE public.job_photos p SET org_id = j.org_id::text FROM public.jobs j WHERE p.job_id = j.id::text AND p.org_id IS NULL AND j.org_id IS NOT NULL;
  END IF;
  IF potent IS NOT NULL THEN
    FOREACH t IN ARRAY ARRAY['jobs','junk_jobs','job_photos','jobs_backup'] LOOP
      IF to_regclass('public.'||t) IS NOT NULL THEN
        EXECUTE format('UPDATE public.%I SET org_id=%L WHERE org_id IS NULL', t, potent);
      END IF;
    END LOOP;
  END IF;
END $$;

SELECT 'job tables scoped to a company; weight columns ready' AS status;


-- ===== part 75 =====
-- SQL 75 — rate cards (versioned), service zones, repeat-job templates. Service-role only via the gateway.
CREATE TABLE IF NOT EXISTS public.rate_cards (
  id BIGSERIAL PRIMARY KEY, org_id TEXT, name TEXT NOT NULL, version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft', effective_date DATE, customer TEXT,
  rates JSONB NOT NULL DEFAULT '[]'::jsonb, notes TEXT, created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS rate_cards_org_idx ON public.rate_cards (org_id, name, version);

CREATE TABLE IF NOT EXISTS public.service_zones (
  id BIGSERIAL PRIMARY KEY, org_id TEXT, name TEXT NOT NULL, from_miles NUMERIC NOT NULL DEFAULT 0,
  to_miles NUMERIC NOT NULL DEFAULT 25, surcharge NUMERIC NOT NULL DEFAULT 0, rush_multiplier NUMERIC NOT NULL DEFAULT 1,
  active BOOLEAN DEFAULT TRUE, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS service_zones_org_idx ON public.service_zones (org_id);

CREATE TABLE IF NOT EXISTS public.job_templates (
  id BIGSERIAL PRIMARY KEY, org_id TEXT, name TEXT NOT NULL, customer TEXT, customer_phone TEXT, customer_email TEXT,
  service_type TEXT, origin TEXT, destination TEXT, price NUMERIC, frequency TEXT, weekday TEXT, notes TEXT, next_run DATE,
  last_used TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS job_templates_org_idx ON public.job_templates (org_id);

ALTER TABLE public.job_templates ADD COLUMN IF NOT EXISTS next_run DATE;
ALTER TABLE public.rate_cards     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_zones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_templates  ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; potent text; BEGIN
  SELECT id::text INTO potent FROM public.organizations WHERE slug='potent-logistics' LIMIT 1;
  IF potent IS NOT NULL THEN
    FOREACH t IN ARRAY ARRAY['rate_cards','service_zones','job_templates'] LOOP
      EXECUTE format('UPDATE public.%I SET org_id=%L WHERE org_id IS NULL', t, potent);
    END LOOP;
  END IF; END $$;

SELECT 'rate cards, service zones, job templates ready' AS status;

-- ===== part 76 =====
-- SQL 76 — customer wallets move behind the server. Every customer account can have one prepaid wallet; balances change only through the server, each change leaves a ledger row.
ALTER TABLE public.potent_wallets      ADD COLUMN IF NOT EXISTS org_id TEXT;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS org_id TEXT;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS provider_ref TEXT;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS balance_after NUMERIC;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS actor TEXT;

DO $$ DECLARE potent text; BEGIN
  SELECT id::text INTO potent FROM public.organizations WHERE slug='potent-logistics' LIMIT 1;
  IF potent IS NOT NULL THEN
    UPDATE public.potent_wallets      SET org_id = potent WHERE org_id IS NULL;
    UPDATE public.wallet_transactions SET org_id = potent WHERE org_id IS NULL;
  END IF;
END $$;

-- one wallet per customer email per company (replaces the old email-only uniqueness)
ALTER TABLE public.potent_wallets DROP CONSTRAINT IF EXISTS potent_wallets_customer_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS potent_wallets_org_email_uq ON public.potent_wallets (org_id, customer_email);
-- one Stripe payment can fund a wallet only once
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_provider_ref_uq ON public.wallet_transactions (provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS wallet_tx_wallet_idx ON public.wallet_transactions (wallet_id, created_at DESC);
-- a balance can never go negative
ALTER TABLE public.potent_wallets DROP CONSTRAINT IF EXISTS potent_wallets_nonneg;
ALTER TABLE public.potent_wallets ADD CONSTRAINT potent_wallets_nonneg CHECK (available_balance >= 0) NOT VALID;

SELECT 'wallets ready (the public-key access is closed by LOCKDOWN-3, run last)' AS status;

-- ===== part 77 =====
-- SQL 77 — the last tables that had no company column. Each row now belongs to one company; existing rows go to POTENT.
-- New rows that a signed-out public form adds (reviews, waitlist, recurring requests, receipts, notes...) default to POTENT.
DO $$
DECLARE t text; potent text;
BEGIN
  SELECT id::text INTO potent FROM public.organizations WHERE slug = 'potent-logistics' LIMIT 1;
  FOREACH t IN ARRAY ARRAY['audit_log_real','expenses_real','commission_rates_real','payment_references','cost_profiles','customer_rate_cards',
    'claims','change_orders','addon_authorizations','my_documents','deadlines','shift_handoffs','escalation_timers','site_profiles','customer_locations',
    'incoming_loads','user_display_names','revoked_users','receipts','job_communications','login_log','push_subscriptions','griffin_queries',
    'recurring_routes','reviews','waitlist','os_prospects'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id TEXT', t);
      IF potent IS NOT NULL THEN
        EXECUTE format('UPDATE public.%I SET org_id = %L WHERE org_id IS NULL', t, potent);
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET DEFAULT %L', t, potent);
      END IF;
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id)', t || '_org_idx', t);
    END IF;
  END LOOP;
END $$;
SELECT 'SQL 77 done: office tables now have a company column' AS status;

-- ===== part 78 =====
-- SQL 78 — business rules (owner-editable numbers) and payout methods (how each person gets paid; no bank numbers stored).
CREATE TABLE IF NOT EXISTS public.business_rules (
  id TEXT PRIMARY KEY, org_id TEXT, data JSONB DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.payout_methods (
  id BIGSERIAL PRIMARY KEY, org_id TEXT NOT NULL, user_id TEXT NOT NULL, user_name TEXT, method TEXT NOT NULL,
  handle TEXT, address TEXT, note TEXT, updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE UNIQUE INDEX IF NOT EXISTS payout_methods_org_user_uq ON public.payout_methods (org_id, user_id);
CREATE INDEX IF NOT EXISTS business_rules_org_idx ON public.business_rules (org_id);
-- office-only: the public key gets no access (the server uses the service key)
ALTER TABLE public.business_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_rules FROM anon;
REVOKE ALL ON public.payout_methods FROM anon;
SELECT 'SQL 78 done: business rules and payout methods ready' AS status;

-- ===== part 69 =====
-- ═══════════════════════════════════════════════════════════════════
-- SQL 69 — keeps each company's data separate from POTENT's.
-- RUN THIS BEFORE you upload the new site (Supabase > SQL Editor > paste > Run).
-- Safe to run twice. It does not delete or change any existing data except
-- stamping all rows that exist today as POTENT's own.
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE t text; potent text;
BEGIN
  SELECT id::text INTO potent FROM public.organizations WHERE slug = 'potent-logistics' LIMIT 1;
  IF potent IS NULL THEN
    RAISE EXCEPTION 'POTENT organization (slug potent-logistics) not found. Nothing was changed.';
  END IF;
  FOREACH t IN ARRAY ARRAY['fleet_vehicles','fleet_maintenance','driver_locations','voice_room_messages',
                           'driver_compliance','brokers_carriers_backup','storage_partners','safety_alerts','carrier_profiles'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id TEXT', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id)', t || '_org_idx', t);
      EXECUTE format('UPDATE public.%I SET org_id = %L WHERE org_id IS NULL', t, potent);
    END IF;
  END LOOP;
END $$;

-- Check: every table below should show 0 in "rows_without_company"
SELECT 'fleet_vehicles' AS tbl, count(*) FILTER (WHERE org_id IS NULL) AS rows_without_company FROM public.fleet_vehicles
UNION ALL SELECT 'voice_room_messages', count(*) FILTER (WHERE org_id IS NULL) FROM public.voice_room_messages
UNION ALL SELECT 'driver_locations', count(*) FILTER (WHERE org_id IS NULL) FROM public.driver_locations
UNION ALL SELECT 'carrier_profiles', count(*) FILTER (WHERE org_id IS NULL) FROM public.carrier_profiles;

