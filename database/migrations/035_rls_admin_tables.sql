-- =====================================================
-- Migration 035: Add Row Level Security to Admin Tables
--
-- Purpose: Defense-in-depth security for sensitive tables
-- Note: Backend uses service role key which bypasses RLS,
-- but policies provide protection if user context is used.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. platform_settings - Global configuration (single row)
-- =====================================================
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage platform_settings"
  ON platform_settings FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read platform_settings"
  ON platform_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- =====================================================
-- 2. admin_users - Admin role assignments
-- =====================================================
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage admin_users"
  ON admin_users FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read admin_users"
  ON admin_users FOR SELECT
  USING (auth.role() = 'authenticated');

-- =====================================================
-- 3. password_reset_otps - Authentication security
-- =====================================================
ALTER TABLE password_reset_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage password_reset_otps"
  ON password_reset_otps FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 4. push_notifications - Admin broadcasts
-- =====================================================
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage push_notifications"
  ON push_notifications FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read their own push_notifications"
  ON push_notifications FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    AND (
      target_type = 'all' 
      OR target_type = 'user' AND target_value = auth.uid()::text
    )
  );

-- =====================================================
-- 5. platform_activity_logs - Audit trail (append-only)
-- =====================================================
ALTER TABLE platform_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage platform_activity_logs"
  ON platform_activity_logs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read own activity logs"
  ON platform_activity_logs FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    AND actor_user_id = auth.uid()
  );

-- =====================================================
-- 6. promo_codes - Promotional codes
-- =====================================================
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage promo_codes"
  ON promo_codes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read active promo_codes"
  ON promo_codes FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    AND active = TRUE
  );

-- =====================================================
-- 7. subscription_transactions - Financial data
-- =====================================================
ALTER TABLE subscription_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage subscription_transactions"
  ON subscription_transactions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own transactions"
  ON subscription_transactions FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    AND user_id = auth.uid()
  );

-- =====================================================
-- 8. paystack_plan_catalog - Plan configuration
-- =====================================================
ALTER TABLE paystack_plan_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage paystack_plan_catalog"
  ON paystack_plan_catalog FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read active plans"
  ON paystack_plan_catalog FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    AND active = TRUE
  );

-- =====================================================
-- 9. webhook_events - Payment idempotency (append-only)
-- =====================================================
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage webhook_events"
  ON webhook_events FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 10. promo_redemptions - Promo usage tracking
-- =====================================================
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage promo_redemptions"
  ON promo_redemptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own redemptions"
  ON promo_redemptions FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    AND user_id = auth.uid()
  );

COMMIT;
