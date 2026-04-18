-- Partner portal: link pickups to recycler orgs; funding requests for financiers; lightweight SLA/audit events.
--
-- Prerequisites:
--   recovery_requests, projects, users → from 001_initial_schema.sql (and follow-on migrations as needed)
--   v2_organizations → from 050_v2_oracle_foundation.sql

DO $pre$
BEGIN
  IF to_regclass('public.recovery_requests') IS NULL THEN
    RAISE EXCEPTION
      'Table recovery_requests does not exist. Run database/migrations/001_initial_schema.sql (and any migrations that extend recovery_requests, e.g. 019_pickup_decommission_gate.sql) before 058_partner_portal.sql.';
  END IF;
  IF to_regclass('public.v2_organizations') IS NULL THEN
    RAISE EXCEPTION
      'Table v2_organizations does not exist. Run database/migrations/050_v2_oracle_foundation.sql before 058_partner_portal.sql.';
  END IF;
  IF to_regclass('public.projects') IS NULL THEN
    RAISE EXCEPTION
      'Table projects does not exist. Run database/migrations/001_initial_schema.sql before 058_partner_portal.sql.';
  END IF;
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION
      'Table users does not exist. Run database/migrations/001_initial_schema.sql before 058_partner_portal.sql.';
  END IF;
END
$pre$;

ALTER TABLE recovery_requests
  ADD COLUMN IF NOT EXISTS assigned_partner_org_id UUID REFERENCES v2_organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recovery_requests_assigned_partner_org
  ON recovery_requests (assigned_partner_org_id)
  WHERE assigned_partner_org_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS partner_funding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financier_organization_id UUID NOT NULL REFERENCES v2_organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'approved', 'declined', 'withdrawn')),
  design_share_url TEXT,
  portfolio_url TEXT,
  notes TEXT,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_funding_financier
  ON partner_funding_requests (financier_organization_id);

CREATE INDEX IF NOT EXISTS idx_partner_funding_project
  ON partner_funding_requests (project_id);

CREATE TABLE IF NOT EXISTS partner_portal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES v2_organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_portal_events_org_created
  ON partner_portal_events (organization_id, created_at DESC);
