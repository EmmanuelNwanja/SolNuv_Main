-- ============================================================================
-- Migration 023: Agent Knowledge Base & Custom Instructions
-- Adds knowledge documents and admin-editable instructions to agent definitions
-- ============================================================================

-- Knowledge base: array of documents admins can upload for contextual reasoning
-- Each entry: { "id": uuid, "title": "...", "content": "...", "added_at": "...", "added_by": "..." }
ALTER TABLE ai_agent_definitions
  ADD COLUMN IF NOT EXISTS knowledge_base JSONB NOT NULL DEFAULT '[]';

-- Custom instructions: non-core admin instructions appended after the system prompt
-- These are editable via the dashboard without touching the core prompt
ALTER TABLE ai_agent_definitions
  ADD COLUMN IF NOT EXISTS custom_instructions TEXT NOT NULL DEFAULT '';

-- Version tracking for audit trail on prompt/knowledge changes
ALTER TABLE ai_agent_definitions
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE ai_agent_definitions
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- ─── DONE ───────────────────────────────────────────────────────────────────
