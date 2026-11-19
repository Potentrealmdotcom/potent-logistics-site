-- DVIR reports (D20), driver block-out dates (D29), automation rules (D21) — Nov 18, 2026.
-- RUN-ONCE-SAFE: run in Supabase > SQL Editor; every statement is a no-op if the
-- table/columns already exist. Access model: server-only through the data-api gateway
-- (service role bypasses RLS); the browser never touches these tables directly.
-- Until this SQL runs, the app keeps working from local storage and the sync calls
-- fail soft (same pattern as fleet_maintenance).

create table if not exists public.dvir_reports (
  id text primary key,
  org_id text,
  driver_name text,
  vehicle_id text,
  vehicle_label text,
  kind text,                 -- 'pre' | 'post'
  items jsonb,               -- [{key,label,status: ok|defect|na,note}]
  odometer numeric,
  signature text,
  status text default 'submitted',  -- submitted | needs_review | reviewed
  created_at timestamptz not null default now()
);
alter table public.dvir_reports enable row level security;

create table if not exists public.driver_blockouts (
  id text primary key,
  org_id text,
  driver_name text,
  start_date date,
  end_date date,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.driver_blockouts enable row level security;

create table if not exists public.automation_rules (
  id text primary key,
  org_id text,
  name text,
  trigger text,              -- 'created' | 'status'
  trigger_status text,       -- for trigger='status': the status that fires the rule
  action text,               -- 'email_invoice' | 'email_quote' | 'notify_owner' | 'flag'
  enabled boolean default true,
  updated_at timestamptz not null default now()
);
alter table public.automation_rules enable row level security;
