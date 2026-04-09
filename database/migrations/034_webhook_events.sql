-- Migration: 034_webhook_events.sql
-- Purpose: Add webhook events table for idempotency tracking
-- This prevents duplicate processing of Paystack webhook events

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  reference TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_unique 
ON webhook_events(event_type, reference);

COMMENT ON TABLE webhook_events IS 'Tracks processed webhook events for idempotency';
COMMENT ON INDEX idx_webhook_events_unique IS 'Ensures each event type + reference combination is processed only once';
