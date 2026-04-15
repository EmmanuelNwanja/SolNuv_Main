-- Migration 051: Ensure AI agent plan_minimum supports Basic tier.
-- Safe to run repeatedly.

ALTER TABLE ai_agent_definitions
  DROP CONSTRAINT IF EXISTS ai_agent_definitions_plan_minimum_check;

ALTER TABLE ai_agent_definitions
  ADD CONSTRAINT ai_agent_definitions_plan_minimum_check
  CHECK (plan_minimum IN ('free', 'basic', 'pro', 'elite', 'enterprise'));
