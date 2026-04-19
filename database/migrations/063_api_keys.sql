-- 063_api_keys.sql
--
-- Public API key management. Each row is a hashed key that a user (or
-- company) can use to call /api/v1/public/* endpoints. We never store the
-- plaintext secret — only its SHA-256 hash plus the first 8 chars for
-- display. Revocation is a soft delete (revoked_at timestamp).

CREATE TABLE IF NOT EXISTS api_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id       UUID REFERENCES companies(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  prefix           TEXT NOT NULL,                 -- first 8 chars of the secret, for display
  key_hash         TEXT NOT NULL UNIQUE,          -- SHA-256 of the full secret
  scopes           TEXT[] NOT NULL DEFAULT ARRAY['simulate:preview']::TEXT[],
  last_used_at     TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_company ON api_keys(company_id) WHERE revoked_at IS NULL;

COMMENT ON TABLE api_keys IS 'Public API keys for /api/v1/public/* endpoints. Secrets are SHA-256 hashed; the plaintext is only shown once at creation.';
COMMENT ON COLUMN api_keys.prefix IS 'First 8 chars of the plaintext secret (includes the ``sk_`` prefix); safe to show in UI for identification.';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hex digest of the full plaintext secret. Used for verification on every public API request.';
COMMENT ON COLUMN api_keys.scopes IS 'Permitted scopes (e.g. simulate:preview, tariffs:read). Enforced by apiKeyAuth middleware.';

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_keys_owner_select ON api_keys;
CREATE POLICY api_keys_owner_select ON api_keys
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS api_keys_owner_insert ON api_keys;
CREATE POLICY api_keys_owner_insert ON api_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS api_keys_owner_update ON api_keys;
CREATE POLICY api_keys_owner_update ON api_keys
  FOR UPDATE USING (user_id = auth.uid());

-- Usage log for API key requests. Retained for 90 days by a separate cron.
CREATE TABLE IF NOT EXISTS api_key_usage (
  id             BIGSERIAL PRIMARY KEY,
  api_key_id     UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  path           TEXT NOT NULL,
  method         TEXT NOT NULL,
  status_code    INTEGER,
  latency_ms     INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON api_key_usage(api_key_id, created_at DESC);
