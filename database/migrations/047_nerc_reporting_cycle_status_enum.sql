-- ============================================================================
-- Migration 047: Harden NERC reporting cycle status to enum
-- Replaces free-text nerc_reporting_cycles.status with explicit enum values.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE nerc_reporting_cycle_status AS ENUM ('pending', 'submitted', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE nerc_reporting_cycles
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE nerc_reporting_cycles
  ALTER COLUMN status TYPE nerc_reporting_cycle_status
  USING (
    CASE
      WHEN status IN ('pending', 'submitted', 'overdue') THEN status::nerc_reporting_cycle_status
      ELSE 'pending'::nerc_reporting_cycle_status
    END
  );

ALTER TABLE nerc_reporting_cycles
  ALTER COLUMN status SET DEFAULT 'pending'::nerc_reporting_cycle_status;
