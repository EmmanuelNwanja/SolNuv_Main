-- Migration: 039_link_legacy_users.sql
-- Links existing users to their Supabase auth accounts by matching email

-- First, let's see how many users need linking
-- SELECT COUNT(*) FROM users WHERE supabase_uid IS NULL;

-- The backend code handles this automatically on login,
-- but you can run this to pre-link users:
--
-- Match users by email (case-insensitive) and link supabase_uid:
-- UPDATE users u
-- SET supabase_uid = a.id
-- FROM auth.users a
-- WHERE lower(u.email) = lower(a.email)
--   AND u.supabase_uid IS NULL
--   AND a.id IS NOT NULL;

-- Or to just see what would be matched:
-- SELECT u.id as user_id, u.email, a.id as auth_id
-- FROM users u
-- JOIN auth.users a ON lower(u.email) = lower(a.email)
-- WHERE u.supabase_uid IS NULL;
