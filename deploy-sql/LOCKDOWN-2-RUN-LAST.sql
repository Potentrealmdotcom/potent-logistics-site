-- ═══════════════════════════════════════════════════════════════════
-- LOCKDOWN 2 — RUN ONLY AFTER the new site is live and you have checked:
--   (1) you can sign in, see your trucks and send a chat message
--   (2) a partner can log in (DOT/MC + password)
--   (3) the customer tracking link still shows a driver
-- After this, the public key can no longer read or change these tables;
-- the only way in is through the server, which checks who is signed in.
-- Partner (carrier) passwords become unreachable to anyone but the server.
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['fleet_vehicles','fleet_maintenance','driver_locations','voice_room_messages',
                           'driver_compliance','brokers_carriers_backup','storage_partners','safety_alerts','carrier_profiles'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      END LOOP;
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- Check: all nine should show rls_on = true and policies = 0
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = 'public') AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('fleet_vehicles','fleet_maintenance','driver_locations','voice_room_messages','driver_compliance','brokers_carriers_backup','storage_partners','safety_alerts','carrier_profiles');
