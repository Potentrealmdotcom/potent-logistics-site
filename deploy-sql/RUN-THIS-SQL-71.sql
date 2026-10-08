-- SQL 71 — saved translations (each phrase is translated once, then reused for everyone).
-- Run BEFORE uploading the new site. Safe to run twice.
CREATE TABLE IF NOT EXISTS public.ui_translations (
  lang TEXT NOT NULL,
  src  TEXT NOT NULL,
  dst  TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (lang, src)
);
ALTER TABLE public.ui_translations ENABLE ROW LEVEL SECURITY;  -- no policies: only the server reads and writes it
REVOKE ALL ON public.ui_translations FROM anon;
SELECT 'SQL 71 ready' AS status;
