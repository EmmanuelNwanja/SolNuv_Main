const crypto = require('crypto');
const axios = require('axios');

function canonicalize(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `"${k}":${canonicalize(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(payload) {
  return crypto.createHash('sha256').update(canonicalize(payload)).digest('hex');
}

function createInMemoryChainAdapter(networkName = 'simulated') {
  const chainId = process.env.V2_CHAIN_ID || 'sim-chain';
  return {
    async anchor(attestationPayload) {
    const hash = sha256Hex(attestationPayload);
    return {
      chain_id: chainId,
      network_name: networkName,
      tx_hash: `sim_${hash.slice(0, 40)}`,
      block_number: Math.floor(Date.now() / 1000),
      contract_address: 'simulated_contract',
      payload_hash: hash,
      anchored_at: new Date().toISOString(),
    };
    },
  };
}

const configuredProvider = String(process.env.V2_CHAIN_PROVIDER || 'simulated').toLowerCase();
const adapter = createInMemoryChainAdapter(configuredProvider);

async function anchorViaAttestationApi(payload) {
  const endpoint = process.env.V2_CHAIN_ATTESTATION_URL;
  const apiKey = process.env.V2_CHAIN_ATTESTATION_API_KEY;
  if (!endpoint) throw new Error('V2_CHAIN_ATTESTATION_URL is not configured');

  const response = await axios.post(
    endpoint,
    { payload },
    {
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    }
  );

  const data = response?.data || {};
  if (!data?.tx_hash || !data?.payload_hash) {
    throw new Error('Attestation API returned incomplete response');
  }
  return {
    chain_id: data.chain_id || process.env.V2_CHAIN_ID || 'external',
    network_name: data.network_name || configuredProvider,
    tx_hash: data.tx_hash,
    block_number: data.block_number || null,
    contract_address: data.contract_address || null,
    payload_hash: data.payload_hash,
    anchored_at: data.anchored_at || new Date().toISOString(),
  };
}

module.exports = {
  provider: configuredProvider,
  async anchorAttestation(payload) {
    if (configuredProvider === 'attestation_api') {
      return anchorViaAttestationApi(payload);
    }
    return adapter.anchor(payload);
  },
  async verifyAttestation(inputPayload, attestation) {
    if (!attestation?.payload_hash) return false;
    return sha256Hex(inputPayload) === attestation.payload_hash;
  },
};

