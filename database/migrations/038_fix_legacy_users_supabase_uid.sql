-- Migration: 038_fix_legacy_users_supabase_uid.sql
-- Directly links existing users to their Supabase auth accounts
-- Run this once to fix all legacy users

-- STEP 1: First, see what would be matched (preview)
-- SELECT u.id as user_id, u.email, u.first_name, u.is_onboarded, a.id as auth_id
-- FROM users u
-- JOIN auth.users a ON lower(trim(u.email)) = lower(trim(a.email))
-- WHERE u.supabase_uid IS NULL;

-- STEP 2: Link users to their auth accounts
UPDATE users u
SET supabase_uid = a.id
FROM auth.users a
WHERE lower(trim(u.email)) = lower(trim(a.email))
  AND u.supabase_uid IS NULL
  AND a.id IS NOT NULL;

-- STEP 3: Mark users with complete profiles as onboarded
UPDATE users
SET is_onboarded = true
WHERE first_name IS NOT NULL 
  AND first_name != ''
  AND user_type IS NOT NULL
  AND is_onboarded = false;

-- VERIFY: Check the results
SELECT 
  'Users with supabase_uid' as metric,
  COUNT(*) as count 
FROM users WHERE supabase_uid IS NOT NULL
UNION ALL
SELECT 
  'Users missing supabase_uid' as metric,
  COUNT(*) as count 
FROM users WHERE supabase_uid IS NULL
UNION ALL
SELECT 
  'Users onboarded' as metric,
  COUNT(*) as count 
FROM users WHERE is_onboarded = true;

-- DETAIL: Show users that were just linked
-- SELECT id, email, first_name, is_onboarded, supabase_uid 
-- FROM users 
-- WHERE supabase_uid IS NOT NULL 
-- ORDER BY updated_at DESC LIMIT 10;
