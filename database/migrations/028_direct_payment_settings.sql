-- ─── Migration 028: Direct Bank Transfer Payment System ──────────────────────
-- Adds platform-managed bank account settings and a user submission table
-- for proof-of-payment verification by super admins.

-- ── 1. Platform bank account settings (single row, admin-managed) ─────────────
CREATE TABLE IF NOT EXISTS platform_payment_settings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  row_key                  TEXT NOT NULL DEFAULT 'bank_transfer' UNIQUE,  -- always 'bank_transfer'
  account_name             TEXT NOT NULL DEFAULT '',
  bank_name                TEXT NOT NULL DEFAULT '',
  account_number           TEXT NOT NULL DEFAULT '',
  additional_instructions  TEXT DEFAULT NULL,   -- e.g. "Use your email as payment reference"
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,  -- admin can disable bank transfer option
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by               UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Seed default row
INSERT INTO platform_payment_settings (row_key)
VALUES ('bank_transfer')
ON CONFLICT (row_key) DO NOTHING;

-- ── 2. User direct payment submissions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS direct_payment_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id           TEXT NOT NULL,                -- 'free' | 'pro' | 'elite' | 'enterprise'
  billing_interval  TEXT NOT NULL DEFAULT 'monthly',  -- 'monthly' | 'annual'
  amount_ngn        NUMERIC(12,2) NOT NULL,
  proof_url         TEXT DEFAULT NULL,            -- Supabase storage URL of uploaded receipt
  proof_type        TEXT DEFAULT NULL,            -- 'image' | 'pdf'
  reference_note    TEXT DEFAULT NULL,            -- user-supplied transfer reference/description
  status            TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'verified' | 'rejected'
  admin_note        TEXT DEFAULT NULL,            -- rejection reason or admin remarks
  reviewed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ DEFAULT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for admin review queue (pending first, newest first)
CREATE INDEX IF NOT EXISTS idx_direct_payments_status
  ON direct_payment_submissions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_payments_user
  ON direct_payment_submissions (user_id, created_at DESC);

-- ── 3. RLS: only the submitting user can read their own rows; admins bypass RLS ─
ALTER TABLE direct_payment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own submissions"
  ON direct_payment_submissions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own submissions"
  ON direct_payment_submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins use the service role key (bypasses RLS) for review operations.
