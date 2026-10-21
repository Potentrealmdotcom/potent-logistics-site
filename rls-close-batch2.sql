-- Batch 2 (Oct 21, 2026). Run in Supabase > SQL Editor.
-- Closes public (anon) access on 16 more tables. Safe because: 6 are never touched by browser code (server only), and the other 10 are
-- already reached by the app through the signed-in gateway (data-api), which uses the server key and checks the login first.
-- Effect: someone holding only the public key can no longer read or change these tables.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'brokers','carriers','customers','drivers','expenses','leads',
        'brokers_carriers_backup','driver_compliance','driver_locations','factoring_receivables','fleet_maintenance',
        'fleet_vehicles','job_scope_changes','safety_alerts','storage_partners','voice_room_messages'])
      and (roles && array['anon','public']::name[])
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
