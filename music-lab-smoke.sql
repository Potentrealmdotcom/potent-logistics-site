-- POTENT Beat Lab (engineer studio) + Smoke Sessions (live cypher rooms). Additive only.
-- All tables are reached only through Netlify functions with the service role (RLS on, no public policies).

-- ===== Beat Lab =====
create table if not exists music_engineers (
  user_id uuid primary key references music_users(id) on delete cascade,
  active boolean not null default true,
  quota_bytes bigint not null default 2147483648,
  granted_by text, created_at timestamptz not null default now());

create table if not exists lab_packs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references music_users(id) on delete cascade,
  name text not null, description text,
  visibility text not null default 'private' check (visibility in ('private','shared','public_requested','public')),
  license text, commercial_ok boolean not null default false, source text, restrictions text,
  archived boolean not null default false, created_at timestamptz not null default now());
create index if not exists lab_packs_owner on lab_packs(owner_user_id);

create table if not exists lab_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references music_users(id) on delete cascade,
  pack_id uuid references lab_packs(id) on delete set null,
  name text not null,
  kind text not null default 'sample' check (kind in ('drum','808','loop','sample','melody','vocal','fx','preset','other')),
  file_ref text not null, bytes bigint not null default 0, mime text,
  bpm numeric(6,2), musical_key text, genre text, tags text[] not null default '{}', description text,
  permission_status text not null default 'unverified' check (permission_status in ('original','licensed','cleared','unverified')),
  license text, source text, restrictions text, commercial_ok boolean not null default false,
  archived boolean not null default false, created_at timestamptz not null default now());
create index if not exists lab_assets_owner on lab_assets(owner_user_id, archived);
create index if not exists lab_assets_pack on lab_assets(pack_id);

create table if not exists lab_shares (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pack','project')),
  ref_id uuid not null,
  owner_user_id uuid not null references music_users(id) on delete cascade,
  shared_with_user_id uuid not null references music_users(id) on delete cascade,
  can_edit boolean not null default false, created_at timestamptz not null default now(),
  unique (kind, ref_id, shared_with_user_id));
create index if not exists lab_shares_with on lab_shares(shared_with_user_id);

create table if not exists lab_projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references music_users(id) on delete cascade,
  title text not null, artist_name text, song_title text,
  music_project_id uuid references music_projects(id) on delete set null,
  bpm numeric(6,2) not null default 120,
  data jsonb not null default '{}'::jsonb, notes text, credits jsonb not null default '[]'::jsonb,
  version int not null default 1, status text not null default 'active' check (status in ('active','archived')),
  export_ref text, exported_at timestamptz, handed_off_at timestamptz,
  marketplace_ready boolean not null default false, live_ready boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists lab_projects_owner on lab_projects(owner_user_id, status);

create table if not exists lab_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references lab_projects(id) on delete cascade,
  version int not null, data jsonb not null, note text, saved_by uuid, created_at timestamptz not null default now());
create index if not exists lab_versions_p on lab_versions(project_id, version desc);

create table if not exists lab_takes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references lab_projects(id) on delete cascade,
  owner_user_id uuid not null references music_users(id) on delete cascade,
  track text, file_ref text not null, bytes bigint not null default 0, seconds numeric(8,2), mime text,
  created_at timestamptz not null default now());
create index if not exists lab_takes_p on lab_takes(project_id);

create table if not exists lab_presets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references music_users(id) on delete cascade,
  kind text not null default 'preset' check (kind in ('preset','template')),
  name text not null, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());

-- ===== Smoke Sessions =====
create table if not exists smoke_sessions (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references music_users(id) on delete cascade,
  title text not null, description text,
  format text not null default 'cypher' check (format in ('cypher','open_mic','producer','studio','listen','beat_battle','lounge','guest')),
  visibility text not null default 'public' check (visibility in ('public','private','invite')),
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  starts_at timestamptz, started_at timestamptz, ended_at timestamptz,
  venue text, atmosphere text, invite_code text,
  chat_on boolean not null default true, voting_on boolean not null default false, reactions_on boolean not null default true,
  requests_on boolean not null default true, turn_seconds int not null default 60 check (turn_seconds between 15 and 600),
  recording text not null default 'off' check (recording in ('off','on')),
  stream_url text, stream_is_360 boolean not null default false,
  current_queue_id uuid, current_beat_id uuid, beat_started_at timestamptz, beat_paused boolean not null default false,
  rights_ack boolean not null default false,
  ticket_cents int, income_note text,
  created_at timestamptz not null default now());
