-- ═══════════════════════════════════════════════════════════════════
-- SQL 69 — keeps each company's data separate from POTENT's.
-- RUN THIS BEFORE you upload the new site (Supabase > SQL Editor > paste > Run).
-- Safe to run twice. It does not delete or change any existing data except
-- stamping all rows that exist today as POTENT's own.
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE t text; potent text;
BEGIN
  SELECT id::text INTO potent FROM public.organizations WHERE slug = 'potent-logistics' LIMIT 1;
  IF potent IS NULL THEN
    RAISE EXCEPTION 'POTENT organization (slug potent-logistics) not found. Nothing was changed.';
  END IF;
  FOREACH t IN ARRAY ARRAY['fleet_vehicles','fleet_maintenance','driver_locations','voice_room_messages',
                           'driver_compliance','brokers_carriers_backup','storage_partners','safety_alerts','carrier_profiles'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id TEXT', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id)', t || '_org_idx', t);
      EXECUTE format('UPDATE public.%I SET org_id = %L WHERE org_id IS NULL', t, potent);
    END IF;
  END LOOP;
END $$;

-- Check: every table below should show 0 in "rows_without_company"
SELECT 'fleet_vehicles' AS tbl, count(*) FILTER (WHERE org_id IS NULL) AS rows_without_company FROM public.fleet_vehicles
UNION ALL SELECT 'voice_room_messages', count(*) FILTER (WHERE org_id IS NULL) FROM public.voice_room_messages
UNION ALL SELECT 'driver_locations', count(*) FILTER (WHERE org_id IS NULL) FROM public.driver_locations
UNION ALL SELECT 'carrier_profiles', count(*) FILTER (WHERE org_id IS NULL) FROM public.carrier_profiles;
