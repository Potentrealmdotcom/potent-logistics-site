-- STEP 0 — run this BEFORE RUN-THIS-ONCE.sql. It changes nothing. It only lists which required tables exist.
-- Every row must say "yes". If any row says "NO", do not continue: send me that table name.
SELECT t.name AS table_needed,
       CASE WHEN to_regclass('public.' || t.name) IS NOT NULL THEN 'yes' ELSE 'NO  <-- missing' END AS exists_now
FROM (VALUES ('organizations'),('org_users'),('jobs'),('junk_jobs'),('job_photos'),('potent_wallets'),('wallet_transactions'),
             ('fleet_vehicles'),('voice_room_messages'),('driver_locations'),('carrier_profiles'),('waitlist')) AS t(name)
ORDER BY 2, 1;
