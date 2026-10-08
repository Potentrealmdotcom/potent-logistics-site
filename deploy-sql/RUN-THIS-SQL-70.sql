-- SQL 70 — Get Started checklist, trucking profile, send-from email, POTENT-assisted setup.
-- Run BEFORE uploading the new site. Safe to run twice.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS dot_number TEXT,
  ADD COLUMN IF NOT EXISTS mc_number TEXT,
  ADD COLUMN IF NOT EXISTS mail_from_name TEXT,
  ADD COLUMN IF NOT EXISTS mail_reply_to TEXT,
  ADD COLUMN IF NOT EXISTS assist_blocked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS setup_done JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.assist_sessions (
  id BIGSERIAL PRIMARY KEY,
  org_id TEXT NOT NULL,
  staff_uid TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);
ALTER TABLE public.assist_sessions ENABLE ROW LEVEL SECURITY;  -- no policies: only the server can read or write it
REVOKE ALL ON public.assist_sessions FROM anon;

SELECT 'SQL 70 ready' AS status;
