-- Changes nothing. Shows whether the main SQL really ran. Every row should say yes.
SELECT * FROM (
  SELECT 'table business_rules' AS item, (to_regclass('public.business_rules') IS NOT NULL) AS ok
  UNION ALL SELECT 'table payout_methods', (to_regclass('public.payout_methods') IS NOT NULL)
  UNION ALL SELECT 'table service_zones', (to_regclass('public.service_zones') IS NOT NULL)
  UNION ALL SELECT 'table job_templates', (to_regclass('public.job_templates') IS NOT NULL)
  UNION ALL SELECT 'table rate_cards', (to_regclass('public.rate_cards') IS NOT NULL)
  UNION ALL SELECT 'wallet org_id column', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='potent_wallets' AND column_name='org_id')
  UNION ALL SELECT 'wallet ledger provider_ref column', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wallet_transactions' AND column_name='provider_ref')
  UNION ALL SELECT 'reviews org_id column', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='org_id')
  UNION ALL SELECT 'claims org_id column', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='claims' AND column_name='org_id')
  UNION ALL SELECT 'expenses_real org_id column', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses_real' AND column_name='org_id')
  UNION ALL SELECT 'jobs payment_status column', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='payment_status')
) x ORDER BY ok, item;
