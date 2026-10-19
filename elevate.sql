-- Əlevate: private assistant data. One table. Server-only (RLS on, no policies = service role only).
create table if not exists public.elevate_items (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,                                   -- the person's email (or the POTENT owner key)
  kind text not null check (kind in ('note','task','memory')),
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
