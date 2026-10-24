-- POTENT Bodega — resale engine tables (collectors, ownership, listings, sales, royalties).
-- Run ONCE in Supabase > SQL Editor. Safe to run twice.
-- All tables are locked (no public policies): only the server (service key) can read or write them.

create sequence if not exists bodega_collector_no_seq;

create table if not exists bodega_collectors (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  collector_no bigint not null unique default nextval('bodega_collector_no_seq'),
  created_at timestamptz not null default now()
);

create table if not exists bodega_ownership (
  id uuid primary key default gen_random_uuid(),
  product_handle text not null,
  owner_email text not null,
  edition_label text,
  purchased_at timestamptz not null default now(),
  purchase_price_cents integer not null,
  source_ref text,
  status text not null default 'active',
  hold_until timestamptz not null,
  resale_floor_cents integer not null,
  creator_key text not null default 'POTENT',
  original_buyer_email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists bodega_ownership_source_ref_uidx
  on bodega_ownership (source_ref) where source_ref is not null;
create index if not exists bodega_ownership_owner_idx on bodega_ownership (owner_email);
create index if not exists bodega_ownership_handle_idx on bodega_ownership (product_handle);

create table if not exists bodega_listings (
  id uuid primary key default gen_random_uuid(),
  ownership_id uuid not null references bodega_ownership(id),
  seller_email text not null,
  price_cents integer not null check (price_cents > 0),
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create index if not exists bodega_listings_ownership_idx on bodega_listings (ownership_id);
create index if not exists bodega_listings_status_idx on bodega_listings (status);

create table if not exists bodega_sales (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references bodega_listings(id),
  product_handle text not null,
  buyer_email text not null,
  price_cents integer not null,
  royalty_creator_cents integer not null,
  royalty_original_buyer_cents integer not null,
  royalty_platform_cents integer not null,
  seller_payout_cents integer not null,
  stripe_session_id text unique,
  sold_at timestamptz not null default now()
);

create index if not exists bodega_sales_handle_idx on bodega_sales (product_handle);

create table if not exists bodega_royalty_ledger (
  id uuid primary key default gen_random_uuid(),
  payee_email text not null,
  role text not null,
  amount_cents integer not null,
  sale_id uuid not null references bodega_sales(id),
  created_at timestamptz not null default now()
);

create index if not exists bodega_royalty_ledger_payee_idx on bodega_royalty_ledger (payee_email);
create index if not exists bodega_royalty_ledger_sale_idx on bodega_royalty_ledger (sale_id);

alter table bodega_collectors enable row level security;
alter table bodega_ownership enable row level security;
alter table bodega_listings enable row level security;
alter table bodega_sales enable row level security;
alter table bodega_royalty_ledger enable row level security;
