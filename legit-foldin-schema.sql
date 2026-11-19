-- LEGIT fold-in (G79, Nov 18 2026): Spark-mined features + seed profile system.
-- Run ONCE in Supabase > SQL Editor > New query > paste > Run. Safe to run twice (idempotent).
-- Companion to legit-schema.sql — does not replace it. All new tables are RLS-locked like the rest:
-- only the server (service key) can read or write them.
--
-- NOTE (Tony ruling, Nov 18 2026): there is deliberately NO catfish-report ban track in this file.
-- The "3 catfish reports = permanent ban" feature was removed by Tony. Do not add it back.

-- ───────── new columns on legit_users ─────────
-- Occupation shown on the Discover card and profile (Spark gap #9).
alter table legit_users add column if not exists occupation text;
-- Interest tags, e.g. {Music, Foodie, Dogs} (Spark gap #8).
alter table legit_users add column if not exists interests text[] default '{}';
-- Accessibility settings (Spark gap #5): {voice_first, screen_reader, haptics, large_text, photo_desc} booleans.
alter table legit_users add column if not exists accessibility jsonb default '{}';
-- Voice intro (Spark gap #7): {audio: data URL, transcript: text, duration: seconds, at: iso}. Null = none recorded.
alter table legit_users add column if not exists voice_intro jsonb;
-- Wingman video (Spark gap #11): {url: data URL, by_name: text, at: iso}. Null = none. Set ONLY by wingman_submit.
alter table legit_users add column if not exists wingman_video jsonb;
-- Video selfie verification (Spark gap #3): {url: data URL, status: pending|approved|rejected, at: iso, reviewed_by: uuid}.
alter table legit_users add column if not exists video_selfie jsonb;
-- Incognito browsing (Spark gap #16): while incognito_until > now(), the user is hidden from Discover.
alter table legit_users add column if not exists incognito_until timestamptz;
-- Priority queue (Spark gap #17): while priority_until > now(), the user is ordered first in Discover.
-- There is NO store and NO paid tier in LEGIT — this is granted by an admin (a_user_act "priority") until Tony rules on how users earn it.
alter table legit_users add column if not exists priority_until timestamptz;
-- Seed profiles ("bot women", Tony Nov 12 + Nov 18): is_seed marks a seeded profile; seed_batch groups them
-- so an admin can purge a whole batch (or all seeds) in one action. Real users always have is_seed = false.
alter table legit_users add column if not exists is_seed boolean default false;
alter table legit_users add column if not exists seed_batch text;
create index if not exists legit_users_seed on legit_users(is_seed, seed_batch) where is_seed;

-- Photo objects inside legit_users.photos (jsonb) gain OPTIONAL fields — no schema change needed:
--   {url, verified, scan: "passed"|"pending"|"rejected", scan_reason, desc: "AI photo description", taken: "EXIF date iso|null", attested12: true}
-- A profile earns the "No-Filter" badge (Spark gap #13) when it has >=1 photo and EVERY photo has scan = "passed".

-- ───────── Events (Spark gap #10) ─────────
create table if not exists legit_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  starts_at timestamptz not null,
  location_text text default '',          -- neighborhood / venue type, never a private address
  capacity integer not null default 20,   -- limited spots; spots_left = capacity - rsvp count
  created_by uuid references legit_users(id) on delete set null,
  cancelled boolean default false,
  created_at timestamptz default now()
);
create table if not exists legit_event_rsvps (
  event_id uuid not null references legit_events(id) on delete cascade,
  user_id uuid not null references legit_users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (event_id, user_id)
);
create index if not exists legit_events_upcoming on legit_events(starts_at) where not cancelled;

-- ───────── Re-match requests (Spark gap #15) ─────────
-- An expired match is REVIVED in place on accept (legit_matches has unique(user_a,user_b), so no second row).
create table if not exists legit_rematches (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references legit_matches(id) on delete cascade,
  requester_id uuid not null references legit_users(id) on delete cascade,
  status text default 'pending',          -- pending | accepted | declined
  created_at timestamptz default now(),
  resolved_at timestamptz,
  unique (match_id, requester_id)
);

-- ───────── Wingman video invites (Spark gap #11) ─────────
-- A user creates an invite; a friend (no account needed) opens /legit/wingman.html?t=<token>,
-- records a short vouching video, and wingman_submit stores it on the user's profile.
create table if not exists legit_wingman_invites (
  token text primary key,                 -- 32 hex chars, generated server-side
  user_id uuid not null references legit_users(id) on delete cascade,
  created_at timestamptz default now(),
  used_at timestamptz
);

alter table legit_events enable row level security;
alter table legit_event_rsvps enable row level security;
alter table legit_rematches enable row level security;
alter table legit_wingman_invites enable row level security;
