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
