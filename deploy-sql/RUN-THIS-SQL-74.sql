-- SQL 74 — job tables belong to one company each; heavy fee / weight columns; terms-version columns; photo stage
DO $$ DECLARE potent text; t text; BEGIN
  SELECT id::text INTO potent FROM public.organizations WHERE slug='potent-logistics' LIMIT 1;

  -- org_id on every core job table
  FOREACH t IN ARRAY ARRAY['jobs','junk_jobs','job_photos','jobs_backup'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id TEXT', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id)', t||'_org_idx', t);
    END IF;
  END LOOP;

  -- heavy items and weight, saved as their own fields (not buried in the total)
  IF to_regclass('public.jobs') IS NOT NULL THEN
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS heavy_fee NUMERIC DEFAULT 0;
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS heavy_lbs NUMERIC DEFAULT 0;
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS heavy_items JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS est_total_lbs NUMERIC;
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS trips INT;
  END IF;
  IF to_regclass('public.junk_jobs') IS NOT NULL THEN
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS heavy_fee NUMERIC DEFAULT 0;
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS heavy_lbs NUMERIC DEFAULT 0;
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS heavy_items JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS price_disposal NUMERIC;
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS price_travel NUMERIC;
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS est_total_lbs NUMERIC;
    ALTER TABLE public.junk_jobs ADD COLUMN IF NOT EXISTS trips INT;
  END IF;

  -- photo stage (arrival, before, after, disposal, complete) and time taken
  IF to_regclass('public.job_photos') IS NOT NULL THEN
    ALTER TABLE public.job_photos ADD COLUMN IF NOT EXISTS stage TEXT;
    ALTER TABLE public.job_photos ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- sign-up page records which agreement version was accepted
  IF to_regclass('public.waitlist') IS NOT NULL THEN
    ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS agreement_version TEXT;
    ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS agreed_at TIMESTAMPTZ;
  END IF;

  -- existing rows: photos take their job's company; everything else that has no company is POTENT's
  IF to_regclass('public.job_photos') IS NOT NULL AND to_regclass('public.jobs') IS NOT NULL THEN
    UPDATE public.job_photos p SET org_id = j.org_id::text FROM public.jobs j WHERE p.job_id = j.id::text AND p.org_id IS NULL AND j.org_id IS NOT NULL;
  END IF;
  IF potent IS NOT NULL THEN
    FOREACH t IN ARRAY ARRAY['jobs','junk_jobs','job_photos','jobs_backup'] LOOP
      IF to_regclass('public.'||t) IS NOT NULL THEN
        EXECUTE format('UPDATE public.%I SET org_id=%L WHERE org_id IS NULL', t, potent);
      END IF;
    END LOOP;
  END IF;
END $$;

SELECT 'job tables scoped to a company; weight columns ready' AS status;
