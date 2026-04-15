import axios, { AxiosError, AxiosInstance } from "axios";
import http from "http";
import https from "https";

const TRANSIENT_NETWORK_CODES = new Set([
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ECONNABORTED",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createResilientHttpClient({ timeout = 30_000 }: { timeout?: number } = {}): AxiosInstance {
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

export function isTransientNetworkError(err: unknown) {
  const error = err as AxiosError & { cause?: { code?: string }; code?: string };
  const code = error?.code || error?.cause?.code;
  if (code && TRANSIENT_NETWORK_CODES.has(code)) return true;

  if (!error?.response && typeof error?.message === "string") {
    const msg = error.message.toLowerCase();
    return msg.includes("fetch failed") || msg.includes("socket hang up");
  }

  return false;
}

export function extractNetworkErrorMeta(err: unknown) {
  const error = err as {
    cause?: Record<string, unknown>;
    code?: string | null;
    errno?: string | null;
    syscall?: string | null;
    hostname?: string | null;
    address?: string | null;
  };
  const cause = (error?.cause || {}) as Record<string, unknown>;
  return {
    code: error?.code || (cause.code as string) || null,
    errno: error?.errno || (cause.errno as string) || null,
    syscall: error?.syscall || (cause.syscall as string) || null,
    hostname: error?.hostname || (cause.hostname as string) || null,
    address: error?.address || (cause.address as string) || null,
  };
}

interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (err: unknown) => boolean;
}

export async function requestWithRetry<T>(
  requestFn: () => Promise<T>,
  { retries = 2, baseDelayMs = 200, maxDelayMs = 2_000, shouldRetry }: RetryOptions = {}
) {
  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retries) {
    try {
      return await requestFn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;

      const retryable =
        typeof shouldRetry === "function" ? shouldRetry(err) : isTransientNetworkError(err);
      if (!retryable) break;

      const jitter = Math.floor(Math.random() * 75);
      const waitMs = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt + jitter);
      await sleep(waitMs);
      attempt += 1;
    }
  }

  throw lastErr;
}
