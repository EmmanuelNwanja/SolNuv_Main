-- Migration: 038_fix_legacy_users_supabase_uid.sql
-- Directly links existing users to their Supabase auth accounts
-- Run this once to fix all legacy users

-- This updates users table by matching email with auth.users table
UPDATE users u
SET supabase_uid = a.id
FROM auth.users a
WHERE lower(trim(u.email)) = lower(trim(a.email))
  AND u.supabase_uid IS NULL
  AND a.id IS NOT NULL;

-- Also mark all users with first_name as onboarded (they've completed onboarding)
UPDATE users
SET is_onboarded = true
WHERE first_name IS NOT NULL 
  AND first_name != ''
  AND user_type IS NOT NULL
  AND is_onboarded = false;

-- Verify the changes
SELECT 
  'Total users with supabase_uid' as metric,
  COUNT(*) as count 
FROM users WHERE supabase_uid IS NOT NULL
UNION ALL
SELECT 
  'Users still missing supabase_uid' as metric,
  COUNT(*) as count 
FROM users WHERE supabase_uid IS NULL
UNION ALL
SELECT 
  'Users marked as onboarded' as metric,
  COUNT(*) as count 
FROM users WHERE is_onboarded = true;
