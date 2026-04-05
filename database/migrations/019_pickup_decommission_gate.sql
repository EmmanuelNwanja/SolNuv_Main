-- =====================================================
-- Migration 019: Pickup Request Decommission Gate
-- Adds recycler preference, admin approval fields, and
-- contact auto-population fields to recovery_requests.
-- =====================================================

ALTER TABLE recovery_requests
  ADD COLUMN IF NOT EXISTS preferred_recycler    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_name          TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone         TEXT,
  ADD COLUMN IF NOT EXISTS contact_email         TEXT,
  ADD COLUMN IF NOT EXISTS requester_company_name TEXT,
  ADD COLUMN IF NOT EXISTS project_summary       TEXT,
  ADD COLUMN IF NOT EXISTS decommission_approved      BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS decommission_approved_by   UUID         REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS decommission_approved_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_notes           TEXT;

-- Add 'approved' to the recovery_status enum if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'approved'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'recovery_status')
  ) THEN
    ALTER TYPE recovery_status ADD VALUE 'approved';
  END IF;
END$$;

-- Index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_recovery_requests_decommission_approved
  ON recovery_requests (decommission_approved)
  WHERE decommission_approved = FALSE;

CREATE INDEX IF NOT EXISTS idx_recovery_requests_status
  ON recovery_requests (status);
