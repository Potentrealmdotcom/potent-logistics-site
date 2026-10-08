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
