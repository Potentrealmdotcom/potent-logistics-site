-- ═══════════════════════════════════════════════════════════════════
-- RUN THIS LAST, only after you have signed in successfully on the new
-- deploy. It makes these tables unreadable with the public (anon) key.
-- After this, the only way to reach them is through the server
-- functions (auth.js / leads-api.js), which check a signed login.
--   leads, lead_activities, user_password_overrides, org_users, customer_accounts
-- If another site of yours (Lead Hunter, load board) reads `leads`
-- directly with the public key, it will stop working until it is
-- pointed at leads-api.
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads','lead_activities','user_password_overrides','org_users','customer_accounts'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      END LOOP;
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- Companies can read the organizations list but never change it with the public key.
-- (Plan, limits and status are changed only through the server, by the POTENT owner.)
REVOKE INSERT, UPDATE, DELETE ON public.organizations FROM anon;

-- Check: should list the four tables with rowsecurity = true and no policies
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = 'public') AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('leads','lead_activities','user_password_overrides','org_users','customer_accounts');
