-- Migration: 043_verification_documents_storage
-- Create the Supabase Storage bucket for verification document uploads.
--
-- Bucket: verification-documents
--   public      : true   (URLs are non-guessable; CAC certs are public business records)
--   file size   : 10 MB max (enforced in frontend + storage policy)
--   MIME types  : application/pdf, image/jpeg, image/png  (enforced in frontend)
--
-- Storage RLS:
--   * Authenticated users may INSERT files only under their own user-id prefix
--     ({userId}/... — enforced via auth.uid() lookup).
--   * Users may SELECT (download) and DELETE their own files.
--   * Service role bypasses all policies (admin review workflow).

-- ── 1. Create bucket ────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-documents',
  'verification-documents',
  true,
  10485760,   -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Storage RLS policies ──────────────────────────────────────────────────

-- Allow authenticated users to upload only into their own folder.
-- The file path must start with the user's internal UUID (users.id, not supabase_uid).
-- Pattern enforced: {userId}/{anything}
CREATE POLICY "Users upload own verification docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.users WHERE supabase_uid = auth.uid()
    )
  );

-- Allow authenticated users to read their own verification docs.
CREATE POLICY "Users read own verification docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.users WHERE supabase_uid = auth.uid()
    )
  );

-- Allow authenticated users to delete their own verification docs.
CREATE POLICY "Users delete own verification docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.users WHERE supabase_uid = auth.uid()
    )
  );

-- Service role (backend admin API) can manage all objects in this bucket.
-- This allows admin review and admin-initiated deletions without user context.
CREATE POLICY "Service role manages all verification docs"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'verification-documents');
