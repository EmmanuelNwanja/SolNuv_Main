-- =====================================================
-- SolNuv - Billing + Admin Upgrade
-- Adds annual subscriptions, promo codes, admin controls, and activity tracking
-- =====================================================

-- Company subscription metadata for annual billing + autorenew support
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS paystack_plan_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS paystack_subscription_email_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percent', -- percent | flat
  discount_value DECIMAL(10, 2) NOT NULL,
  max_redemptions INTEGER,
  redeemed_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  applies_to_plans TEXT[] DEFAULT ARRAY['pro', 'elite', 'enterprise'],
  applies_to_intervals TEXT[] DEFAULT ARRAY['monthly', 'annual'],
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  transaction_reference VARCHAR(120),
  discount_amount_ngn DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (promo_code_id, transaction_reference)
);

CREATE TABLE IF NOT EXISTS paystack_plan_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_key VARCHAR(50) UNIQUE NOT NULL, -- pro_monthly, pro_annual, etc.
  paystack_plan_code VARCHAR(100) NOT NULL,
  amount_kobo INTEGER NOT NULL,
  interval VARCHAR(20) NOT NULL, -- monthly | annual
  display_name VARCHAR(100) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  plan VARCHAR(30) NOT NULL,
  billing_interval VARCHAR(20) NOT NULL,
  amount_ngn DECIMAL(12, 2) NOT NULL,
  original_amount_ngn DECIMAL(12, 2) NOT NULL,
  discount_amount_ngn DECIMAL(12, 2) NOT NULL DEFAULT 0,
  promo_code VARCHAR(50),
  paystack_reference VARCHAR(120) UNIQUE,
  paystack_status VARCHAR(30),
  paystack_customer_code VARCHAR(100),
  paystack_subscription_code VARCHAR(100),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'operations', -- super_admin | analytics | finance | operations
  can_manage_admins BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  target_type VARCHAR(30) NOT NULL DEFAULT 'all', -- all | plan | company | user
  target_value VARCHAR(255),
  sent_by UUID REFERENCES users(id),
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'queued', -- queued | sent | failed
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID REFERENCES users(id),
  actor_email VARCHAR(255),
  action VARCHAR(120) NOT NULL,
  resource_type VARCHAR(80),
  resource_id VARCHAR(120),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_subscription_tx_reference ON subscription_transactions(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_subscription_tx_company ON subscription_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_activity_logs_action ON platform_activity_logs(action);

DROP TRIGGER IF EXISTS update_promo_codes_updated_at ON promo_codes;
CREATE TRIGGER update_promo_codes_updated_at
BEFORE UPDATE ON promo_codes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_paystack_plan_catalog_updated_at ON paystack_plan_catalog;
CREATE TRIGGER update_paystack_plan_catalog_updated_at
BEFORE UPDATE ON paystack_plan_catalog
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
BEFORE UPDATE ON admin_users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Starter promo examples (safe if rerun)
INSERT INTO promo_codes (code, description, discount_type, discount_value, max_redemptions, active, applies_to_plans, applies_to_intervals)
VALUES
  ('WELCOME10', '10% welcome discount', 'percent', 10, 5000, TRUE, ARRAY['pro', 'elite'], ARRAY['monthly', 'annual']),
  ('SOLAR5000', 'Flat NGN discount for annual plans', 'flat', 5000, 500, TRUE, ARRAY['pro', 'elite'], ARRAY['annual'])
ON CONFLICT (code) DO NOTHING;
