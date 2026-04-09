-- Migration 041: Normalize paid-plan grace windows and include Basic in AI plan constraints.

-- 1) Backfill missing grace windows for paid subscriptions.
UPDATE companies
SET subscription_grace_until = subscription_expires_at + INTERVAL '7 days'
WHERE subscription_plan != 'free'
  AND subscription_expires_at IS NOT NULL
  AND subscription_grace_until IS NULL;

-- 2) Allow 'basic' as a valid minimum plan in AI agent definitions.
ALTER TABLE ai_agent_definitions
  DROP CONSTRAINT IF EXISTS ai_agent_definitions_plan_minimum_check;

ALTER TABLE ai_agent_definitions
  ADD CONSTRAINT ai_agent_definitions_plan_minimum_check
  CHECK (plan_minimum IN ('free', 'basic', 'pro', 'elite', 'enterprise'));
