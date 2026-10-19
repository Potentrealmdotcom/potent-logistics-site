-- LEGIT dating app. Run ONCE in Supabase > SQL Editor > New query > paste > Run. Safe to run twice.
-- All tables are locked (no public policies): only the server (service key) can read or write them.

create table if not exists legit_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text not null,
  age integer not null,
  gender text,
  interested_in text[] default '{}',
  photos jsonb default '[]',            -- [{url, verified:false}] small JPEG data URLs
  body_type text,
  intent text,                           -- serious | casual | one_night
  tonight_intentions text[] default '{}',
  bio text default '',
  prompts jsonb default '[]',            -- [{question, answer}]
  pref_age_min integer default 18,
  pref_age_max integer default 99,
  pref_distance integer default 50,
  pref_body text[] default '{}',
  lat numeric, lng numeric,              -- rounded to ~11 km on purpose
  identity_verified boolean default false,
  verified_at timestamptz,
  stripe_verification_session_id text,
  trial_started_at timestamptz,
  paid_lifetime_access boolean default false,
  paid_at timestamptz,
  strike_count integer default 0,
  banned boolean default false,
  ban_source text,                       -- auto | admin
  is_admin boolean default false,
  last_seen timestamptz,
  created_at timestamptz default now()
);
create table if not exists legit_swipes (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references legit_users(id) on delete cascade,
  to_id uuid not null references legit_users(id) on delete cascade,
  kind text not null,                    -- like | super | pass
  created_at timestamptz default now(),
  unique (from_id, to_id)
);
create table if not exists legit_matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references legit_users(id) on delete cascade,
  user_b uuid not null references legit_users(id) on delete cascade,
  status text default 'active',          -- active | messaged | expired
  matched_at timestamptz default now(),
  fuse_expires_at timestamptz not null,
  first_message_sent boolean default false,
  chat_intention text, intention_by uuid,
  unique (user_a, user_b)
);
create table if not exists legit_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references legit_matches(id) on delete cascade,
  sender_id uuid not null references legit_users(id) on delete cascade,
  original_text text not null,           -- never sent to the other person
  displayed_text text not null,
  was_blocked boolean default false,
  block_reason text default 'none',
  is_opener boolean default false, opener_approved boolean default false,
  sent_at timestamptz default now()
);
create index if not exists legit_messages_match on legit_messages(match_id, sent_at);
create table if not exists legit_strikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references legit_users(id) on delete cascade,
  message_id uuid, match_id uuid,
  strike_no integer not null,
  reason text,
  conversation_snapshot jsonb,
  reviewed boolean default false,
  review_action text,                   -- dismissed | warned | banned | upheld
  review_note text,
  created_at timestamptz default now()
);
create table if not exists legit_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references legit_users(id) on delete cascade,
  reported_id uuid not null references legit_users(id) on delete cascade,
  reason text,
  status text default 'pending',        -- pending | reviewed_action_taken | reviewed_no_violation
  created_at timestamptz default now(), resolved_at timestamptz
);
create table if not exists legit_blocks (
  blocker uuid not null references legit_users(id) on delete cascade,
  blocked uuid not null references legit_users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker, blocked)
);
create table if not exists legit_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references legit_users(id) on delete cascade,
  kind text, body text, read boolean default false,
  created_at timestamptz default now()
);
create index if not exists legit_notif_user on legit_notifications(user_id, created_at desc);
create table if not exists legit_bill (
  match_id uuid not null references legit_matches(id) on delete cascade,
  user_id uuid not null references legit_users(id) on delete cascade,
  choice text not null,                 -- got_it | split | surprise
  primary key (match_id, user_id)
);
create table if not exists legit_loveboard (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references legit_users(id) on delete cascade,
  user_b uuid not null references legit_users(id) on delete cascade,
  match_id uuid,
  confirmed_a boolean default true, confirmed_b boolean default false,
  both_confirmed boolean default false,
  caption text, photo_url text, met_via text, time_together text,
  hidden boolean default false,
  posted_at timestamptz default now()
);
create table if not exists legit_lb_reactions (
  post_id uuid not null references legit_loveboard(id) on delete cascade,
  user_id uuid not null references legit_users(id) on delete cascade,
  kind text not null,                   -- heart | celebrate
  primary key (post_id, user_id, kind)
);
create table if not exists legit_lb_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references legit_loveboard(id) on delete cascade,
  user_id uuid not null references legit_users(id) on delete cascade,
  body text, created_at timestamptz default now()
);
create table if not exists legit_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references legit_users(id) on delete set null,
  stripe_session_id text unique not null,
  amount_cents integer, created_at timestamptz default now()
);
create table if not exists legit_admin_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid, action text, target text, note text, created_at timestamptz default now()
);
alter table legit_users enable row level security;
alter table legit_swipes enable row level security;
alter table legit_matches enable row level security;
alter table legit_messages enable row level security;
alter table legit_strikes enable row level security;
alter table legit_reports enable row level security;
alter table legit_blocks enable row level security;
alter table legit_notifications enable row level security;
alter table legit_bill enable row level security;
alter table legit_loveboard enable row level security;
alter table legit_lb_reactions enable row level security;
alter table legit_lb_comments enable row level security;
alter table legit_payments enable row level security;
alter table legit_admin_log enable row level security;

-- AFTER you create your own LEGIT account in the app, make yourself the admin (change the email if needed):
-- update legit_users set is_admin = true where email = 'capecodgp0421@gmail.com';

-- Step-by-step onboarding (optional "about me" answers; nothing here is required to use the app).
-- about: only the answers the person chose to share, e.g. {"drinking":"socially","kids":"open"}. Empty = shares nothing.
alter table legit_users add column if not exists about jsonb default '{}';
alter table legit_users add column if not exists onboarded_at timestamptz;
