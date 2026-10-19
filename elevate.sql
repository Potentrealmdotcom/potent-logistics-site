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
