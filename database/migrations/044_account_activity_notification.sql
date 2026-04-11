-- Migration 044: Add account_activity notification type
-- Required for in-platform notifications when admin verifies or rejects a user's account.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'account_activity';
