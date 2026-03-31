-- =====================================================
-- SolNuv - Phone Verification OTPs
-- Supports registration phone verification before onboarding
-- =====================================================

CREATE TABLE IF NOT EXISTS phone_verification_otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uid UUID NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(25) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'sms',
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verification_otps_supabase_uid ON phone_verification_otps(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_phone_verification_otps_phone ON phone_verification_otps(phone);
CREATE INDEX IF NOT EXISTS idx_phone_verification_otps_expires ON phone_verification_otps(expires_at);
