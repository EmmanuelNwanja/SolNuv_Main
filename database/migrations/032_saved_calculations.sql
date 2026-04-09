-- Migration: 032_saved_calculations
-- Save calculator results to projects with 60-day expiry

CREATE TABLE IF NOT EXISTS saved_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  calculator_type VARCHAR(50) NOT NULL,
  input_params JSONB NOT NULL DEFAULT '{}',
  result_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '60 days'),
  name VARCHAR(255),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_saved_calc_user ON saved_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_calc_project ON saved_calculations(project_id);
CREATE INDEX IF NOT EXISTS idx_saved_calc_expires ON saved_calculations(expires_at);
CREATE INDEX IF NOT EXISTS idx_saved_calc_type ON saved_calculations(calculator_type);

ALTER TABLE saved_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own calculations"
  ON saved_calculations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
