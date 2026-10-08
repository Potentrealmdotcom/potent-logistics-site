-- PART B: rate cards, zones, wallets, office-table company columns, business rules, payout methods.
-- Run PART A first.
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


SELECT 'PART B DONE - now run STEP-2-VERIFY' AS result;
