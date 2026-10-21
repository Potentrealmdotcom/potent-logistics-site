-- Part 2 / RLS audit (Oct 20, 2026). Run in Supabase > SQL Editor (or approve the assistant's migration prompt).
-- These 28 tables are never touched by any browser code (verified by searching every front-end file); every use is in
-- netlify/functions with the service role, which bypasses RLS. Dropping their public (anon) policies changes nothing for the app.
-- user_password_overrides is the urgent one: with the public key, anyone could change a staff password.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'accessorial_charges','audit_trail','bol_templates','broker_requirements','carrier_credentials','carrier_documents','carrier_profiles',
        'carrier_submissions','commission_rates','customer_accounts','driver_documents','driver_onboarding','drivers_registry','export_logs',
        'flex_pay_installments','fuel_purchases','job_documents','lead_activities','maintenance_records','org_users','payroll_settings','plan_limits',
        'platform_audit','safety_records','settlements','trip_state_miles','user_password_overrides','vehicles'])
      and (roles && array['anon','public']::name[])
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
-- The driver-documents bucket: applicants may still upload, but not list, overwrite or delete.
drop policy if exists anon_upload_driver_documents on storage.objects;
create policy anon_upload_driver_documents on storage.objects for insert to anon with check (bucket_id = 'driver-documents');
-- Verify afterwards: select tablename, policyname from pg_policies where schemaname='public' and roles && array['anon','public']::name[] and (qual='true' or with_check='true');
