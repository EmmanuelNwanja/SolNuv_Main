const crypto = require('crypto');
const supabase = require('../../config/database');

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex');
}

async function getExisting(endpointKey, idempotencyKey) {
  const { data, error } = await supabase
    .from('v2_idempotency_records')
    .select('*')
    .eq('endpoint_key', endpointKey)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function saveRecord({
  endpointKey,
  idempotencyKey,
  payload,
  responsePayload,
  createdBy,
}) {
  const requestHash = hashPayload(payload);
  const { data, error } = await supabase
    .from('v2_idempotency_records')
    .upsert({
      endpoint_key: endpointKey,
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      response_payload: responsePayload || {},
      created_by: createdBy || null,
    }, { onConflict: 'endpoint_key,idempotency_key' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  hashPayload,
  getExisting,
  saveRecord,
};

