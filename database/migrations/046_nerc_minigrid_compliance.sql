-- ============================================================================
-- Migration 046: NERC Mini-Grid Compliance (NERC-R-001-2026)
-- Adds additive regulatory tables for classification, permit/registration
-- workflows, SLA tracking, and periodic reporting cycles.
-- ============================================================================

-- ─── ENUMS ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE nerc_mini_grid_type AS ENUM ('isolated', 'interconnected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nerc_regulatory_pathway AS ENUM ('registration', 'permit_required');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nerc_application_status AS ENUM (
    'draft',
    'submitted',
    'in_review',
    'changes_requested',
    'approved',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nerc_reporting_cadence AS ENUM ('annual', 'quarterly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nerc_submission_status AS ENUM ('submitted', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 1) PROJECT REGULATORY PROFILE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_regulatory_profiles (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                    UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  mini_grid_type                nerc_mini_grid_type,
  declared_capacity_kw          DECIMAL(12,2),
  regulatory_pathway            nerc_regulatory_pathway NOT NULL DEFAULT 'registration',
  permit_required               BOOLEAN NOT NULL DEFAULT FALSE,
  requires_nerc_reporting       BOOLEAN NOT NULL DEFAULT TRUE,
  reporting_cadence             nerc_reporting_cadence NOT NULL DEFAULT 'annual',
  permit_threshold_kw           DECIMAL(12,2) NOT NULL DEFAULT 100,
  annual_reporting_threshold_kw DECIMAL(12,2) NOT NULL DEFAULT 1000,
  regulation_version            TEXT NOT NULL DEFAULT 'NERC-R-001-2026',
  is_active                     BOOLEAN NOT NULL DEFAULT TRUE,
  notes                         TEXT,
  created_by                    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_profiles_project ON project_regulatory_profiles(project_id);
CREATE INDEX IF NOT EXISTS idx_reg_profiles_pathway ON project_regulatory_profiles(regulatory_pathway);
CREATE INDEX IF NOT EXISTS idx_reg_profiles_cadence ON project_regulatory_profiles(reporting_cadence);

-- ─── 2) NERC APPLICATIONS (PERMIT/REGISTRATION FILES) ───────────────────────
CREATE TABLE IF NOT EXISTS nerc_applications (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  regulatory_profile_id       UUID REFERENCES project_regulatory_profiles(id) ON DELETE SET NULL,
  application_type            nerc_regulatory_pathway NOT NULL,
  status                      nerc_application_status NOT NULL DEFAULT 'draft',
  title                       TEXT NOT NULL DEFAULT 'NERC Filing',
  application_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  checklist_payload           JSONB NOT NULL DEFAULT '[]'::jsonb,
  regulator_reference         TEXT,
  regulator_decision_note     TEXT,
  submitted_at                TIMESTAMPTZ,
  review_started_at           TIMESTAMPTZ,
  reviewed_at                 TIMESTAMPTZ,
  approved_at                 TIMESTAMPTZ,
  rejected_at                 TIMESTAMPTZ,
  sla_due_at                  TIMESTAMPTZ,
  sla_breached                BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_by                UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by                 UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nerc_apps_project ON nerc_applications(project_id);
CREATE INDEX IF NOT EXISTS idx_nerc_apps_status ON nerc_applications(status);
CREATE INDEX IF NOT EXISTS idx_nerc_apps_sla_due ON nerc_applications(sla_due_at);

-- ─── 3) NERC REPORTING CYCLES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nerc_reporting_cycles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  regulatory_profile_id       UUID REFERENCES project_regulatory_profiles(id) ON DELETE SET NULL,
  cadence                     nerc_reporting_cadence NOT NULL,
  period_start                DATE NOT NULL,
  period_end                  DATE NOT NULL,
  due_date                    DATE NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'pending', -- pending | submitted | overdue
  report_payload              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_scheduler        BOOLEAN NOT NULL DEFAULT TRUE,
  submitted_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, cadence, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_nerc_cycles_project ON nerc_reporting_cycles(project_id);
CREATE INDEX IF NOT EXISTS idx_nerc_cycles_due_date ON nerc_reporting_cycles(due_date);
CREATE INDEX IF NOT EXISTS idx_nerc_cycles_status ON nerc_reporting_cycles(status);

-- ─── 4) NERC SUBMISSION EVENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nerc_submission_events (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporting_cycle_id          UUID NOT NULL REFERENCES nerc_reporting_cycles(id) ON DELETE CASCADE,
  project_id                  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  submission_status           nerc_submission_status NOT NULL DEFAULT 'submitted',
  submission_payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  regulator_reference         TEXT,
  regulator_message           TEXT,
  submitted_by                UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nerc_submissions_cycle ON nerc_submission_events(reporting_cycle_id);
CREATE INDEX IF NOT EXISTS idx_nerc_submissions_project ON nerc_submission_events(project_id);

-- ─── 5) UPDATED_AT TRIGGERS ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_project_regulatory_profiles_updated
    BEFORE UPDATE ON project_regulatory_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_nerc_applications_updated
    BEFORE UPDATE ON nerc_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_nerc_reporting_cycles_updated
    BEFORE UPDATE ON nerc_reporting_cycles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 6) BACKFILL EXISTING PROJECTS ───────────────────────────────────────────
INSERT INTO project_regulatory_profiles (
  project_id,
  mini_grid_type,
  declared_capacity_kw,
  regulatory_pathway,
  permit_required,
  reporting_cadence,
  created_at,
  updated_at
)
SELECT
  p.id,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM project_designs pd
      WHERE pd.project_id = p.id AND pd.grid_topology = 'off_grid'
    ) THEN 'isolated'::nerc_mini_grid_type
    ELSE 'interconnected'::nerc_mini_grid_type
  END,
  COALESCE(p.capacity_kw, 0),
  CASE WHEN COALESCE(p.capacity_kw, 0) > 100 THEN 'permit_required'::nerc_regulatory_pathway ELSE 'registration'::nerc_regulatory_pathway END,
  CASE WHEN COALESCE(p.capacity_kw, 0) > 100 THEN TRUE ELSE FALSE END,
  CASE WHEN COALESCE(p.capacity_kw, 0) >= 1000 THEN 'quarterly'::nerc_reporting_cadence ELSE 'annual'::nerc_reporting_cadence END,
  NOW(),
  NOW()
FROM projects p
WHERE NOT EXISTS (
  SELECT 1
  FROM project_regulatory_profiles r
  WHERE r.project_id = p.id
);
