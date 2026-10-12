-- create-login-log-table.sql
-- Run this in Supabase (SQL editor) to enable cross-device login tracking.
-- Creates the login_log table the app reads/writes for login activity, photos, and locations.

CREATE TABLE IF NOT EXISTS public.login_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT,
  actor_name TEXT,
  device_info TEXT,
  ip_address TEXT,
  location TEXT,
  photo_url TEXT,
  audio_url TEXT,
  org_id TEXT
);

-- Allow the app (anon key) to read and write login entries
ALTER TABLE public.login_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_log anon read" ON public.login_log;
CREATE POLICY "login_log anon read" ON public.login_log
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "login_log anon insert" ON public.login_log;
CREATE POLICY "login_log anon insert" ON public.login_log
  FOR INSERT TO anon WITH CHECK (true);

SELECT 'login_log table ready' AS status;
