-- Migration: 039_verification_documents_rls
-- Enable Row Level Security on verification_documents.
-- Without this, any authenticated user could query CAC certificates and identity
-- documents uploaded by other users, exposing sensitive PII.

ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;

-- Users can view, insert, and delete their own documents only.
CREATE POLICY "Users can view own verification documents"
  ON verification_documents FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE supabase_uid = auth.uid()
    )
  );

CREATE POLICY "Users can insert own verification documents"
  ON verification_documents FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE supabase_uid = auth.uid()
    )
  );

CREATE POLICY "Users can delete own verification documents"
  ON verification_documents FOR DELETE
  USING (
    user_id IN (
      SELECT id FROM users WHERE supabase_uid = auth.uid()
    )
  );

-- Backend service role (used for admin verification workflows) bypasses user policies.
CREATE POLICY "Service role can manage all verification documents"
  ON verification_documents FOR ALL
  USING (auth.role() = 'service_role');
