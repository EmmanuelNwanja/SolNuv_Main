#!/usr/bin/env node
/**
 * SolNuv V2 smoke checker (non-destructive).
 * Usage:
 *   node scripts/v2-smoke.js https://api.solnuv.com
 */

const axios = require('axios');

async function main() {
  const base = (process.argv[2] || 'http://localhost:5000').replace(/\/$/, '');
  const url = `${base}/api/v2/health`;
  const response = await axios.get(url, { timeout: 15000 });
  const payload = response.data || {};

  if (!payload?.success || payload?.data?.platform !== 'SolNuv V2 Oracle') {
    throw new Error(`Unexpected V2 response from ${url}: ${JSON.stringify(payload)}`);
  }

  console.log('V2 health check passed:', JSON.stringify(payload.data));
}

main().catch((err) => {
  console.error('V2 smoke check failed:', err.message);
  process.exit(1);
});

