ALTER TABLE project_feedback
  ADD COLUMN IF NOT EXISTS submission_key VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_feedback_submission_key_unique
  ON project_feedback(submission_key)
  WHERE submission_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_feedback_project_submitted_at
  ON project_feedback(project_id, submitted_at DESC);