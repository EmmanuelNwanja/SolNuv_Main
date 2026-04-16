-- =====================================================
-- Migration 051: SolNuv V2 Reliability Guardrails
-- Idempotency, callback replay protection, outbox, dead-letter.
-- =====================================================

CREATE TABLE IF NOT EXISTS v2_idempotency_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (endpoint_key, idempotency_key)
);

CREATE TABLE IF NOT EXISTS v2_callback_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  signature TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS v2_outbox_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  aggregate_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS v2_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  event_type TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_idempotency_created_at
  ON v2_idempotency_records(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v2_outbox_status_next
  ON v2_outbox_events(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_v2_dead_letter_failed_at
  ON v2_dead_letter_queue(failed_at DESC);

