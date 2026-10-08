-- SQL 77 — the last tables that had no company column. Each row now belongs to one company; existing rows go to POTENT.
-- New rows that a signed-out public form adds (reviews, waitlist, recurring requests, receipts, notes...) default to POTENT.
DO $$
DECLARE t text; potent text;
BEGIN
  SELECT id::text INTO potent FROM public.organizations WHERE slug = 'potent-logistics' LIMIT 1;
  FOREACH t IN ARRAY ARRAY['audit_log_real','expenses_real','commission_rates_real','payment_references','cost_profiles','customer_rate_cards',
    'claims','change_orders','addon_authorizations','my_documents','deadlines','shift_handoffs','escalation_timers','site_profiles','customer_locations',
    'incoming_loads','user_display_names','revoked_users','receipts','job_communications','login_log','push_subscriptions','griffin_queries',
    'recurring_routes','reviews','waitlist','os_prospects'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id TEXT', t);
      IF potent IS NOT NULL THEN
        EXECUTE format('UPDATE public.%I SET org_id = %L WHERE org_id IS NULL', t, potent);
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET DEFAULT %L', t, potent);
      END IF;
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id)', t || '_org_idx', t);
    END IF;
  END LOOP;
END $$;
SELECT 'SQL 77 done: office tables now have a company column' AS status;
