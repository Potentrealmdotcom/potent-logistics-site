-- Carrier vetting: one row per carrier application. Server-only (RLS on, no policies = service role only).
-- Holds the evidence behind the risk recommendation; the human decision stays in carrier_profiles.verification_status.
create table if not exists public.carrier_vetting (
  id uuid primary key default gen_random_uuid(),
  profile_id bigint not null unique references public.carrier_profiles(id) on delete cascade,
  fmcsa jsonb,                 -- server-side FMCSA lookup result (never the browser's copy)
  phone jsonb,                 -- {line_type, carrier, checked_at} from Twilio Lookup v2
  idv jsonb,                   -- {live_human, doc_matches, source: 'staff'|'vendor', by, at}
  eld jsonb,                   -- {status:'not_connected'|'connected', provider, active_hardware_count, last_ping_at}
  status text not null default 'MANUAL_REVIEW'
    check (status in ('APPROVED','MANUAL_REVIEW','REJECTED','HOLD_REQUIRES_LIVENESS')),
  score int not null default 0,
  factors text[] not null default '{}',
  reason text,
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.carrier_vetting enable row level security;
