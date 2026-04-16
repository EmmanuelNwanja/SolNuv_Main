const crypto = require('crypto');

function buildCanonical(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(buildCanonical).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `"${k}":${buildCanonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function signPayload(payload, secret) {
  const canonical = buildCanonical(payload);
  return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

function verifyPayloadSignature(payload, secret, signature) {
  const expected = signPayload(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature || '')));
}

module.exports = {
  signPayload,
  verifyPayloadSignature,
};

