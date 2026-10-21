-- Batch 4 (Oct 21, 2026): os_licenses and organizations. RUN ONLY AFTER the Netlify deploy of the commit "License sign-up and company lookup move to the server" is Published.
-- Before this, anyone with the public key could read or change every license and company record.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename = any (array['os_licenses','organizations'])
      and (roles && array['anon','public']::name[])
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
