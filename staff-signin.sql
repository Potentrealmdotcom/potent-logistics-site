-- Staff email sign-in codes (Oct 21, 2026). Run in Supabase > SQL Editor. Server-only: RLS on, no policies, so the public key can read nothing.
create table if not exists public.staff_logins (
  user_id text primary key,
  email text,
  code_hash text,
  code_exp timestamptz,
  tries int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.staff_logins enable row level security;
