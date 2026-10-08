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
