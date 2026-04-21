-- ============================================================================
-- Migration 070: Project Imported Design Reports (PVSyst parity bridge)
-- ============================================================================
-- Allows users to upload third-party design reports (e.g., PVSyst exports)
-- and persist these alongside SolNuv-native simulation reports.

CREATE TABLE IF NOT EXISTS project_imported_design_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'pvsyst',
  report_label TEXT NOT NULL DEFAULT 'imported',
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  file_path TEXT NOT NULL,
  file_public_url TEXT,
  parsed_summary JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imported_design_reports_project
  ON project_imported_design_reports(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_imported_design_reports_company
  ON project_imported_design_reports(company_id);

ALTER TABLE project_imported_design_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view imported reports for own scope"
  ON project_imported_design_reports FOR SELECT
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid())
    OR company_id IN (
      SELECT company_id FROM users WHERE supabase_uid = auth.uid() AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can insert imported reports for own scope"
  ON project_imported_design_reports FOR INSERT
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid())
    OR company_id IN (
      SELECT company_id FROM users WHERE supabase_uid = auth.uid() AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Service role manages imported reports"
  ON project_imported_design_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'design-report-imports',
  'design-report-imports',
  true,
  20971520,
  ARRAY[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own imported design reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'design-report-imports'
    AND (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM projects p
      JOIN users u ON u.supabase_uid = auth.uid()
      WHERE p.user_id = u.id OR (u.company_id IS NOT NULL AND p.company_id = u.company_id)
    )
  );

CREATE POLICY "Users read own imported design reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'design-report-imports'
    AND (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM projects p
      JOIN users u ON u.supabase_uid = auth.uid()
      WHERE p.user_id = u.id OR (u.company_id IS NOT NULL AND p.company_id = u.company_id)
    )
  );

CREATE POLICY "Service role manages imported design report objects"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'design-report-imports')
  WITH CHECK (bucket_id = 'design-report-imports');

