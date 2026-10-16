-- Beat tags, BPM and key for the POTENT Beats store (safe to run more than once)
alter table beat_items add column if not exists tags text[] default '{}';
alter table beat_items add column if not exists bpm int;
alter table beat_items add column if not exists musical_key text;
