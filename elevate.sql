-- Əlevate: private assistant data. One table. Server-only (RLS on, no policies = service role only).
create table if not exists public.elevate_items (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,                                   -- the person's email (or the POTENT owner key)
  kind text not null check (kind in ('note','task','memory','place')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (body is null or char_length(body) <= 4000),
  due_at timestamptz,
  done boolean not null default false,
  source text not null default 'manual' check (source in ('manual','chat','voice')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists elevate_items_owner_kind on public.elevate_items (owner_key, kind, created_at desc);
alter table public.elevate_items enable row level security;

-- Phone line: one row per call attempt (who/when/how long; never the words or audio).
create table if not exists public.elevate_calls (
  id uuid primary key default gen_random_uuid(),
  call_sid text not null unique,
  owner_key text not null,
  from_number text,
  state text not null default 'pin_pending' check (state in ('pin_pending','ringing','active','ended','failed','denied')),
  pin_fails int not null default 0,
  tool_calls int not null default 0,
  seconds int,
  end_reason text,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
create index if not exists elevate_calls_created on public.elevate_calls (created_at desc);
alter table public.elevate_calls enable row level security;

-- Life OS map: saved places (applied live as migration "elevate_places"). Coordinates are kept to 2 decimals (~1 km) on purpose.
alter table public.elevate_items add column if not exists lat numeric(6,2) check (lat is null or lat between -90 and 90);
alter table public.elevate_items add column if not exists lon numeric(6,2) check (lon is null or lon between -180 and 180);
alter table public.elevate_items drop constraint if exists elevate_items_kind_check;
alter table public.elevate_items add constraint elevate_items_kind_check check (kind in ('note','task','memory','place'));
alter table public.elevate_items drop constraint if exists elevate_items_place_has_point;
alter table public.elevate_items add constraint elevate_items_place_has_point check (kind <> 'place' or (lat is not null and lon is not null));

-- Billing: $50/month plan (120 voice minutes) + prepaid voice credits. Applied live as migration "elevate_billing". Server-only (RLS on, no policies).
create table if not exists public.elevate_accounts (
  owner_key text primary key,
  mode text not null default 'free' check (mode in ('free','paid','comped')),
  sub_status text,
  stripe_customer text,
  stripe_sub text,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.elevate_usage (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  kind text not null check (kind in ('voice','phone')),
  ref text not null unique,
  state text not null default 'open' check (state in ('open','closed')),
  started_at timestamptz not null default now(),
  last_seen timestamptz,
  ended_at timestamptz,
  seconds int not null default 0 check (seconds >= 0),
  from_included int not null default 0 check (from_included >= 0),
  from_credit int not null default 0 check (from_credit >= 0),
  created_at timestamptz not null default now()
);
create index if not exists elevate_usage_owner on public.elevate_usage (owner_key, started_at desc);
create table if not exists public.elevate_credits (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  seconds int not null check (seconds > 0),
  expires_at timestamptz not null,
  ref text not null unique,
  source text not null check (source in ('purchase','grant')),
  cents int,
  payment_intent text,
  status text not null default 'paid' check (status in ('paid','refunded','disputed')),
  created_at timestamptz not null default now()
);
create index if not exists elevate_credits_owner on public.elevate_credits (owner_key);
create index if not exists elevate_credits_pi on public.elevate_credits (payment_intent);
alter table public.elevate_accounts enable row level security;
alter table public.elevate_usage enable row level security;
alter table public.elevate_credits enable row level security;

-- Jarvis slice 1 (owner business tools): every email she sends herself, and the pause switch. Server-only (RLS on, no policies).
create table if not exists public.elevate_actions (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  kind text not null check (kind in ('email','switch')),
  target text,
  subject text,
  ok boolean not null default true,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists elevate_actions_owner on public.elevate_actions (owner_key, kind, created_at desc);
alter table public.elevate_actions enable row level security;
