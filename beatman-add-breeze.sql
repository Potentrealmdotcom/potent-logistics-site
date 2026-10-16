-- Creates Breeze's Beat Man login. Run ONCE in Supabase > SQL Editor.
insert into beat_producers (name, email, password_hash, country)
values ('Breeze', 'breeze', 'scrypt$e3ce39ff27b89af9318c718e83fa304c$0ad731f4f119d62587024af57aa153201af29ebe0d8933b5534f622edfdb9d46', 'Venezuela')
on conflict (email) do update set password_hash = excluded.password_hash, active = true;
