/**
 * KV-backed fixed-window rate limiter.
 *
 * Deliberately not a paid Durable-Object/WAF rate-limiting product (plan
 * 023's STOP condition forbids requiring unapproved paid infrastructure) —
 * Workers KV has a free tier and is sufficient for basic abuse protection
 * on a low-volume form endpoint.
 *
 * Trade-off: KV reads/writes aren't transactional, so concurrent requests
 * in the same window can race past the limit by a small margin. Acceptable
 * for "stop obvious abuse," not a hard per-request guarantee.
 */

const WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 5;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkRateLimit(
  kv: KVNamespace,
  clientIp: string,
  now: number = Date.now()
): Promise<RateLimitResult> {
  const windowBucket = Math.floor(now / 1000 / WINDOW_SECONDS);
  const key = `ratelimit:${clientIp}:${windowBucket}`;

  const current = await kv.get(key);
  const count = current ? Number(current) : 0;

  if (count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }

  await kv.put(key, String(count + 1), { expirationTtl: WINDOW_SECONDS * 2 });
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - count - 1 };
}
