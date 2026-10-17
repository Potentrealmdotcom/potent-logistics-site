-- POTENT Beat Man — producer accounts, beat catalog, automatic sale splits, wallet ledger, payouts.
-- Run ONCE in Supabase > SQL Editor > New query. Safe to re-run.

create table if not exists beat_producers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  country text,
  payout_method text,            -- paypal | airtm | zinli | usdt | binance | westernunion | wise | other
  payout_handle text,            -- handle / email / wallet label ONLY. Never full card or bank numbers.
  splits jsonb not null default '{"exclusive":91}'::jsonb,   -- seller % of the eligible sale (exclusive masters only; server enforces 91-99)
  deduct_fees boolean not null default true,   -- take estimated Stripe fee (2.9% + 30c) off before splitting
  hold_days int not null default 3,            -- days before a sale is withdrawable (covers refunds/disputes)
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists beat_items (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references beat_producers(id) on delete cascade,
  title text not null,
  lease_cents int,               -- null = not for lease
  exclusive_cents int,           -- null = not for exclusive sale
  preview_url text,              -- public audio link (SoundCloud, YouTube, direct mp3)
  deliver_url text,              -- private download link shown to the buyer AFTER payment
  exclusive_sold boolean not null default false,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists beat_sales (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references beat_producers(id),
  beat_id uuid references beat_items(id),
  title text,
  sale_type text not null,
  stripe_session_id text unique not null,
  payment_intent_id text,
  buyer_email text,
  gross_cents int not null,
  fee_cents int not null default 0,
  net_cents int not null,
  split_pct numeric(5,2) not null,
  producer_cents int not null,
  status text not null default 'complete',   -- complete | refunded
  created_at timestamptz default now()
);
create index if not exists beat_sales_pi on beat_sales(payment_intent_id);
create index if not exists beat_sales_producer on beat_sales(producer_id, created_at desc);

create table if not exists beat_wallet_txns (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references beat_producers(id),
  type text not null,            -- sale | refund | payout | payout_cancel | adjustment | bonus
  amount_cents int not null,     -- + credit / - debit
  ref text unique,               -- idempotency key
  note text,
  available_at timestamptz not null default now(),
  created_at timestamptz default now()
);
create index if not exists beat_txns_producer on beat_wallet_txns(producer_id, created_at desc);

create table if not exists beat_payouts (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references beat_producers(id),
  amount_cents int not null,
  method text,
  handle text,
  status text not null default 'pending',    -- pending | paid | cancelled
  reference text,                -- confirmation / transaction id when marked paid
  requested_at timestamptz default now(),
  paid_at timestamptz
);

-- Locked down: only the server (service role) reads or writes these. No anon access.
alter table beat_producers enable row level security;
alter table beat_items enable row level security;
alter table beat_sales enable row level security;
alter table beat_wallet_txns enable row level security;
alter table beat_payouts enable row level security;
