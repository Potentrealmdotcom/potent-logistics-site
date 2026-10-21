-- Lets a driver application keep several pictures per document field. Safe to run more than once.
alter table public.driver_onboarding add column if not exists extra_docs jsonb;
