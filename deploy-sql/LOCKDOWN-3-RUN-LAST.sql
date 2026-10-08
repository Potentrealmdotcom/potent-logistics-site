-- ═══════════════════════════════════════════════════════════════════
-- LOCKDOWN 3 — RUN ONLY AFTER the new site is live and you have checked:
--   (1) you can sign in and open the Jobs tab; a test booking shows up
--   (2) a customer booking (signed out, from the public page) still creates a job
--   (3) a driver can open a job and add a photo
-- After this the public key can no longer read or change jobs, junk jobs,
-- job photos or the jobs backup. All access goes through the server.
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['jobs','junk_jobs','job_photos','jobs_backup'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      END LOOP;
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = 'public') AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('jobs','junk_jobs','job_photos','jobs_backup');

-- ── wallets: the public key can no longer read or change any balance ──
DROP POLICY IF EXISTS "anon_full_access_potent_wallets"      ON public.potent_wallets;
DROP POLICY IF EXISTS "anon_full_access_wallet_transactions" ON public.wallet_transactions;
ALTER TABLE public.potent_wallets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
SELECT 'wallets locked' AS status;
