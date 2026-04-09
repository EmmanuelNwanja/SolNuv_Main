-- Migration: 037_fix_existing_users_onboarding.sql
-- Fix is_onboarded for existing users who have completed onboarding
-- Users with first_name and user_type are considered onboarded

UPDATE users
SET is_onboarded = true
WHERE 
    -- Users with required onboarding fields
    (first_name IS NOT NULL AND first_name != '' AND user_type IS NOT NULL)
    -- Exclude users who explicitly set is_onboarded to false
    AND is_onboarded = false;

-- Log migration for audit (using correct column names)
INSERT INTO platform_activity_logs (action, details)
SELECT 
    'migration_executed' as action,
    json_build_object(
        'migration', '037_fix_existing_users_onboarding',
        'users_updated', (
            SELECT COUNT(*) FROM users 
            WHERE first_name IS NOT NULL AND first_name != '' AND user_type IS NOT NULL AND is_onboarded = true
        ),
        'executed_at', NOW()
    ) as details
WHERE EXISTS (
    SELECT 1 FROM users 
    WHERE first_name IS NOT NULL AND first_name != '' AND user_type IS NOT NULL AND is_onboarded = true
);
