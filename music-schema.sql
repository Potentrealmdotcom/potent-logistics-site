-- POTENT Music: buyer accounts, storefront profiles, streaming, products, videos, playlists, reports.
-- Safe to run more than once. Additive only.
alter table beat_producers
  add column if not exists slug text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists banner_url text,
  add column if not exists links jsonb not null default '{}'::jsonb,
  add column if not exists city text;
create unique index if not exists beat_producers_slug on beat_producers(slug) where slug is not null;
alter table beat_sales add column if not exists buyer_user_id uuid;

create table if not exists music_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  password_hash text not null,
  marketing_opt_in boolean not null default false,
  active boolean not null default true,
  created_at timestamptz default now()
);
create table if not exists music_favorites (
  user_id uuid not null references music_users(id) on delete cascade,
  kind text not null,                 -- beat | track | product
  item_id uuid not null,
  created_at timestamptz default now(),
  primary key (user_id, kind, item_id)
);
create table if not exists music_follows (
  user_id uuid not null references music_users(id) on delete cascade,
  producer_id uuid not null references beat_producers(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, producer_id)
);
create table if not exists music_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references music_users(id) on delete cascade,   -- null = curated by POTENT
  title text not null,
  description text,
  curated boolean not null default false,
  is_public boolean not null default false,
  created_at timestamptz default now()
);
create table if not exists music_playlist_items (
  playlist_id uuid not null references music_playlists(id) on delete cascade,
  track_id uuid not null,
  position int not null default 0,
  primary key (playlist_id, track_id)
);
create table if not exists music_tracks (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references beat_producers(id) on delete cascade,
  title text not null,
  album text,
  audio_url text,                     -- public stream file
  cover_url text,
  genre text, mood text,
  explicit boolean not null default false,
  description text,
  release_date date,
  status text not null default 'draft',   -- draft | pending_review | published | unavailable | rejected
  featured boolean not null default false,
  plays int not null default 0,
  created_at timestamptz default now()
);
create index if not exists music_tracks_status on music_tracks(status, created_at desc);
create table if not exists music_products (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references beat_producers(id) on delete cascade,
  kind text not null default 'digital',   -- album | sample_pack | preset | stems | project_file | bundle | video | digital
  title text not null,
  description text,
  cover_url text,
  price_cents int not null,
  file_ref text,                      -- storage:beat-files/... (private, delivered after payment)
  preview_url text,
  tags text[] default '{}',
  rights_text text,
  sample_disclosure text,
  rights_confirmed boolean not null default false,
  status text not null default 'draft',
  featured boolean not null default false,
  limited_qty int,                    -- limited drop: null = unlimited
  sold_count int not null default 0,
  publish_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists music_products_status on music_products(status, created_at desc);
create table if not exists music_sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references music_products(id),
  producer_id uuid not null references beat_producers(id),
  buyer_user_id uuid,
  buyer_email text,
  stripe_session_id text unique not null,
  payment_intent_id text,
  gross_cents int not null,
  tax_cents int not null default 0,
  discount_cents int not null default 0,
  fee_cents int not null default 0,         -- Stripe processing fee (estimate), separate from the platform fee
  eligible_cents int not null default 0,
  platform_fee_cents int not null default 0,
  seller_cents int not null default 0,
  status text not null default 'complete',  -- complete | refunded
  refunded_cents int not null default 0,
  agreement_version text,
  agreement_accepted_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists music_sales_pi on music_sales(payment_intent_id);
create index if not exists music_sales_user on music_sales(buyer_user_id);
create table if not exists music_videos (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references beat_producers(id) on delete cascade,
  title text not null,
  description text,
  video_url text not null,            -- YouTube/Vimeo link or a direct https video file
  thumb_url text,
  track_id uuid,
  status text not null default 'draft',
  featured boolean not null default false,
  views int not null default 0,
  created_at timestamptz default now()
);
create table if not exists music_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null, item_id uuid not null,
  reason text not null, contact text,
  status text not null default 'open',
  created_at timestamptz default now()
);
alter table music_users enable row level security;
alter table music_favorites enable row level security;
alter table music_follows enable row level security;
alter table music_playlists enable row level security;
alter table music_playlist_items enable row level security;
alter table music_tracks enable row level security;
alter table music_products enable row level security;
alter table music_sales enable row level security;
alter table music_videos enable row level security;
alter table music_reports enable row level security;

-- Atomic limited drop: only the first N paid sessions get a copy.
create or replace function music_product_claim(p_id uuid) returns boolean language plpgsql as $$
declare n int;
begin
  update music_products set sold_count = sold_count + 1 where id = p_id and (limited_qty is null or sold_count < limited_qty);
  get diagnostics n = row_count; return n = 1;
end $$;
create or replace function music_track_play(p_id uuid) returns void language sql as $$ update music_tracks set plays = plays + 1 where id = p_id; $$;
create or replace function music_video_view(p_id uuid) returns void language sql as $$ update music_videos set views = views + 1 where id = p_id; $$;
revoke all on function music_product_claim(uuid), music_track_play(uuid), music_video_view(uuid) from public, anon, authenticated;
