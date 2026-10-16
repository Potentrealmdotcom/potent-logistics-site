-- Beat Man file uploads. Run ONCE in Supabase > SQL Editor. Safe to run twice.
insert into storage.buckets (id, name, public, file_size_limit)
values ('beat-previews', 'beat-previews', true, 52428800),
       ('beat-files', 'beat-files', false, 52428800)
on conflict (id) do nothing;
