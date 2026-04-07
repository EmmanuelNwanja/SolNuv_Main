-- Migration 029: Split 'free' paid plan into 'basic', introduce true free tier,
--               and add subscription_grace_until for 7-day soft expiry.
--
-- NOTE: ALTER TYPE ADD VALUE cannot be used and read in the same transaction.
-- Instead, we replace the enum type entirely (transactional-safe approach).

-- 1. Add grace period column
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_grace_until TIMESTAMPTZ;

COMMENT ON COLUMN companies.subscription_grace_until IS
  'Soft-expiry end: paid features remain accessible until this date even after subscription_expires_at has passed. Set to subscription_expires_at + 7 days on each activation.';

-- 2a. Create a new enum type that includes 'basic'
CREATE TYPE subscription_plan_new AS ENUM ('free', 'basic', 'pro', 'elite', 'enterprise');

-- 2b. Drop the default so the cast isn't blocked by the typed default expression
ALTER TABLE companies ALTER COLUMN subscription_plan DROP DEFAULT;

-- 2c. Swap the column to the new type
ALTER TABLE companies
  ALTER COLUMN subscription_plan TYPE subscription_plan_new
  USING subscription_plan::text::subscription_plan_new;

-- 2d. Drop the old type and rename the new one into its place
DROP TYPE subscription_plan;
ALTER TYPE subscription_plan_new RENAME TO subscription_plan;

-- 2e. Restore the default using the now-renamed type
ALTER TABLE companies ALTER COLUMN subscription_plan SET DEFAULT 'free';

-- 2. Rename paid 'free' plan records to 'basic'
--    Companies that have subscription_started_at set were on a real paid plan
--    (what the UI called "Basic" but the DB stored as 'free').
UPDATE companies
SET subscription_plan = 'basic'
WHERE subscription_plan = 'free'
  AND subscription_started_at IS NOT NULL;

-- 3. Mirror the rename in subscription_transactions history
UPDATE subscription_transactions
SET plan = 'basic'
WHERE plan = 'free';

-- 4. Set grace_until for currently active or recently expired subscribers
UPDATE companies
SET subscription_grace_until = subscription_expires_at + INTERVAL '7 days'
WHERE subscription_plan != 'free'
  AND subscription_expires_at IS NOT NULL;

-- 5. Update paystack_plan_catalog keys from 'free_*' → 'basic_*' (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'paystack_plan_catalog'
  ) THEN
    UPDATE paystack_plan_catalog
    SET plan_key = 'basic_' || SUBSTRING(plan_key FROM 6)
    WHERE plan_key LIKE 'free_%';
  END IF;
END $$;

-- 6. Update any admin_direct_payment_submissions that reference plan 'free' (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'admin_direct_payment_submissions'
  ) THEN
    UPDATE admin_direct_payment_submissions
    SET plan_id = 'basic'
    WHERE plan_id = 'free';
  END IF;
END $$;
