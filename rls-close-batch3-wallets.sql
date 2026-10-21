-- Batch 3 (Oct 21, 2026): the team wallet / cashout tables. RUN THIS ONLY AFTER the Netlify deploy of commit "Team wallets move to the server" is Published.
-- Before this, anyone holding the public key could edit balances and payout requests. After it, only the server can.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename = any (array['team_wallets','team_wallet_txns','payout_requests'])
      and (roles && array['anon','public']::name[])
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
