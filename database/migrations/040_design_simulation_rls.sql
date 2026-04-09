-- Migration: 040_design_simulation_rls
-- Enable Row Level Security on project design and simulation tables.
-- Without this, authenticated users can read any company's proprietary
-- project designs, financial simulations, and load profiles.

-- ─────────────────────────────────────────────
-- project_designs
-- ─────────────────────────────────────────────
ALTER TABLE project_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view designs for their accessible projects"
  ON project_designs FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid())
         OR company_id IN (
              SELECT company_id FROM users
              WHERE supabase_uid = auth.uid() AND company_id IS NOT NULL
            )
    )
  );

CREATE POLICY "Service role can manage all project designs"
  ON project_designs FOR ALL
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- simulation_results
-- ─────────────────────────────────────────────
ALTER TABLE simulation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view simulation results for their accessible projects"
  ON simulation_results FOR SELECT
  USING (
    project_design_id IN (
      SELECT pd.id FROM project_designs pd
      WHERE pd.project_id IN (
        SELECT id FROM projects
        WHERE user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid())
           OR company_id IN (
                SELECT company_id FROM users
                WHERE supabase_uid = auth.uid() AND company_id IS NOT NULL
              )
      )
    )
  );

CREATE POLICY "Service role can manage all simulation results"
  ON simulation_results FOR ALL
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- load_profiles
-- ─────────────────────────────────────────────
ALTER TABLE load_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view load profiles for their accessible projects"
  ON load_profiles FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid())
         OR company_id IN (
              SELECT company_id FROM users
              WHERE supabase_uid = auth.uid() AND company_id IS NOT NULL
            )
    )
  );

CREATE POLICY "Service role can manage all load profiles"
  ON load_profiles FOR ALL
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- load_profile_data
-- ─────────────────────────────────────────────
ALTER TABLE load_profile_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view load profile data for their accessible profiles"
  ON load_profile_data FOR SELECT
  USING (
    load_profile_id IN (
      SELECT lp.id FROM load_profiles lp
      WHERE lp.project_id IN (
        SELECT id FROM projects
        WHERE user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid())
           OR company_id IN (
                SELECT company_id FROM users
                WHERE supabase_uid = auth.uid() AND company_id IS NOT NULL
              )
      )
    )
  );

CREATE POLICY "Service role can manage all load profile data"
  ON load_profile_data FOR ALL
  USING (auth.role() = 'service_role');
