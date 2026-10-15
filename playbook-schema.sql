-- Potent Playbook — purchase records for playbook buyers.
-- Tony runs this in Supabase SQL editor himself.

CREATE TABLE playbook_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  product text NOT NULL,
  tier text,
  addon text,
  amount_cents int,
  stripe_session_id text NOT NULL,
  status text DEFAULT 'complete',
  created_at timestamptz DEFAULT now(),
  UNIQUE (stripe_session_id, product)
);

CREATE INDEX playbook_purchases_email_idx ON playbook_purchases (email);
