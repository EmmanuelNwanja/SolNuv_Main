-- =====================================================
-- SolNuv - Engagement, Auth, and Notification Upgrade
-- Adds client feedback, public profiles, OTP password reset, and richer settings fields
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"email":false,"sms":true,"whatsapp":true,"push":true}',
  ADD COLUMN IF NOT EXISTS public_slug VARCHAR(120),
  ADD COLUMN IF NOT EXISTS public_bio TEXT,
  ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS branding_primary_color VARCHAR(20),
  ADD COLUMN IF NOT EXISTS company_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"email":false,"sms":true,"whatsapp":true,"push":true}';

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS feedback_token VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

CREATE TABLE IF NOT EXISTS project_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  client_name VARCHAR(255),
  client_email VARCHAR(255),
  client_phone VARCHAR(25),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  consent_to_showcase BOOLEAN NOT NULL DEFAULT TRUE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(25) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'sms', -- sms | whatsapp
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leaderboard_cache
  ADD COLUMN IF NOT EXISTS co2_avoided_kg DECIMAL(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_rating DECIMAL(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_feedbacks INTEGER DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_slug_unique ON users(public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_feedback_project ON project_feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_project_feedback_rating ON project_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_phone ON password_reset_otps(phone);
CREATE INDEX IF NOT EXISTS idx_projects_feedback_token ON projects(feedback_token);

UPDATE users
SET public_slug = lower(regexp_replace(COALESCE(brand_name, first_name || '-' || COALESCE(last_name, 'user')), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE public_slug IS NULL;

UPDATE users
SET public_slug = concat(public_slug, '-', substring(id::text, 1, 6))
WHERE public_slug IN (
  SELECT public_slug
  FROM users
  WHERE public_slug IS NOT NULL
  GROUP BY public_slug
  HAVING COUNT(*) > 1
);
