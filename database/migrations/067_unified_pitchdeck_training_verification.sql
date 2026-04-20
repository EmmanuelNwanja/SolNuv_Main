-- Unified expansion:
-- 1) Pitchdeck content management + metric bindings
-- 2) Training institute verification datasets + request/audit flows
-- 3) Public professional/company search performance indexes
-- 4) Partner/user enum extension for training institute role

ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'training_institute';

CREATE TABLE IF NOT EXISTS pitch_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pitch_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES pitch_decks(id) ON DELETE CASCADE,
  slide_key TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(deck_id, slide_key)
);

CREATE INDEX IF NOT EXISTS idx_pitch_slides_deck_order
  ON pitch_slides(deck_id, order_index);

CREATE TABLE IF NOT EXISTS pitch_slide_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id UUID NOT NULL REFERENCES pitch_slides(id) ON DELETE CASCADE,
  card_key TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  card_type TEXT NOT NULL DEFAULT 'generic',
  title TEXT,
  body TEXT,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(slide_id, card_key)
);

CREATE INDEX IF NOT EXISTS idx_pitch_slide_cards_slide_order
  ON pitch_slide_cards(slide_id, order_index);

CREATE TABLE IF NOT EXISTS pitch_metric_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES pitch_decks(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  label TEXT,
  source_mode TEXT NOT NULL DEFAULT 'live'
    CHECK (source_mode IN ('live', 'manual', 'empty_fallback_live')),
  manual_value NUMERIC,
  live_endpoint TEXT,
  last_live_value NUMERIC,
  last_live_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(deck_id, metric_key)
);

CREATE TABLE IF NOT EXISTS training_institute_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES v2_organizations(id) ON DELETE CASCADE,
  website TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  country TEXT DEFAULT 'Nigeria',
  state TEXT,
  city TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'under_review')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_graduate_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES v2_organizations(id) ON DELETE CASCADE,
  imported_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source_filename TEXT,
  source_kind TEXT NOT NULL DEFAULT 'csv'
    CHECK (source_kind IN ('csv', 'xlsx', 'manual')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_import_batches_org
  ON training_graduate_import_batches(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS training_graduate_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES training_graduate_import_batches(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES v2_organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  full_name_normalized TEXT GENERATED ALWAYS AS (
    lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')))
  ) STORED,
  email_normalized TEXT GENERATED ALWAYS AS (lower(trim(coalesce(email, '')))) STORED,
  graduation_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_graduate_records_org_name
  ON training_graduate_records(organization_id, full_name_normalized);

CREATE INDEX IF NOT EXISTS idx_training_graduate_records_org_email
  ON training_graduate_records(organization_id, email_normalized);

CREATE TABLE IF NOT EXISTS competency_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code TEXT UNIQUE,
  requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES v2_organizations(id) ON DELETE SET NULL,
  graduate_record_id UUID REFERENCES training_graduate_records(id) ON DELETE SET NULL,
  source_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_mode IN ('manual', 'auto_match', 'user_submit_other')),
  match_confidence NUMERIC NOT NULL DEFAULT 0,
  match_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'cancelled')),
  decision_reason TEXT,
  decided_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  requested_training_institute_name TEXT,
  requested_training_institute_email TEXT,
  requested_training_institute_phone TEXT,
  requested_training_institute_country TEXT,
  requested_training_institute_state TEXT,
  requested_training_institute_address TEXT,
  requested_training_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competency_verification_requests_org_status
  ON competency_verification_requests(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_competency_verification_requests_target
  ON competency_verification_requests(target_user_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_competency_verification_requests_pending_dedupe
  ON competency_verification_requests(
    coalesce(target_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source_mode
  )
  WHERE status IN ('pending', 'under_review');

CREATE TABLE IF NOT EXISTS competency_verification_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_request_id UUID NOT NULL REFERENCES competency_verification_requests(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  notes TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competency_verification_audits_request
  ON competency_verification_audits(verification_request_id, created_at DESC);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS competency_verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (competency_verification_status IN ('unverified', 'verified', 'rejected', 'pending'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS competency_verified_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS competency_verified_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS competency_verification_request_id UUID REFERENCES competency_verification_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_public_profile_lookup
  ON users (lower(coalesce(first_name, '')), lower(coalesce(last_name, '')), lower(coalesce(email, '')));

CREATE INDEX IF NOT EXISTS idx_companies_public_lookup
  ON companies (lower(coalesce(name, '')), lower(coalesce(email, '')));
