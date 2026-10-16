-- POTENT growth + payroll upgrade. Run ONCE in Supabase > SQL Editor > New query > paste > Run.
-- Safe to run twice.

-- 1) Remember which referral code a job used
alter table jobs add column if not exists referral_code text;
alter table jobs add column if not exists referral_source text;
create index if not exists jobs_referral_idx on jobs(referral_code) where referral_code is not null;

-- 2) Referral bonus ledger: one row per code + new customer + tier. The unique key stops anyone being paid twice.
create table if not exists referral_bonuses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  customer_key text not null,
  customer_name text,
  tier text not null,                 -- 'first_job' ($25) or 'contract' ($250 total)
  target_cents integer not null,
  paid_cents integer not null default 0,
  pay_to_email text,
  job_id text,
  created_at timestamptz default now(),
  unique (code, customer_key, tier)
);
alter table referral_bonuses enable row level security;   -- no public policy: only the server (service key) can touch it