create index if not exists smoke_sessions_st on smoke_sessions(status, starts_at);
create index if not exists smoke_sessions_host on smoke_sessions(host_user_id);

create table if not exists smoke_members (
  session_id uuid not null references smoke_sessions(id) on delete cascade,
  user_id uuid not null references music_users(id) on delete cascade,
  role text not null default 'audience' check (role in ('host','cohost','performer','producer','audience')),
  muted boolean not null default false, banned boolean not null default false, can_speak boolean not null default false,
  invited boolean not null default false, display_name text,
  joined_at timestamptz not null default now(), last_seen timestamptz not null default now(),
  primary key (session_id, user_id));

create table if not exists smoke_queue (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references smoke_sessions(id) on delete cascade,
  user_id uuid not null references music_users(id) on delete cascade,
  display_name text, status text not null default 'waiting' check (status in ('waiting','active','done','skipped','removed')),
  requested_at timestamptz not null default now(), started_at timestamptz, ended_at timestamptz,
  beat_id uuid, beat_title text);
create unique index if not exists smoke_queue_one_waiting on smoke_queue(session_id, user_id) where status in ('waiting','active');
create index if not exists smoke_queue_s on smoke_queue(session_id, status, requested_at);

create table if not exists smoke_beats (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references smoke_sessions(id) on delete cascade,
  added_by uuid references music_users(id) on delete set null,
  title text not null, producer_name text, audio_url text, source text not null default 'host_own' check (source in ('catalog','host_own','lab','requested')),
  catalog_beat_id uuid,
  status text not null default 'approved' check (status in ('requested','approved','rejected','played')),
  rights_basis text check (rights_basis in ('own_production','producer_permission','licensed','royalty_free')),
  rights_note text, played_at timestamptz, created_at timestamptz not null default now());
create index if not exists smoke_beats_s on smoke_beats(session_id, status);

create table if not exists smoke_messages (
  id bigserial primary key,
  session_id uuid not null references smoke_sessions(id) on delete cascade,
  user_id uuid not null references music_users(id) on delete cascade,
  display_name text, body text not null, created_at timestamptz not null default now());
create index if not exists smoke_messages_s on smoke_messages(session_id, id);

create table if not exists smoke_reactions (
  id bigserial primary key,
  session_id uuid not null references smoke_sessions(id) on delete cascade,
  user_id uuid not null references music_users(id) on delete cascade,
  emoji text not null, created_at timestamptz not null default now());
create index if not exists smoke_reactions_s on smoke_reactions(session_id, id);

create table if not exists smoke_votes (
  queue_id uuid not null references smoke_queue(id) on delete cascade,
  voter_user_id uuid not null references music_users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (queue_id, voter_user_id));

create table if not exists smoke_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references smoke_sessions(id) on delete set null,
  reporter_user_id uuid references music_users(id) on delete set null,
  target_user_id uuid, reason text not null, status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now());

create table if not exists smoke_blocks (
  user_id uuid not null references music_users(id) on delete cascade,
  blocked_user_id uuid not null references music_users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, blocked_user_id));

create table if not exists smoke_highlights (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references smoke_sessions(id) on delete cascade,
  queue_id uuid references smoke_queue(id) on delete set null,
  title text not null, note text, created_by uuid,
  performer_ok boolean not null default false, published boolean not null default false,
  created_at timestamptz not null default now());

create table if not exists smoke_follows (
  user_id uuid not null references music_users(id) on delete cascade,
  followed_user_id uuid not null references music_users(id) on delete cascade,
  session_id uuid, created_at timestamptz not null default now(), primary key (user_id, followed_user_id));

do $$ declare t text; begin
  foreach t in array array['music_engineers','lab_packs','lab_assets','lab_shares','lab_projects','lab_versions','lab_takes','lab_presets',
   'smoke_sessions','smoke_members','smoke_queue','smoke_beats','smoke_messages','smoke_reactions','smoke_votes','smoke_reports','smoke_blocks','smoke_highlights','smoke_follows']
  loop execute format('alter table %I enable row level security', t); end loop; end $$;

-- private bucket for engineer files (never public; every download is a short-lived signed link)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lab-files','lab-files',false,52428800, array['audio/wav','audio/x-wav','audio/wave','audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/flac','audio/x-flac','audio/ogg','audio/webm','audio/aiff','audio/x-aiff','video/webm'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
alter table lab_projects add column if not exists export_bytes bigint not null default 0;
