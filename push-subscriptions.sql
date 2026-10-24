-- push_subscriptions — Web Push device registrations (Oct 24, 2026).
-- The table was referenced by app.js + send-push.js but never had a migration in this repo, so its
-- existence/policies in production were unverifiable from code. This file is RUN-ONCE-SAFE: run it in
-- Supabase > SQL Editor; every statement is a no-op if the table/columns/index already exist.
-- Access model: server-only. All reads/writes go through Netlify functions with the service role
-- (which bypasses RLS). No anon/public policies — the browser never touches this table directly
-- anymore (registration goes through the push-subscribe function with a signed staff token).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  user_name text,
  endpoint text not null,
  subscription jsonb not null,
  org_id uuid,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If the table pre-existed in a smaller shape, add the columns the owner targeting needs.
alter table public.push_subscriptions add column if not exists user_id text;
alter table public.push_subscriptions add column if not exists user_name text;
alter table public.push_subscriptions add column if not exists endpoint text;
alter table public.push_subscriptions add column if not exists subscription jsonb;
alter table public.push_subscriptions add column if not exists org_id uuid;
alter table public.push_subscriptions add column if not exists role text;
alter table public.push_subscriptions add column if not exists created_at timestamptz not null default now();
alter table public.push_subscriptions add column if not exists updated_at timestamptz not null default now();

-- One row per device endpoint: re-subscribing updates the row instead of piling up duplicates.
create unique index if not exists push_subscriptions_endpoint_key on public.push_subscriptions (endpoint);
create index if not exists push_subscriptions_org_role_idx on public.push_subscriptions (org_id, role);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Server-only: drop any anon/public policies that may exist on this table (same pattern as
-- rls-close-server-only-tables.sql). The service role is unaffected by RLS.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions'
      and (roles && array['anon','public']::name[])
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Verify afterwards: select column_name from information_schema.columns
-- where table_name='push_subscriptions' order by ordinal_position;
