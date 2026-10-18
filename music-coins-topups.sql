-- Coin top-ups + rewards (applied live via migration music_coin_topups). Safe to re-run.
create table if not exists music_coin_topups (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  user_id uuid not null references music_users(id) on delete cascade,
  cents bigint not null check (cents > 0),
  payment_intent text,
  status text not null default 'paid' check (status in ('paid','refunded','disputed')),
  created_at timestamptz not null default now()
);
create index if not exists music_coin_topups_user on music_coin_topups(user_id);
create index if not exists music_coin_topups_pi on music_coin_topups(payment_intent);
alter table music_coin_topups enable row level security;
-- Breeze: one login (Beat Man), store admin turned on:
update beat_producers set store_admin = true where email = 'breeze' and active = true;
