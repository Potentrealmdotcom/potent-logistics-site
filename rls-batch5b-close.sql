-- Batch 5B (Oct 21, 2026): RUN ONLY AFTER 5A has run AND the Netlify deploy of the commit "Staff records through the gateway" is Published.
-- employee_settings (pay rates and bank details), driver_availability, vehicle_availability: closed to the public key completely.
-- b2b_pricing_settings: the price list stays readable by everyone (customers need it); only the server can change it.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename = any (array['employee_settings','driver_availability','vehicle_availability','b2b_pricing_settings'])
      and (roles && array['anon','public']::name[])
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
create policy "public read price list" on public.b2b_pricing_settings for select to anon, authenticated using (true);
