-- Manual fix for legacy users who login via Google OAuth
-- This script links existing users table records to their Supabase auth users

-- First, let's see users without supabase_uid
-- SELECT id, email, first_name, is_onboarded FROM users WHERE supabase_uid IS NULL;

-- This would need to be matched with auth.users table
-- For now, the backend code handles this automatically on login

-- If you want to manually fix specific users, uncomment and run:
-- UPDATE users SET supabase_uid = 'YOUR-SUPABASE-UID-HERE' WHERE email = 'user@example.com';

-- Or to find users who need fixing:
-- SELECT u.id as users_table_id, u.email, u.first_name, u.is_onboarded, a.id as auth_uid
-- FROM users u
-- JOIN auth.users a ON lower(a.email) = lower(u.email)
-- WHERE u.supabase_uid IS NULL;
