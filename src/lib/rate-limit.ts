/**
 * Sliding-window rate limiter (in-process).
 *
 * Algorithm: for each key we store timestamps of recent hits in a rolling window.
 * On check, drop entries older than windowMs, then count remaining. If count >= limit,
 * reject. Otherwise record this hit.
 *
 * Production note: in-memory stores reset on deploy and do not share across replicas.
 * Set RATE_LIMIT_BACKEND=redis and configure Upstash when running multiple instances.
 */

export type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type Bucket = {
  hits: number[];
};

const stores = new Map<string, Map<string, Bucket>>();

function getStore(namespace: string): Map<string, Bucket> {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map();
    stores.set(namespace, store);
  }
  return store;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const RATE_LIMIT_PRESETS = {
  loginIp: (): RateLimitConfig => ({
    limit: envInt("RATE_LIMIT_LOGIN_IP_MAX", 20),
    windowMs: envInt("RATE_LIMIT_LOGIN_IP_WINDOW_MS", 15 * 60 * 1000),
  }),
  loginAccount: (): RateLimitConfig => ({
    limit: envInt("RATE_LIMIT_LOGIN_ACCOUNT_MAX", 10),
    windowMs: envInt("RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_MS", 15 * 60 * 1000),
  }),
  submissionImport: (): RateLimitConfig => ({
    limit: envInt("RATE_LIMIT_SUBMISSION_IMPORT_MAX", 30),
    windowMs: envInt("RATE_LIMIT_SUBMISSION_IMPORT_WINDOW_MS", 60 * 60 * 1000),
  }),
  submissionPublish: (): RateLimitConfig => ({
    limit: envInt("RATE_LIMIT_SUBMISSION_PUBLISH_MAX", 20),
    windowMs: envInt("RATE_LIMIT_SUBMISSION_PUBLISH_WINDOW_MS", 60 * 60 * 1000),
  }),
  destructiveAdmin: (): RateLimitConfig => ({
    limit: envInt("RATE_LIMIT_DESTRUCTIVE_ADMIN_MAX", 40),
    windowMs: envInt("RATE_LIMIT_DESTRUCTIVE_ADMIN_WINDOW_MS", 60 * 60 * 1000),
  }),
} as const;

export function consumeRateLimit(
  namespace: string,
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const store = getStore(namespace);
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((timestamp) => timestamp > windowStart);

  if (bucket.hits.length >= config.limit) {
    const resetAt = bucket.hits[0]! + config.windowMs;
    store.set(key, bucket);
    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetAt,
    };
  }

  bucket.hits.push(now);
  store.set(key, bucket);
  return {
    allowed: true,
    limit: config.limit,
    remaining: Math.max(0, config.limit - bucket.hits.length),
    resetAt: now + config.windowMs,
  };
}

export function assertRateLimit(
  namespace: string,
  key: string,
  config: RateLimitConfig,
  label: string,
): void {
  const result = consumeRateLimit(namespace, key, config);
  if (!result.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw new Error(`${label} rate limit exceeded. Try again in ${retryAfterSec} seconds.`);
  }
}

export function resetRateLimitStore(namespace?: string) {
  if (namespace) {
    stores.delete(namespace);
    return;
  }
  stores.clear();
}
