-- POTENT Bodega V2 — bid/ask layer, mystery-box fulfillment, Live Drops auctions.
-- Run ONCE in Supabase > SQL Editor, AFTER bodega-schema.sql. Safe to run twice.
-- All tables are locked (no public policies): only the server (service key) can read or write them.
-- Ships with the V2 batch; do not run before the V2 code deploys.

-- ── Listings gain a source + optional reservation (auction wins are reserved for the winner) ──
alter table bodega_listings add column if not exists source text not null default 'market';
alter table bodega_listings add column if not exists reserved_email text;

-- ── Bids on marketplace listings (the ask is the listing's price_cents) ──
-- A bid MATCHES when it is placed at or above the ask, or when the seller accepts it.
-- Matching/execution lives in bodega-bid.js + bodega-buy.js; the royalty split is unchanged.
create table if not exists bodega_bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references bodega_listings(id),
  bidder_email text not null,
  amount_cents integer not null check (amount_cents > 0),
  -- active | matched (bid >= ask, awaiting the bidder's checkout) | accepted (seller accepted)
  -- | won | closed (sale happened to someone else / listing ended) | cancelled | expired
  status text not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bodega_bids_listing_idx on bodega_bids (listing_id);
create index if not exists bodega_bids_bidder_idx on bodega_bids (bidder_email);
create index if not exists bodega_bids_status_idx on bodega_bids (status);

-- ── Mystery box orders: one fulfillment record per box in a paid Bodega checkout ──
-- A box purchase creates NO resale ownership (its contents are unnamed at purchase time).
-- When the owner fulfills a box, the contents are ordinary catalog pieces, claimed the
-- normal way if they are ever bought as named pieces. See bodega-ownership.js (claim).
create table if not exists bodega_box_orders (
  id uuid primary key default gen_random_uuid(),
  box_key text not null,
  buyer_email text not null,
  price_cents integer not null,
  qty integer not null default 1,
  stripe_session_id text not null,
  status text not null default 'pending_fulfillment', -- pending_fulfillment | fulfilled
  contents_checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

create unique index if not exists bodega_box_orders_session_box_uidx
  on bodega_box_orders (stripe_session_id, box_key);
create index if not exists bodega_box_orders_status_idx on bodega_box_orders (status);

-- ── Live Drops auctions (TikTok-style live bidding, poll-synced like Smoke Sessions) ──
create table if not exists bodega_auctions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  -- scheduled | live | ended | cancelled
  status text not null default 'scheduled',
  starts_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  current_item_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists bodega_auction_items (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references bodega_auctions(id),
  ownership_id uuid not null references bodega_ownership(id),
  product_handle text not null,
  edition_label text,
  starting_bid_cents integer not null check (starting_bid_cents > 0),
  duration_seconds integer not null default 120,
  position integer not null default 0,
  -- queued | live | won | unsold
  status text not null default 'queued',
  ends_at timestamptz,
  winning_bid_cents integer,
  winner_email text,
  listing_id uuid references bodega_listings(id),
  created_at timestamptz not null default now()
);

create index if not exists bodega_auction_items_auction_idx on bodega_auction_items (auction_id);
create index if not exists bodega_auction_items_status_idx on bodega_auction_items (status);

create table if not exists bodega_auction_bids (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references bodega_auction_items(id),
  bidder_email text not null,
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

create index if not exists bodega_auction_bids_item_idx on bodega_auction_bids (item_id);

alter table bodega_bids enable row level security;
alter table bodega_box_orders enable row level security;
alter table bodega_auctions enable row level security;
alter table bodega_auction_items enable row level security;
alter table bodega_auction_bids enable row level security;
