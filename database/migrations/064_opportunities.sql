-- ============================================================
-- Migration 064: Jobs, contests, and opportunities
-- Public listing + interest/application capture with admin management.
-- ============================================================

CREATE TABLE IF NOT EXISTS opportunities (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                  text NOT NULL CHECK (type IN ('job', 'contest', 'opportunity')),
  status                text NOT NULL DEFAULT 'coming_soon' CHECK (status IN ('live', 'coming_soon', 'ended')),
  title                 text NOT NULL,
  slug                  text NOT NULL UNIQUE,
  summary               text,
  details               text,
  location              text,
  department            text,
  employment_type       text,
  compensation          text,
  cta_label             text,
  cta_url               text,
  starts_at             timestamptz,
  ends_at               timestamptz,
  application_deadline  timestamptz,
  sort_order            integer NOT NULL DEFAULT 0,
  is_published          boolean NOT NULL DEFAULT false,
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_public
  ON opportunities (is_published, status, type, sort_order, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunities_slug ON opportunities (slug);

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published opportunities" ON opportunities
  FOR SELECT USING (is_published = true);

CREATE TABLE IF NOT EXISTS opportunity_applications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id    uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  applicant_name    text NOT NULL,
  applicant_email   text NOT NULL,
  applicant_phone   text,
  applicant_company text,
  applicant_message text,
  resume_url        text,
  portfolio_url     text,
  status            text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'shortlisted', 'rejected', 'accepted')),
  reviewed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       timestamptz,
  submitted_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_apps_opportunity
  ON opportunity_applications (opportunity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_apps_status
  ON opportunity_applications (status, created_at DESC);

ALTER TABLE opportunity_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages opportunity applications" ON opportunity_applications
  FOR ALL USING (false);
