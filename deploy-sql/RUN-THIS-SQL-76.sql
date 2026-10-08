-- SQL 76 — customer wallets move behind the server. Every customer account can have one prepaid wallet; balances change only through the server, each change leaves a ledger row.
ALTER TABLE public.potent_wallets      ADD COLUMN IF NOT EXISTS org_id TEXT;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS org_id TEXT;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS provider_ref TEXT;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS balance_after NUMERIC;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS actor TEXT;

DO $$ DECLARE potent text; BEGIN
  SELECT id::text INTO potent FROM public.organizations WHERE slug='potent-logistics' LIMIT 1;
  IF potent IS NOT NULL THEN
    UPDATE public.potent_wallets      SET org_id = potent WHERE org_id IS NULL;
    UPDATE public.wallet_transactions SET org_id = potent WHERE org_id IS NULL;
  END IF;
END $$;

-- one wallet per customer email per company (replaces the old email-only uniqueness)
ALTER TABLE public.potent_wallets DROP CONSTRAINT IF EXISTS potent_wallets_customer_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS potent_wallets_org_email_uq ON public.potent_wallets (org_id, customer_email);
-- one Stripe payment can fund a wallet only once
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_provider_ref_uq ON public.wallet_transactions (provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS wallet_tx_wallet_idx ON public.wallet_transactions (wallet_id, created_at DESC);
-- a balance can never go negative
ALTER TABLE public.potent_wallets DROP CONSTRAINT IF EXISTS potent_wallets_nonneg;
ALTER TABLE public.potent_wallets ADD CONSTRAINT potent_wallets_nonneg CHECK (available_balance >= 0) NOT VALID;

SELECT 'wallets ready (the public-key access is closed by LOCKDOWN-3, run last)' AS status;
