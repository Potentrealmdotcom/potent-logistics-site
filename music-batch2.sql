-- POTENT Music batch 2 (already applied): preorders, collaborator records, support inbox. Safe to re-run.
alter table music_products add column if not exists preorder boolean not null default false, add column if not exists collaborators jsonb not null default '[]';
alter table music_tracks add column if not exists collaborators jsonb not null default '[]';
create table if not exists music_support (id uuid primary key default gen_random_uuid(), name text, email text not null, topic text, message text not null, status text not null default 'open', created_at timestamptz default now());
alter table music_support enable row level security;
