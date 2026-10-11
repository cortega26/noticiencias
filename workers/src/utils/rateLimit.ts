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

// Stricter quota for the shared 'unknown' bucket (plan 019): every
// headerless/direct client lands in one collective bucket, so a low limit
// blunts abuse that omits identity headers. Legitimate browsers always
// arrive via the CDN with CF-Connecting-IP set, so they never land here.
const MAX_REQUESTS_UNKNOWN_BUCKET = 2;

export const UNKNOWN_CLIENT = 'unknown';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Resolve the rate-limit identity for a request (plan 019).
 *
 * Trust order:
 *  1. `CF-Connecting-IP`, but ONLY when the request verifiably arrived via
 *     the Cloudflare CDN — signalled by the runtime-populated `request.cf`
 *     object, which a client cannot forge via headers. The header alone is
 *     spoofable on a direct-to-worker path (and `workers_dev = false` plus
 *     the zone-only route already keep production traffic on the CDN, where
 *     Cloudflare overwrites the header with the real client IP).
 *  2. Otherwise `UNKNOWN_CLIENT` — all such clients share one stricter
 *     bucket (see MAX_REQUESTS_UNKNOWN_BUCKET).
 *
 * Deliberately NOT used as a CDN signal: `CF-Ray` and friends are plain
 * request headers on the direct path, so an attacker can send any value.
 */
export function resolveClientIp(request: Request): string {
  const headerIp = request.headers.get('CF-Connecting-IP')?.trim();
  const cf = (request as Request & { cf?: unknown }).cf;
  const viaCdn = cf !== undefined && cf !== null;
  if (headerIp && viaCdn) {
    return headerIp;
  }
  return UNKNOWN_CLIENT;
}

export async function checkRateLimit(
  kv: KVNamespace,
  clientIp: string,
  now: number = Date.now()
): Promise<RateLimitResult> {
  const windowBucket = Math.floor(now / 1000 / WINDOW_SECONDS);
  const key = `ratelimit:${clientIp}:${windowBucket}`;
  const maxForClient =
    clientIp === UNKNOWN_CLIENT ? MAX_REQUESTS_UNKNOWN_BUCKET : MAX_REQUESTS_PER_WINDOW;

  const current = await kv.get(key);
  const count = current ? Number(current) : 0;

  if (count >= maxForClient) {
    return { allowed: false, remaining: 0 };
  }

  await kv.put(key, String(count + 1), { expirationTtl: WINDOW_SECONDS * 2 });
  return { allowed: true, remaining: maxForClient - count - 1 };
}
