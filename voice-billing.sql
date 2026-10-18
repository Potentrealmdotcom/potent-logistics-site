-- POTENT VOICE billing tiers (already applied to the live database; kept here for reference and new environments).
-- Safe to re-run: every statement is create-if-not-exists / insert-on-conflict-do-nothing.
create table if not exists voice_plans (
  tier text primary key check (tier in ('starter','growth','fleet','enterprise')),
  label text not null, os_label text not null,
  price_cents integer not null check (price_cents >= 0),
  price_is_minimum boolean not null default false,
  included_minutes integer not null default 0 check (included_minutes >= 0),
  overage_enabled boolean not null default true,
  overage_cents_per_min integer not null default 0 check (overage_cents_per_min >= 0),
  overage_cap_minutes integer,
  max_concurrent_calls integer not null default 1 check (max_concurrent_calls >= 1),
  max_call_minutes integer not null default 15 check (max_call_minutes >= 1),
  entitlements jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  stripe_product_id text,
  version integer not null default 1,
  updated_by text, updated_at timestamptz not null default now()
);
create table if not exists voice_subscriptions (
  org_id uuid primary key references organizations(id) on delete cascade,
  tier text references voice_plans(tier),
  os_plan text,
  status text not null default 'none' check (status in ('none','pending','active','past_due','cancelled','internal')),
  comped boolean not null default false,
  custom_price_cents integer check (custom_price_cents is null or custom_price_cents >= 0),
  overage_cap_minutes_override integer,
  stripe_customer_id text, stripe_subscription_id text unique, stripe_item_id text,
  tier_at_signup text, price_cents_at_signup integer,
  current_period_start timestamptz, current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_event_id text, updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table if not exists voice_usage_records (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  session_id text not null,
  kind text not null default 'call' check (kind in ('call','outbound')),
  started_at timestamptz not null default now(),
  seconds integer not null default 0 check (seconds >= 0),
  billable_minutes integer not null default 0 check (billable_minutes >= 0),
  est_cost_cents integer,
  created_at timestamptz not null default now(),
  unique (org_id, session_id)
);
create index if not exists voice_usage_org_time on voice_usage_records (org_id, started_at);
create table if not exists voice_billing_events (
  event_key text primary key, type text not null, org_id uuid, detail jsonb, created_at timestamptz not null default now()
);
create table if not exists voice_audit_logs (
  id bigserial primary key, org_id uuid, actor text not null, action text not null, target text,
  before jsonb, after jsonb, created_at timestamptz not null default now()
);
create index if not exists voice_audit_time on voice_audit_logs (created_at desc);
alter table voice_plans enable row level security; alter table voice_subscriptions enable row level security;
alter table voice_usage_records enable row level security; alter table voice_billing_events enable row level security; alter table voice_audit_logs enable row level security;
-- Starting values (owner can change every one in the POTENT VOICE admin screen). Prices match POTENT OS tiers; minutes and overage rates are starting proposals.
insert into voice_plans (tier,label,os_label,price_cents,price_is_minimum,included_minutes,overage_enabled,overage_cents_per_min,max_concurrent_calls,max_call_minutes,entitlements) values
('starter','POTENT VOICE Starter','POTENT OS Starter (1-10 trucks)',19900,false,300,true,50,2,15,'{"inbound":true,"quotes":true,"booking":true,"handoff":true,"callbacks":true,"notifications":true,"transcripts":true,"recording":false,"analytics_export":false,"custom_knowledge":false,"multi_vehicle":false,"outbound":false,"campaigns":false,"contractors":false,"api_access":false,"priority_support":false}'),
('growth','POTENT VOICE Growth','POTENT OS Growth (11-50 trucks)',49900,false,1000,true,45,5,20,'{"inbound":true,"quotes":true,"booking":true,"handoff":true,"callbacks":true,"notifications":true,"transcripts":true,"recording":true,"analytics_export":true,"custom_knowledge":true,"multi_vehicle":true,"outbound":false,"campaigns":false,"contractors":false,"api_access":false,"priority_support":false}'),
('fleet','POTENT VOICE Fleet','POTENT OS Fleet',99900,false,3000,true,40,15,30,'{"inbound":true,"quotes":true,"booking":true,"handoff":true,"callbacks":true,"notifications":true,"transcripts":true,"recording":true,"analytics_export":true,"custom_knowledge":true,"multi_vehicle":true,"outbound":true,"campaigns":true,"contractors":true,"api_access":true,"priority_support":false}'),
('enterprise','POTENT VOICE Enterprise','POTENT OS Enterprise',199900,true,10000,true,35,50,60,'{"inbound":true,"quotes":true,"booking":true,"handoff":true,"callbacks":true,"notifications":true,"transcripts":true,"recording":true,"analytics_export":true,"custom_knowledge":true,"multi_vehicle":true,"outbound":true,"campaigns":true,"contractors":true,"api_access":true,"priority_support":true}')
on conflict (tier) do nothing;
