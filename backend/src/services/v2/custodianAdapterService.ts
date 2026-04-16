const axios = require('axios');
const { signPayload } = require('./signatureService');

function getAdapter() {
  const provider = String(process.env.V2_CUSTODIAN_PROVIDER || 'simulated').toLowerCase();
  return {
    provider,
    async executeRelease({ decision }) {
      if (provider === 'webhook') {
        const endpoint = process.env.V2_CUSTODIAN_WEBHOOK_URL;
        if (!endpoint) throw new Error('V2_CUSTODIAN_WEBHOOK_URL is not configured');
        const payload = {
          release_decision_id: decision.id,
          decision_type: decision.decision_type,
          approved_release_amount_ngn: decision.approved_release_amount_ngn || 0,
          approved_hold_amount_ngn: decision.approved_hold_amount_ngn || 0,
          policy_version: decision.policy_version,
          payload_hash: decision.payload_hash,
          timestamp: new Date().toISOString(),
        };
        const secret = process.env.V2_CUSTODIAN_WEBHOOK_SECRET || '';
        const signature = secret ? signPayload(payload, secret) : null;
        const response = await axios.post(endpoint, payload, {
          timeout: 20000,
          headers: {
            'Content-Type': 'application/json',
            ...(signature ? { 'x-solnuv-signature': signature } : {}),
          },
        });
        const data = response?.data || {};
        return {
          provider,
          execution_status: data.execution_status || 'submitted',
          external_reference: data.external_reference || `cust_ext_${decision.id}`,
          executed_at: data.executed_at || new Date().toISOString(),
          decision_type: decision.decision_type,
          amount_released_ngn: decision.approved_release_amount_ngn || 0,
          amount_held_ngn: decision.approved_hold_amount_ngn || 0,
          raw_response: data,
        };
      }
      return {
        provider,
        execution_status: 'accepted',
        external_reference: `cust_${decision.id || Date.now()}`,
        executed_at: new Date().toISOString(),
        decision_type: decision.decision_type,
        amount_released_ngn: decision.approved_release_amount_ngn || 0,
        amount_held_ngn: decision.approved_hold_amount_ngn || 0,
      };
    },
  };
}

module.exports = getAdapter();

