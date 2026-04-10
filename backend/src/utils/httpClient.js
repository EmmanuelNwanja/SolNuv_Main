'use strict';

const axios = require('axios');
const http = require('http');
const https = require('https');

const TRANSIENT_NETWORK_CODES = new Set([
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ECONNABORTED',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createResilientHttpClient({ timeout = 30_000 } = {}) {
  const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 15_000,
    maxSockets: 64,
  });

  const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 15_000,
    maxSockets: 64,
    family: 4,
  });

  return axios.create({
    timeout,
    httpAgent,
    httpsAgent,
  });
}

function isTransientNetworkError(err) {
  const code = err?.code || err?.cause?.code;
  if (code && TRANSIENT_NETWORK_CODES.has(code)) return true;

  if (!err?.response && typeof err?.message === 'string') {
    const msg = err.message.toLowerCase();
    return msg.includes('fetch failed') || msg.includes('socket hang up');
  }

  return false;
}

function extractNetworkErrorMeta(err) {
  const cause = err?.cause || {};
  return {
    code: err?.code || cause.code || null,
    errno: err?.errno || cause.errno || null,
    syscall: err?.syscall || cause.syscall || null,
    hostname: err?.hostname || cause.hostname || null,
    address: err?.address || cause.address || null,
  };
}

async function requestWithRetry(requestFn, {
  retries = 2,
  baseDelayMs = 200,
  maxDelayMs = 2_000,
  shouldRetry,
} = {}) {
  let attempt = 0;
  let lastErr;

  while (attempt <= retries) {
    try {
      return await requestFn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;

      const retryable = typeof shouldRetry === 'function'
        ? shouldRetry(err)
        : isTransientNetworkError(err);
      if (!retryable) break;

      const jitter = Math.floor(Math.random() * 75);
      const waitMs = Math.min(maxDelayMs, (baseDelayMs * (2 ** attempt)) + jitter);
      await sleep(waitMs);
      attempt += 1;
    }
  }

  throw lastErr;
}

module.exports = {
  createResilientHttpClient,
  requestWithRetry,
  isTransientNetworkError,
  extractNetworkErrorMeta,
};
