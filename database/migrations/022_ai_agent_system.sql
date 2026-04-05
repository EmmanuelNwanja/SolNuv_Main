-- ============================================================================
-- Migration 022: AI Agent System
-- Three-tier agent architecture for SolNuv platform
-- Tier 1: Internal Senior Agents (platform ops, invisible to users)
-- Tier 2: Customer Agents (Elite/Enterprise, company-scoped)
-- Tier 3: General Agents (Basic/Pro, shared support)
-- ============================================================================

-- ─── ENUMS ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE ai_agent_tier AS ENUM ('internal', 'customer', 'general');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_conversation_status AS ENUM ('active', 'completed', 'escalated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_task_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'escalated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_message_role AS ENUM ('system', 'user', 'assistant', 'tool_call', 'tool_result');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_escalation_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_escalation_status AS ENUM ('open', 'acknowledged', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─── 1. AI PROVIDERS ────────────────────────────────────────────────────────
-- Registry of LLM providers the platform can call (Gemini, Groq, etc.)

CREATE TABLE IF NOT EXISTS ai_providers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,               -- 'gemini', 'groq'
  name            TEXT NOT NULL,                      -- 'Google Gemini Flash'
  base_url        TEXT NOT NULL,                      -- API base endpoint
  api_key_env_var TEXT NOT NULL,                      -- env var name holding the key
  model_id        TEXT NOT NULL,                      -- 'gemini-2.0-flash', 'llama-3.3-70b-versatile'
  max_rpm         INT NOT NULL DEFAULT 15,            -- rate limit: requests per minute
  max_tokens_day  INT NOT NULL DEFAULT 1000000,       -- daily token budget
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  priority_order  INT NOT NULL DEFAULT 10,            -- lower = preferred (1 = first choice)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── 2. AI AGENT DEFINITIONS ────────────────────────────────────────────────
-- Blueprints for each agent type; managed by super admin via dashboard

CREATE TABLE IF NOT EXISTS ai_agent_definitions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     TEXT UNIQUE NOT NULL,           -- 'project-manager', 'seo-blog-writer'
  tier                     ai_agent_tier NOT NULL,         -- internal | customer | general
  name                     TEXT NOT NULL,                  -- human-readable name
  description              TEXT,                           -- what this agent does
  system_prompt            TEXT NOT NULL,                  -- LLM system prompt (the brain)
  capabilities             JSONB NOT NULL DEFAULT '[]',   -- allowed tool capability strings
  provider_slug            TEXT REFERENCES ai_providers(slug),
  fallback_provider_slug   TEXT REFERENCES ai_providers(slug),
  plan_minimum             TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_minimum IN ('free', 'pro', 'elite', 'enterprise')),
  max_instances_per_company INT NOT NULL DEFAULT 1,
  max_tokens_per_task      INT NOT NULL DEFAULT 4000,     -- max tokens for a single LLM call
  temperature              NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  response_format          TEXT NOT NULL DEFAULT 'text'
    CHECK (response_format IN ('text', 'json')),
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_by               UUID REFERENCES users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_def_tier ON ai_agent_definitions(tier);
CREATE INDEX IF NOT EXISTS idx_agent_def_plan ON ai_agent_definitions(plan_minimum);


-- ─── 3. AI AGENT INSTANCES ──────────────────────────────────────────────────
-- Agents assigned to companies; NULL company_id = internal platform agent

CREATE TABLE IF NOT EXISTS ai_agent_instances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id     UUID NOT NULL REFERENCES ai_agent_definitions(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES companies(id) ON DELETE CASCADE,  -- NULL for internal agents
  assigned_by       UUID REFERENCES users(id),
  config_overrides  JSONB NOT NULL DEFAULT '{}',   -- per-company tuning (extra context, etc.)
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (definition_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_inst_company ON ai_agent_instances(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_inst_active ON ai_agent_instances(is_active) WHERE is_active = TRUE;


-- ─── 4. AI CONVERSATIONS ────────────────────────────────────────────────────
-- Chat sessions between users and agents; stores context for training

CREATE TABLE IF NOT EXISTS ai_conversations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_instance_id   UUID NOT NULL REFERENCES ai_agent_instances(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id          UUID REFERENCES companies(id),
  title               TEXT,                               -- auto-generated or user-set
  context_type        TEXT CHECK (context_type IN ('project', 'report', 'financial', 'support', 'internal', 'general')),
  context_resource_id UUID,                               -- linked project/report id
  status              ai_conversation_status NOT NULL DEFAULT 'active',
  metadata            JSONB NOT NULL DEFAULT '{}',
  environment         TEXT NOT NULL DEFAULT 'test',       -- matches platform env pattern
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON ai_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conv_agent ON ai_conversations(agent_instance_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_company ON ai_conversations(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_conv_status ON ai_conversations(status) WHERE status = 'active';


-- ─── 5. AI MESSAGES ─────────────────────────────────────────────────────────
-- Every message in every conversation; this IS the training dataset

CREATE TABLE IF NOT EXISTS ai_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role              ai_message_role NOT NULL,             -- system | user | assistant | tool_call | tool_result
  content           TEXT,                                 -- message text (nullable for tool_call)
  tool_name         TEXT,                                 -- populated for tool_call / tool_result
  tool_input        JSONB,                                -- tool call arguments
  tool_output       JSONB,                                -- tool execution result
  tokens_used       INT NOT NULL DEFAULT 0,
  latency_ms        INT,                                  -- LLM response time
  provider_slug     TEXT,                                 -- which provider answered
  model_id          TEXT,                                 -- which model was used
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_msg_role ON ai_messages(role) WHERE role IN ('user', 'assistant');


-- ─── 6. AI TASKS ────────────────────────────────────────────────────────────
-- Async task queue: document digestion, report generation, cron jobs

CREATE TABLE IF NOT EXISTS ai_tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_instance_id   UUID NOT NULL REFERENCES ai_agent_instances(id) ON DELETE CASCADE,
  task_type           TEXT NOT NULL,                      -- 'digest_document', 'generate_report', 'cron_blog', etc.
  input_payload       JSONB NOT NULL DEFAULT '{}',
  output_payload      JSONB,
  status              ai_task_status NOT NULL DEFAULT 'queued',
  error_message       TEXT,
  tokens_used         INT NOT NULL DEFAULT 0,
  retries             INT NOT NULL DEFAULT 0,
  priority            INT NOT NULL DEFAULT 5,             -- 1 = highest priority
  created_by          UUID REFERENCES users(id),
  environment         TEXT NOT NULL DEFAULT 'test',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_queue ON ai_tasks(status, priority, created_at)
  WHERE status IN ('queued', 'processing');
CREATE INDEX IF NOT EXISTS idx_ai_tasks_agent ON ai_tasks(agent_instance_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_user ON ai_tasks(created_by) WHERE created_by IS NOT NULL;


-- ─── 7. AI TOKEN USAGE ─────────────────────────────────────────────────────
-- Daily budget tracking per tier per provider

CREATE TABLE IF NOT EXISTS ai_token_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  tier            ai_agent_tier NOT NULL,
  provider_slug   TEXT NOT NULL REFERENCES ai_providers(slug),
  tokens_used     INT NOT NULL DEFAULT 0,
  requests_made   INT NOT NULL DEFAULT 0,
  UNIQUE (date, tier, provider_slug)
);

CREATE INDEX IF NOT EXISTS idx_ai_token_date ON ai_token_usage(date DESC);


-- ─── 8. AI ESCALATIONS ─────────────────────────────────────────────────────
-- When agents escalate issues to human admins

CREATE TABLE IF NOT EXISTS ai_escalations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  task_id             UUID REFERENCES ai_tasks(id) ON DELETE SET NULL,
  agent_instance_id   UUID NOT NULL REFERENCES ai_agent_instances(id),
  user_id             UUID REFERENCES users(id),
  reason              TEXT NOT NULL,
  severity            ai_escalation_severity NOT NULL DEFAULT 'medium',
  status              ai_escalation_status NOT NULL DEFAULT 'open',
  admin_notes         TEXT,
  resolved_by         UUID REFERENCES users(id),
  environment         TEXT NOT NULL DEFAULT 'test',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_esc_status ON ai_escalations(status) WHERE status IN ('open', 'acknowledged');
CREATE INDEX IF NOT EXISTS idx_ai_esc_agent ON ai_escalations(agent_instance_id);


-- ─── 9. AI TOOL EXECUTIONS ─────────────────────────────────────────────────
-- Complete audit trail of every tool invocation by any agent

CREATE TABLE IF NOT EXISTS ai_tool_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID REFERENCES ai_messages(id) ON DELETE SET NULL,
  task_id         UUID REFERENCES ai_tasks(id) ON DELETE SET NULL,
  tool_name       TEXT NOT NULL,
  input_params    JSONB NOT NULL DEFAULT '{}',
  output_summary  TEXT,
  success         BOOLEAN NOT NULL DEFAULT TRUE,
  execution_ms    INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_exec_name ON ai_tool_executions(tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tool_exec_msg ON ai_tool_executions(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_tool_exec_task ON ai_tool_executions(task_id) WHERE task_id IS NOT NULL;


-- ─── RLS POLICIES ───────────────────────────────────────────────────────────
-- Users can read only their own conversations and messages
-- Admin has full access (via service role key on backend)

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_executions ENABLE ROW LEVEL SECURITY;

-- Conversations: users see their own
CREATE POLICY ai_conv_user_read ON ai_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY ai_conv_user_insert ON ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Messages: users see messages in their conversations
CREATE POLICY ai_msg_user_read ON ai_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM ai_conversations WHERE user_id = auth.uid()
    )
  );

-- Tasks: users see their own tasks
CREATE POLICY ai_task_user_read ON ai_tasks
  FOR SELECT USING (created_by = auth.uid());

-- Escalations: users see their own escalations
CREATE POLICY ai_esc_user_read ON ai_escalations
  FOR SELECT USING (user_id = auth.uid());

-- Tool executions: admin-only (no user RLS policy = no user access via client)
-- Backend service role bypasses RLS for all writes


-- ─── UPDATED_AT TRIGGERS ────────────────────────────────────────────────────
-- Reuse the existing trigger function from migration 001

CREATE TRIGGER set_updated_at_ai_agent_definitions
  BEFORE UPDATE ON ai_agent_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_ai_conversations
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── SEED: DEFAULT PROVIDERS ────────────────────────────────────────────────

INSERT INTO ai_providers (slug, name, base_url, api_key_env_var, model_id, max_rpm, max_tokens_day, is_active, priority_order) VALUES
  ('gemini',  'Google Gemini Flash',  'https://generativelanguage.googleapis.com/v1beta', 'GEMINI_API_KEY', 'gemini-2.0-flash',          15, 1000000, TRUE, 1),
  ('groq',    'Groq (Llama 3.3 70B)', 'https://api.groq.com/openai/v1',                  'GROQ_API_KEY',   'llama-3.3-70b-versatile',   30, 500000,  TRUE, 2)
ON CONFLICT (slug) DO NOTHING;


-- ─── DONE ───────────────────────────────────────────────────────────────────
-- Run this migration against Supabase SQL editor.
-- After running, verify: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ai_%';
