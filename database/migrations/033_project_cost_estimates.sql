-- Migration: 033_project_cost_estimates
-- AI-powered project cost estimation with dynamic market prices

CREATE TABLE IF NOT EXISTS project_cost_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  estimate_name VARCHAR(255) NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}',
  ai_estimates JSONB DEFAULT '{}',
  outputs JSONB NOT NULL DEFAULT '{}',
  total_cost_ngn DECIMAL(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '60 days')
);

CREATE INDEX IF NOT EXISTS idx_cost_est_user ON project_cost_estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_est_project ON project_cost_estimates(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_est_expires ON project_cost_estimates(expires_at);

ALTER TABLE project_cost_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own cost estimates"
  ON project_cost_estimates
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
