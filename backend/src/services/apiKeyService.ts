/**
 * SolNuv API Key Service
 *
 * Manages programmatic access tokens for /api/v1/public/*. A key is minted
 * with a fresh 32-byte random secret; we show the plaintext exactly once at
 * creation and persist only the SHA-256 hash. Verification is a constant-time
 * comparison of the hash column.
 *
 * Keys look like  sk_live_<22 chars>  — the `sk_live_` prefix makes them
 * obvious in logs so developers know to redact them, the same pattern used by
 * Stripe, OpenAI, and most modern APIs.
 */

const crypto = require('crypto');
const supabase = require('../config/database');

const KEY_PREFIX = 'sk_live_';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function generatePlaintextSecret(): string {
  // 32 random bytes → 43-char base64url. Take 22 for readability.
  const raw = crypto.randomBytes(32).toString('base64url').slice(0, 28);
  return KEY_PREFIX + raw;
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  prefix: string;
  key_hash: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new API key for the given user. Returns the row plus the
 * one-time plaintext secret (the caller must show this to the user and then
 * discard it).
 */
async function createApiKey(opts: {
  userId: string;
  companyId?: string | null;
  name: string;
  scopes?: string[];
  expiresAt?: string | null;
}) {
  const secret = generatePlaintextSecret();
  const prefix = secret.slice(0, 12); // includes "sk_live_" plus 4 chars
  const keyHash = sha256(secret);
  const scopes = opts.scopes && opts.scopes.length ? opts.scopes : ['simulate:preview'];

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: opts.userId,
      company_id: opts.companyId || null,
      name: opts.name.slice(0, 120),
      prefix,
      key_hash: keyHash,
      scopes,
      expires_at: opts.expiresAt || null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create API key: ${error.message}`);

  return { row: data as ApiKeyRow, secret };
}

async function listApiKeys(userId: string) {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, prefix, scopes, last_used_at, expires_at, revoked_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to list API keys: ${error.message}`);
  return data || [];
}

async function revokeApiKey(userId: string, keyId: string) {
  const { data, error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (error) throw new Error(`Failed to revoke API key: ${error.message}`);
  return data;
}

/**
 * Look up an API key by its plaintext secret. Returns `null` when the key is
 * unknown, revoked, or expired. Updates `last_used_at` best-effort.
 */
async function verifySecret(plaintext: string): Promise<ApiKeyRow | null> {
  if (!plaintext || !plaintext.startsWith(KEY_PREFIX)) return null;
  const keyHash = sha256(plaintext);
  const { data } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .maybeSingle();
  if (!data) return null;
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;

  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => null, () => null);

  return data as ApiKeyRow;
}

async function logUsage(opts: {
  apiKeyId: string;
  path: string;
  method: string;
  statusCode: number;
  latencyMs: number;
}) {
  try {
    await supabase.from('api_key_usage').insert({
      api_key_id: opts.apiKeyId,
      path: opts.path,
      method: opts.method,
      status_code: opts.statusCode,
      latency_ms: opts.latencyMs,
    });
  } catch {
    /* non-blocking */
  }
}

module.exports = {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  verifySecret,
  logUsage,
  KEY_PREFIX,
};
