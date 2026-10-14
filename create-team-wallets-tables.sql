-- POTENT Team/Driver Wallets — commission tracking + cashout
-- Run this once in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Wallets: one per team member / driver
create table if not exists team_wallets (
  id uuid primary key default gen_random_uuid(),
  member_email text unique not null,
  member_name text,
  role text default 'driver', -- driver, dispatcher, cold_caller, etc.
  available_balance numeric(12,2) default 0 not null,
  total_earned numeric(12,2) default 0 not null,
  total_cashed_out numeric(12,2) default 0 not null,
  payout_method text,          -- 'bank' | 'debit_card' | null
  payout_handle text,          -- Zelle phone/email, CashApp tag, etc. (NEVER store full card/bank numbers)
  payout_label text,           -- e.g. "Chase ****1234" display label
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Transaction ledger: every credit/debit/cashout
create table if not exists team_wallet_txns (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references team_wallets(id) on delete cascade,
  type text not null,           -- 'commission' | 'bonus' | 'adjustment' | 'cashout' | 'fee'
  amount numeric(12,2) not null, -- positive = credit, negative = debit
  note text,
  actor text,                   -- who triggered it (owner email or 'system')
  created_at timestamptz default now()
);
create index if not exists idx_team_wallet_txns_wallet on team_wallet_txns(wallet_id, created_at desc);

-- 3. Payout requests: member requests cashout, owner pays + marks paid
create table if not exists payout_requests (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references team_wallets(id) on delete cascade,
  amount numeric(12,2) not null,      -- gross amount requested
  fee numeric(12,2) default 0 not null, -- Stripe-style fee (1.5% for debit card, 0 for bank)
  net_amount numeric(12,2) not null,   -- amount - fee = what they receive
  method text not null,                -- 'bank' (free) | 'debit_card' (1.5% fee)
  payout_handle text,                  -- where to send it
  status text default 'pending' not null, -- 'pending' | 'paid' | 'cancelled'
  created_at timestamptz default now(),
  paid_at timestamptz,
  paid_by text
);
create index if not exists idx_payout_requests_status on payout_requests(status, created_at desc);

-- RLS: open for anon (app uses anon key; owner/dispatch gating is in app logic)
alter table team_wallets enable row level security;
alter table team_wallet_txns enable row level security;
alter table payout_requests enable row level security;

drop policy if exists "anon all team_wallets" on team_wallets;
create policy "anon all team_wallets" on team_wallets for all using (true) with check (true);

drop policy if exists "anon all team_wallet_txns" on team_wallet_txns;
create policy "anon all team_wallet_txns" on team_wallet_txns for all using (true) with check (true);

drop policy if exists "anon all payout_requests" on payout_requests;
create policy "anon all payout_requests" on payout_requests for all using (true) with check (true);
