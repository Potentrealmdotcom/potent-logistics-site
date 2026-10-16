-- LEGIT Wingman: stores only the user's own coaching preferences (tone, slang, liked replies). No chats or screenshots are stored.
alter table legit_users add column if not exists wingman_prefs jsonb default '{}'::jsonb;
