-- POTENT Beats exclusive marketplace: listing statuses, rights fields, atomic exclusive sale,
-- sale ledger fields, settings (revenue model + payout code), audit log, producer applications.
-- Safe to run more than once.

alter table beat_items
  add column if not exists status text not null default 'published',
  add column if not exists seller_type text not null default 'platform',
  add column if not exists genre text,
  add column if not exists mood text,
  add column if not exists explicit boolean not null default false,
  add column if not exists has_vocal_samples boolean not null default false,
  add column if not exists description text,
  add column if not exists sample_disclosure text,
  add column if not exists rights_confirmed boolean not null default false,
  add column if not exists rights_package text,
  add column if not exists deliverables text[] default '{}',
  add column if not exists internal_notes text,
  add column if not exists cover_url text,
  add column if not exists play_count int not null default 0,
  add column if not exists reserved_until timestamptz,
  add column if not exists reserved_token text,
  add column if not exists sold_session text,
  add column if not exists sold_at timestamptz,
  add column if not exists publish_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'beat_items_status_chk') then
    alter table beat_items add constraint beat_items_status_chk
      check (status in ('draft','processing','pending_review','approved','published','sold','unavailable','rejected'));
  end if;
end $$;

update beat_items set status = 'sold', sold_at = coalesce(sold_at, now()) where exclusive_sold and status = 'published';
create index if not exists beat_items_status on beat_items(status);

alter table beat_producers
  add column if not exists store_admin boolean not null default false,   -- may upload/edit/publish store beats; never touches money
  add column if not exists kind text not null default 'platform',        -- platform | seller (approved third-party)
  add column if not exists legal_name text,
  add column if not exists verified boolean not null default false;

alter table beat_sales
  add column if not exists agreement_version text,
  add column if not exists agreement_accepted_at timestamptz,
  add column if not exists tax_cents int not null default 0,
  add column if not exists discount_cents int not null default 0,
  add column if not exists refunded_cents int not null default 0,
  add column if not exists seller_type text,
  add column if not exists allocation jsonb,          -- snapshot of the terms used for this sale
  add column if not exists payout_status text not null default 'held';

create table if not exists beat_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
insert into beat_settings(key, value) values
 ('revenue_model', '{"confirmed":false,"stream":null,"artist_pct":91,"producer_pct":8,"platform_pct":1,"public_text":null}'::jsonb)
on conflict (key) do nothing;

create table if not exists beat_audit (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  target text,
  detail jsonb,
  created_at timestamptz default now()
);
create index if not exists beat_audit_time on beat_audit(created_at desc);

create table if not exists beat_applications (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  producer_name text not null,
  email text not null,
  phone text,
  portfolio text,
  country text,
  rights_declaration boolean not null default false,
  sample_info text,
  payout_preference text,
  agreement_version text,
  agreement_accepted_at timestamptz,
  status text not null default 'pending',     -- pending | approved | rejected
  review_note text,
  producer_id uuid references beat_producers(id),
  created_at timestamptz default now(),
  decided_at timestamptz
);
create index if not exists beat_apps_status on beat_applications(status, created_at desc);

alter table beat_settings enable row level security;
alter table beat_audit enable row level security;
alter table beat_applications enable row level security;

-- Atomic: only one caller can hold an exclusive at a time.
create or replace function beat_reserve(p_beat uuid, p_token text, p_minutes int)
returns boolean language plpgsql as $$
declare n int;
begin
  update beat_items set reserved_until = now() + make_interval(mins => p_minutes), reserved_token = p_token
   where id = p_beat and active and not exclusive_sold and exclusive_cents is not null
     and (status = 'published' or (status = 'approved' and publish_at is not null and publish_at <= now()))
     and (reserved_until is null or reserved_until < now());
  get diagnostics n = row_count;
  return n = 1;
end $$;

create or replace function beat_release(p_beat uuid, p_token text)
returns void language sql as $$
  update beat_items set reserved_until = null, reserved_token = null
   where id = p_beat and reserved_token = p_token and not exclusive_sold;
$$;

-- Atomic: first paid session wins. Returns 'sold' | 'already' (same session retried) | 'conflict' (someone else owns it).
create or replace function beat_finalize(p_beat uuid, p_session text)
returns text language plpgsql as $$
declare n int; cur text;
begin
  update beat_items set exclusive_sold = true, status = 'sold', sold_session = p_session, sold_at = now(),
         reserved_until = null, reserved_token = null
   where id = p_beat and not exclusive_sold;
  get diagnostics n = row_count;
  if n = 1 then return 'sold'; end if;
  select sold_session into cur from beat_items where id = p_beat;
  if cur = p_session then return 'already'; end if;
  return 'conflict';
end $$;

create or replace function beat_play(p_beat uuid)
returns void language sql as $$
  update beat_items set play_count = play_count + 1 where id = p_beat;
$$;

revoke all on function beat_reserve(uuid, text, int), beat_release(uuid, text), beat_finalize(uuid, text), beat_play(uuid) from public, anon, authenticated;
