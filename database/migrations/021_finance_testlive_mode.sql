-- =====================================================
-- Migration 021: Enhanced Finance, Admin Upgrades & Test/Live Mode
--
-- 1. Extend subscription_transactions with payment_channel, admin_details, coupon metadata
-- 2. Add platform_settings table for global test/live mode toggle
-- 3. Add environment column to all major tables for data separation
-- =====================================================

BEGIN;

-- =====================================================
-- 1. PLATFORM SETTINGS (test/live mode, global config)
-- =====================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  key         VARCHAR(80) PRIMARY KEY,
  value       JSONB       NOT NULL DEFAULT '{}',
  updated_by  UUID        REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default: test mode (all existing data is test data)
INSERT INTO platform_settings (key, value) VALUES
  ('environment_mode', '{"mode": "test", "switched_at": null, "switched_by": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 2. EXTEND SUBSCRIPTION_TRANSACTIONS
-- =====================================================

-- Payment channel: paystack | direct_transfer | coupon_only | admin_grant
ALTER TABLE subscription_transactions
  ADD COLUMN IF NOT EXISTS payment_channel       VARCHAR(40)  DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS admin_upgraded_by      UUID         REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS admin_upgrade_reason   TEXT,
  ADD COLUMN IF NOT EXISTS bank_confirmed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bank_reference         VARCHAR(200),
  ADD COLUMN IF NOT EXISTS coupon_code_used       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS coupon_discount_value  DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_discount_type   VARCHAR(10),
  ADD COLUMN IF NOT EXISTS environment            VARCHAR(10)  NOT NULL DEFAULT 'test';

-- Backfill existing transactions: Paystack-sourced ones stay 'paystack' channel
UPDATE subscription_transactions
  SET payment_channel = 'paystack'
  WHERE payment_channel IS NULL AND paystack_reference IS NOT NULL;

-- =====================================================
-- 3. ADD ENVIRONMENT COLUMN TO MAJOR TABLES
-- =====================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS environment VARCHAR(10) NOT NULL DEFAULT 'test';

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS environment VARCHAR(10) NOT NULL DEFAULT 'test';

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS environment VARCHAR(10) NOT NULL DEFAULT 'test';

ALTER TABLE platform_activity_logs
  ADD COLUMN IF NOT EXISTS environment VARCHAR(10) NOT NULL DEFAULT 'test';

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS environment VARCHAR(10) NOT NULL DEFAULT 'test';

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS environment VARCHAR(10) NOT NULL DEFAULT 'test';

ALTER TABLE promo_redemptions
  ADD COLUMN IF NOT EXISTS environment VARCHAR(10) NOT NULL DEFAULT 'test';

ALTER TABLE push_notifications
  ADD COLUMN IF NOT EXISTS environment VARCHAR(10) NOT NULL DEFAULT 'test';

-- =====================================================
-- 4. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_subscription_tx_channel
  ON subscription_transactions (payment_channel);

CREATE INDEX IF NOT EXISTS idx_subscription_tx_environment
  ON subscription_transactions (environment);

CREATE INDEX IF NOT EXISTS idx_users_environment
  ON users (environment);

CREATE INDEX IF NOT EXISTS idx_companies_environment
  ON companies (environment);

CREATE INDEX IF NOT EXISTS idx_projects_environment
  ON projects (environment);

CREATE INDEX IF NOT EXISTS idx_platform_activity_logs_environment
  ON platform_activity_logs (environment);

COMMIT;
