-- ============================================================
-- Migration 018: Project History & Editable Equipment
-- Adds a project_history table that records every meaningful
-- change to a project or its equipment (create, update, delete).
-- ============================================================

-- 1. History table
CREATE TABLE IF NOT EXISTS project_history (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  changed_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  actor_name       TEXT,
  project_stage    VARCHAR(30),
  change_type      VARCHAR(50) NOT NULL,
  -- 'project_created' | 'project_updated' |
  -- 'equipment_added'  | 'equipment_updated' | 'equipment_removed'
  change_summary   TEXT,
  changed_fields   JSONB,
  -- { "field": { "from": old_val, "to": new_val }, ... }
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE project_history IS
  'Immutable audit trail of project and equipment changes. '
  'One row per meaningful change event.';

COMMENT ON COLUMN project_history.changed_fields IS
  'JSONB map of user-visible fields that changed. '
  'Each key maps to { "from": <old>, "to": <new> }.';

COMMENT ON COLUMN project_history.project_stage IS
  'Value of projects.status at the time this change was recorded.';

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_project_history_project_id
  ON project_history(project_id);

CREATE INDEX IF NOT EXISTS idx_project_history_created_at
  ON project_history(created_at DESC);
