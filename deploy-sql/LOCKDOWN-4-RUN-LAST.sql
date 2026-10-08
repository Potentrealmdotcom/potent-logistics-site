-- ═══════════════════════════════════════════════════════════════════
-- LOCKDOWN 4 — RUN ONLY AFTER SQL 77 AND the new site is live, and you have checked:
--   (1) sign in as owner: Expenses, Claims, Reports/Audit log, Wallets, Reviews admin all load
--   (2) signed out: leave a review, join the waitlist, submit a recurring request, upload a BOL — all still work
-- After this the public key can no longer READ the office tables. Signed-out forms can only ADD rows.
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE t text; p record;
BEGIN
  -- Office-only: no public access at all (the server gateway uses the service key)
  FOREACH t IN ARRAY ARRAY['audit_log_real','expenses_real','commission_rates_real','payment_references','cost_profiles','customer_rate_cards',
    'claims','change_orders','addon_authorizations','my_documents','deadlines','shift_handoffs','escalation_timers','site_profiles','customer_locations',
    'incoming_loads','user_display_names','revoked_users','os_prospects'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      END LOOP;
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
  END LOOP;
  -- Public forms: signed-out visitors may only ADD a row (reviews are also readable so the home page can show them)
  FOREACH t IN ARRAY ARRAY['receipts','job_communications','login_log','push_subscriptions','griffin_queries','recurring_routes','reviews','waitlist'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      END LOOP;
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('GRANT INSERT ON public.%I TO anon', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO anon WITH CHECK (true)', t || '_anon_insert', t);
    END IF;
  END LOOP;
  IF to_regclass('public.reviews') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON public.reviews TO anon';
    EXECUTE 'CREATE POLICY reviews_anon_read ON public.reviews FOR SELECT TO anon USING (true)';
  END IF;
END $$;
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname='public') AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('audit_log_real','expenses_real','claims','my_documents','waitlist','os_prospects','reviews','receipts','job_communications','recurring_routes')
ORDER BY 1;
