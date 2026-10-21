-- Batch 6 (Oct 21, 2026): login_log can no longer be READ with the public key (it holds staff login photos, devices and locations).
-- Inserting stays open so the sign-in screen can record logins. The owner screens read it through the signed-in gateway. Safe to run now.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename = 'login_log' and cmd = 'SELECT' and (roles && array['anon','public']::name[])
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
