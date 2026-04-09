-- =====================================================
-- Migration 036: User Verification System
--
-- Purpose: Implement admin-based user verification
-- - New users start as 'unverified' 
-- - Existing active users are auto-verified
-- - Solo users: self-attestation
-- - Company users: CAC document upload + admin review
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Add verification fields to users table
-- =====================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'unverified';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;

-- =====================================================
-- 2. Backfill existing active users as verified
-- =====================================================

UPDATE users 
SET verification_status = 'verified', 
    verified_at = COALESCE(verified_at, created_at)
WHERE verification_status = 'unverified'
  AND is_active = TRUE;

-- =====================================================
-- 3. Create verification_documents table for CAC uploads
-- =====================================================

CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL, -- 'cac_certificate', 'solo_attestation'
  file_url TEXT NOT NULL,
  original_filename TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_docs_user ON verification_documents(user_id);

-- =====================================================
-- 4. Create platform_activity_logs entry for audit trail
-- =====================================================

COMMENT ON COLUMN users.verification_status IS 'unverified | pending | pending_admin_review | verified | rejected';
COMMENT ON COLUMN users.verification_requested_at IS 'When user requested verification';
COMMENT ON COLUMN users.verified_at IS 'When admin approved verification';
COMMENT ON COLUMN users.verified_by IS 'Admin user who approved verification';
COMMENT ON COLUMN users.verification_notes IS 'User-provided notes for verification request';
COMMENT ON COLUMN users.verification_rejection_reason IS 'Reason provided by admin when rejecting';

COMMIT;
