-- ============================================================
-- Migration 065: External API integrations + richer job applications
-- ============================================================

ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS resume_filename text,
  ADD COLUMN IF NOT EXISTS portfolio_label text;

CREATE TABLE IF NOT EXISTS external_integrations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name              text NOT NULL,
  target_system     text NOT NULL DEFAULT 'custom' CHECK (target_system IN ('nerc', 'nesrea', 'custom')),
  base_url          text NOT NULL,
  auth_type         text NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'bearer', 'api_key', 'basic')),
  auth_header_name  text,
  auth_secret       text,
  auth_username     text,
  default_headers   jsonb NOT NULL DEFAULT '{}'::jsonb,
  endpoints         jsonb NOT NULL DEFAULT '{}'::jsonb,
  timeout_ms        integer NOT NULL DEFAULT 15000,
  is_active         boolean NOT NULL DEFAULT true,
  last_tested_at    timestamptz,
  last_test_status  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_integrations_company
  ON external_integrations (company_id, is_active, created_at DESC);

ALTER TABLE external_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages external integrations" ON external_integrations FOR ALL USING (false);

CREATE TABLE IF NOT EXISTS external_integration_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id    uuid NOT NULL REFERENCES external_integrations(id) ON DELETE CASCADE,
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type        text NOT NULL,
  request_path      text,
  request_payload   jsonb,
  response_status   integer,
  response_body     text,
  error_message     text,
  dispatched_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_integration_logs_integration
  ON external_integration_logs (integration_id, created_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-applications',
  'job-applications',
  true,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users upload own job application docs" ON storage.objects;
CREATE POLICY "Users upload own job application docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-applications'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.users WHERE supabase_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own job application docs" ON storage.objects;
CREATE POLICY "Users read own job application docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-applications'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.users WHERE supabase_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anon upload job application docs" ON storage.objects;
CREATE POLICY "Anon upload job application docs"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'job-applications');

DROP POLICY IF EXISTS "Anon read job application docs" ON storage.objects;
CREATE POLICY "Anon read job application docs"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'job-applications');

DROP POLICY IF EXISTS "Service role manages all job application docs" ON storage.objects;
CREATE POLICY "Service role manages all job application docs"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'job-applications');
