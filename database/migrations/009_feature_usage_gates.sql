-- ============================================================
-- Migration 009: Feature Usage Gates
-- Calculator usage tracking + project export tracking
-- ============================================================

-- ── Calculator usage per user per month per type ──────────────
CREATE TABLE IF NOT EXISTS calculator_usage (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    uuid REFERENCES companies(id) ON DELETE SET NULL,
  calc_type     text NOT NULL,  -- 'panel','battery','degradation','roi','battery-soh','cable-size'
  period_year   smallint NOT NULL,
  period_month  smallint NOT NULL,
  use_count     int NOT NULL DEFAULT 1,
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calculator_usage_per_type_period UNIQUE (user_id, calc_type, period_year, period_month),
  CONSTRAINT valid_calc_type CHECK (calc_type IN ('panel','battery','degradation','roi','battery-soh','cable-size')),
  CONSTRAINT valid_month CHECK (period_month BETWEEN 1 AND 12)
);

CREATE INDEX IF NOT EXISTS idx_calculator_usage_user ON calculator_usage (user_id, period_year, period_month);

-- Row-level security: users can only see their own rows
ALTER TABLE calculator_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own usage" ON calculator_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Service role bypasses RLS for backend writes
-- (backend uses supabase service key, no RLS restriction needed)

-- ── Project export count per company per month ────────────────
-- Tracks how many times a project's reports have been exported this month.
-- Allows enforcing Pro plan's 2-exports-per-project monthly limit.
CREATE TABLE IF NOT EXISTS project_exports (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_type   text NOT NULL,  -- 'csv','excel','nesrea_pdf','certificate','roi_pdf','cable_pdf'
  period_year   smallint NOT NULL,
  period_month  smallint NOT NULL,
  exported_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_exports_project ON project_exports (project_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_project_exports_user ON project_exports (user_id, period_year, period_month);

ALTER TABLE project_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own exports" ON project_exports
  FOR SELECT USING (auth.uid() = user_id);
