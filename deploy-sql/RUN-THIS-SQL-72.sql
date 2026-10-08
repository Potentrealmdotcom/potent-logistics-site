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
