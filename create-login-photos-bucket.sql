-- create-login-photos-bucket.sql
-- Run this in Supabase (SQL editor) to enable login photo/audio uploads.
-- Creates the login-photos storage bucket and allows the app to upload and view files.

-- Create the bucket (public so photos display in the app)
INSERT INTO storage.buckets (id, name, public)
VALUES ('login-photos', 'login-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anyone to upload (the app uploads with the anon key at login)
DROP POLICY IF EXISTS "login-photos anon insert" ON storage.objects;
CREATE POLICY "login-photos anon insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'login-photos');

-- Allow anyone to view (photos show in login activity)
DROP POLICY IF EXISTS "login-photos public read" ON storage.objects;
CREATE POLICY "login-photos public read" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'login-photos');

SELECT 'login-photos bucket ready' AS status;
