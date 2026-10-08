-- Changes nothing. Shows exactly which database pieces exist. Every row should say true.
SELECT * FROM (
  SELECT 'A  license_invoices (part 68)' AS item, (to_regclass('public.license_invoices') IS NOT NULL) AS ok
  UNION ALL SELECT 'A  assist_sessions (part 70)', (to_regclass('public.assist_sessions') IS NOT NULL)
  UNION ALL SELECT 'A  ui_translations (part 71)', (to_regclass('public.ui_translations') IS NOT NULL)
  UNION ALL SELECT 'A  job_route_legs (part 72)', (to_regclass('public.job_route_legs') IS NOT NULL)
  UNION ALL SELECT 'A  job_events (part 72)', (to_regclass('public.job_events') IS NOT NULL)
  UNION ALL SELECT 'A  vendors (part 72)', (to_regclass('public.vendors') IS NOT NULL)
  UNION ALL SELECT 'A  properties (part 73)', (to_regclass('public.properties') IS NOT NULL)
  UNION ALL SELECT 'A  quote_terms_acceptance (part 73)', (to_regclass('public.quote_terms_acceptance') IS NOT NULL)
  UNION ALL SELECT 'A  jobs org_id (part 74)', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='org_id')
  UNION ALL SELECT 'B  rate_cards (part 75)', (to_regclass('public.rate_cards') IS NOT NULL)
  UNION ALL SELECT 'B  service_zones (part 75)', (to_regclass('public.service_zones') IS NOT NULL)
  UNION ALL SELECT 'B  job_templates (part 75)', (to_regclass('public.job_templates') IS NOT NULL)
  UNION ALL SELECT 'B  wallet org_id (part 76)', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='potent_wallets' AND column_name='org_id')
  UNION ALL SELECT 'B  wallet provider_ref (part 76)', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wallet_transactions' AND column_name='provider_ref')
  UNION ALL SELECT 'B  business_rules (part 78)', (to_regclass('public.business_rules') IS NOT NULL)
  UNION ALL SELECT 'B  payout_methods (part 78)', (to_regclass('public.payout_methods') IS NOT NULL)
) x ORDER BY ok, item;
