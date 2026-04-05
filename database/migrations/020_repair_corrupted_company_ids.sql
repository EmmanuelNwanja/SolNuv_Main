-- =====================================================
-- Migration 020: Repair Corrupted Company Associations
-- 
-- Bug: createOrUpdateProfile previously did an email-based company lookup
-- for ALL saves (not just new registrations). If a registered-business user
-- had a company created with a different email than their Supabase auth email,
-- the lookup would fail → a brand-new free company was inserted → the user's
-- company_id was overwritten → paid subscription plan reverted to 'free'.
--
-- This migration attempts to re-associate affected users:
--   1. Identifies users whose company has subscription_plan = 'free' BUT who
--      have a paid transaction in subscription_transactions.
--   2. Re-points their company_id to the company referenced in the most recent
--      paid transaction (which is the original company the payment was for).
--   3. Marks the orphaned free company for review (does NOT delete it).
-- =====================================================

BEGIN;

-- Step 1: Find users who appear to be on the wrong company.
-- A user is "corrupted" if:
--   - Their current company is on a free plan, AND
--   - They have a paid subscription_transaction pointing to a different company_id
WITH paid_txns AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    company_id      AS paid_company_id,
    plan            AS paid_plan,
    paid_at
  FROM subscription_transactions
  WHERE plan != 'free'
    AND paystack_status IN ('success', 'completed')
  ORDER BY user_id, paid_at DESC
),
corrupted AS (
  SELECT
    u.id                  AS user_id,
    u.company_id          AS current_company_id,
    c.subscription_plan   AS current_plan,
    pt.paid_company_id,
    pt.paid_plan
  FROM users u
  JOIN companies c       ON c.id = u.company_id
  JOIN paid_txns pt      ON pt.user_id = u.id
  WHERE c.subscription_plan = 'free'
    AND pt.paid_company_id IS NOT NULL
    AND pt.paid_company_id != u.company_id
)
-- Step 2: Re-associate users to their paid company
UPDATE users u
SET
  company_id = cr.paid_company_id,
  updated_at = NOW()
FROM corrupted cr
WHERE u.id = cr.user_id;

-- Step 3: Tag orphaned free companies created by the bug so admins can review them.
-- These are companies where:
--   - subscription_plan = 'free'
--   - No user currently points to them
--   - They were created after the billing system launched (adjust date if needed)
WITH orphaned AS (
  SELECT c.id
  FROM companies c
  LEFT JOIN users u ON u.company_id = c.id
  WHERE c.subscription_plan = 'free'
    AND u.id IS NULL
    AND c.created_at > '2024-01-01'
)
UPDATE companies
SET name = CONCAT('[ORPHANED] ', name)
WHERE id IN (SELECT id FROM orphaned)
  AND name NOT LIKE '[ORPHANED]%';

COMMIT;
