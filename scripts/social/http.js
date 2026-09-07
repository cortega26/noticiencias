import net from 'node:net';
import { Buffer } from 'node:buffer';

/**
 * Bounded, redacted HTTP transport shared by the social publisher's GitHub
 * and provider clients (plan social-distribution §12 / §17 / §18).
 *
 * Design rules this module enforces:
 * - `fetch` is injected so tests never touch the network and never wait.
 * - Every request has a hard timeout and a byte cap enforced *while reading*
 *   the body — a hostile or broken response is aborted, never fully buffered.
 * - Public GETs carry no credentials and follow redirects hop-by-hop with an
 *   explicit allowlist (§11 / §20.3). The fixed API endpoints never follow a
 *   redirect at all, so an `Authorization` header can never be replayed to an
 *   attacker-chosen host (§18).
 * - Errors are classified and sanitized. This module reports *observed facts*
 *   (timeout, status, malformed body); it does not decide whether a mutation
 *   was accepted — that reconciliation lives in the provider/state modules.
 * - No transparent retries. `computeBackoff` / `parseRetryAfter` are helpers
 *   the caller uses to schedule its own bounded retries; write operations are
 *   never retried here.
 */

/** @typedef {(input: string, init?: object) => Promise<Response>} FetchLike */

/** Local catalogue of transport-level error classes (plan §17). */
export const ERROR_CLASS = Object.freeze({
  TIMEOUT: 'TIMEOUT',
  DNS: 'DNS',
  CONNECTION: 'CONNECTION',
  REDIRECT_DISALLOWED: 'REDIRECT_DISALLOWED',
  TOO_MANY_REDIRECTS: 'TOO_MANY_REDIRECTS',
  RESPONSE_TOO_LARGE: 'RESPONSE_TOO_LARGE',
  MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  AUTH: 'AUTH',
  NOT_FOUND: 'NOT_FOUND',
  CLIENT_ERROR: 'CLIENT_ERROR',
  OK: 'OK',
});

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;

const BEARER_RE = /\b(bearer|token)\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const GH_TOKEN_RE = /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g;

/**
 * An HTTP transport failure. Carries the observed classification and a
 * message that has already had secrets scrubbed. Never carries the request
 * options, headers, or body.
 */
export class HttpError extends Error {
  /**
   * @param {string} errorClass one of {@link ERROR_CLASS}
   * @param {string} message already-sanitized, human-readable
   * @param {{ status?: number | null, retryAfterMs?: number | null }} [facts]
   */
  constructor(errorClass, message, facts = {}) {
    super(message);
    this.name = 'HttpError';
    this.errorClass = errorClass;
    this.status = facts.status ?? null;
    this.retryAfterMs = facts.retryAfterMs ?? null;
    /** These are facts, not a decision: the caller decides reconciliation. */
    this.sanitizedMessage = message;
  }
}

/**
 * Replace known secret material in a string with `[REDACTED]`. Pass the exact
 * secret values in `secrets` (never logged themselves); the regexes catch the
 * common shapes even when the exact value is unknown.
 * @param {string} text
 * @param {{ secrets?: string[] }} [options]
 * @returns {string}
 */
export function redactSecrets(text, { secrets = [] } = {}) {
  let out = String(text);
  for (const secret of secrets) {
    if (secret && String(secret).length >= 4) {
      out = out.split(String(secret)).join('[REDACTED]');
    }
  }
  return out
    .replace(JWT_RE, '[REDACTED_JWT]')
    .replace(GH_TOKEN_RE, '[REDACTED_TOKEN]')
    .replace(BEARER_RE, (_m, kw) => `${kw} [REDACTED]`);
}

/**
 * Parse a `Retry-After` header value (RFC 9110): either delta-seconds or an
 * HTTP-date. Returns milliseconds to wait, or `null` when absent/unparseable.
 * @param {string | null | undefined} value
 * @param {{ now?: () => number }} [options]
 * @returns {number | null}
 */
export function parseRetryAfter(value, { now = () => Date.now() } = {}) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (raw === '') return null;
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;
  const when = Date.parse(raw);
  if (Number.isNaN(when)) return null;
  return Math.max(0, when - now());
}

/**
 * Full-jitter backoff: `U(0, min(cap, base * 2^attempt))`, then floored at
 * `retryAfterMs` because `Retry-After` is a minimum (plan §17). `rng` and the
 * result are both injectable/inspectable so tests never sleep.
 * @param {number} attempt zero-based retry index
 * @param {{ rng?: () => number, baseMs?: number, capMs?: number, retryAfterMs?: number }} [options]
 * @returns {number} milliseconds
 */
export function computeBackoff(
  attempt,
  { rng = Math.random, baseMs = 2000, capMs = 60_000, retryAfterMs = 0 } = {}
) {
  const ceiling = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt));
  const jitter = Math.round(rng() * ceiling);
  return Math.max(jitter, retryAfterMs || 0);
}

/**
 * Classify a completed response by status. 2xx → OK. Recognizes GitHub's
 * secondary-rate-limit shape (403 + `retry-after` / exhausted quota).
 * @param {number} status
 * @param {Record<string, string>} headers lowercased
 * @returns {string} one of {@link ERROR_CLASS}
 */
export function classifyStatus(status, headers = {}) {
  if (status >= 200 && status < 300) return ERROR_CLASS.OK;
  if (status === 429) return ERROR_CLASS.RATE_LIMITED;
  if (
    status === 403 &&
    (headers['retry-after'] != null || headers['x-ratelimit-remaining'] === '0')
  ) {
    return ERROR_CLASS.RATE_LIMITED;
  }
  if (status === 401 || status === 403) return ERROR_CLASS.AUTH;
  if (status === 404) return ERROR_CLASS.NOT_FOUND;
  if (status === 408) return ERROR_CLASS.TIMEOUT;
  if (status >= 500) return ERROR_CLASS.SERVER_ERROR;
  if (status >= 400) return ERROR_CLASS.CLIENT_ERROR;
  return ERROR_CLASS.CLIENT_ERROR;
}

/**
 * Classify a thrown fetch/transport error (no response was produced).
 * @param {unknown} error
 * @returns {string} one of {@link ERROR_CLASS}
 */
export function classifyThrown(error) {
  const name = error && typeof error === 'object' ? String(error.name || '') : '';
  if (name === 'TimeoutError' || name === 'AbortError') return ERROR_CLASS.TIMEOUT;
  const code =
    (error && typeof error === 'object' && error.cause && error.cause.code) ||
    (error && typeof error === 'object' && error.code) ||
    '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return ERROR_CLASS.DNS;
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ECONNABORTED' ||
    code === 'EPIPE' ||
    code === 'UND_ERR_SOCKET' ||
    code === 'UND_ERR_CONNECT_TIMEOUT'
  ) {
    return ERROR_CLASS.CONNECTION;
  }
  if (code === 'UND_ERR_HEADERS_TIMEOUT' || code === 'UND_ERR_BODY_TIMEOUT') {
    return ERROR_CLASS.TIMEOUT;
  }
  return ERROR_CLASS.CONNECTION;
}

/**
 * True when a hostname must never be contacted or redirected to: any IP
 * literal (v4/v6, including IPv4-mapped which `net.isIP` reports as 6),
 * loopback names, and `.local` mDNS names. Named public hosts are still
 * gated by the per-request `allowedHosts` allowlist.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isDisallowedHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (h === '') return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (net.isIP(h) !== 0) return true;
  return false;
}

function assertReachableUrl(parsed, allowedHosts) {
  if (parsed.protocol !== 'https:') {
    throw new HttpError(
      ERROR_CLASS.REDIRECT_DISALLOWED,
      `refusing non-https URL for host ${parsed.host}`
    );
  }
  if (isDisallowedHost(parsed.hostname)) {
    throw new HttpError(
      ERROR_CLASS.REDIRECT_DISALLOWED,
      `refusing disallowed host ${parsed.hostname}`
    );
  }
  if (allowedHosts && !allowedHosts.includes(parsed.hostname)) {
    throw new HttpError(
      ERROR_CLASS.REDIRECT_DISALLOWED,
      `host ${parsed.hostname} is not in the allowlist`
    );
  }
  if (parsed.username || parsed.password) {
    throw new HttpError(
      ERROR_CLASS.REDIRECT_DISALLOWED,
      `refusing URL with embedded credentials for host ${parsed.hostname}`
    );
  }
}

/** @param {Headers | Map<string,string> | Record<string,string> | undefined} headers */
function toHeaderObject(headers) {
  const out = {};
  if (!headers) return out;
  if (typeof headers.forEach === 'function') {
    headers.forEach((value, key) => {
      out[String(key).toLowerCase()] = String(value);
    });
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    out[String(key).toLowerCase()] = String(value);
  }
  return out;
}

/**
 * Read a response body, aborting past `maxBytes`. Uses the byte stream when
 * available (the real cap path) and falls back to `.text()` only for fakes
 * without a stream.
 * @param {Response} response
 * @param {number} maxBytes
 * @param {string[]} secrets
 * @returns {Promise<{ text: string, bytes: number }>}
 */
async function readBodyWithCap(response, maxBytes, secrets) {
  const reader =
    response.body && typeof response.body.getReader === 'function'
      ? response.body.getReader()
      : null;

  if (!reader) {
    const text = typeof response.text === 'function' ? await response.text() : '';
    const buffer = Buffer.from(text, 'utf8');
    if (buffer.length > maxBytes) {
      throw new HttpError(
        ERROR_CLASS.RESPONSE_TOO_LARGE,
        `response body ${buffer.length} bytes exceeds cap ${maxBytes}`
      );
    }
    return { text, bytes: buffer.length, buffer };
  }

  const chunks = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new HttpError(
          ERROR_CLASS.RESPONSE_TOO_LARGE,
          `response body exceeded cap ${maxBytes} bytes while streaming`
        );
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      classifyThrown(error),
      redactSecrets(`error while reading response body: ${errorMessage(error)}`, { secrets })
    );
  }
  const buf = Buffer.concat(chunks);
  return { text: buf.toString('utf8'), bytes: buf.length, buffer: buf };
}

function errorMessage(error) {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

/**
 * @typedef {object} HttpResult
 * @property {number} status
 * @property {Record<string, string>} headers lowercased
 * @property {string} bodyText
 * @property {number} bodyBytes
 * @property {Buffer} bodyBuffer raw bytes as received (for content sniffing)
 * @property {number | null} retryAfterMs parsed `Retry-After`, when present
 * @property {string} url final URL after any followed redirects
 * @property {string[]} redirects intermediate URLs, in order
 */

/**
 * Perform one bounded HTTP request. Returns the response for *any* status
 * code (the caller classifies with {@link classifyStatus}); throws
 * {@link HttpError} only when no usable response was produced (timeout,
 * DNS/connection failure, disallowed redirect, oversized body).
 *
 * @param {string} url absolute https URL
 * @param {{
 *   fetchImpl: FetchLike,
 *   method?: string,
 *   headers?: Record<string, string>,
 *   body?: string,
 *   allowedHosts: string[],
 *   followRedirects?: boolean,
 *   maxRedirects?: number,
 *   maxBytes?: number,
 *   timeoutMs?: number,
 *   secrets?: string[],
 * }} options
 * @returns {Promise<HttpResult>}
 */
export async function request(url, options) {
  const {
    fetchImpl,
    method = 'GET',
    headers = {},
    body,
    allowedHosts,
    followRedirects = false,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    maxBytes = DEFAULT_MAX_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    secrets = [],
  } = options || {};

  if (typeof fetchImpl !== 'function') {
    throw new HttpError(ERROR_CLASS.CONNECTION, 'no fetch implementation was injected');
  }
  if (!Array.isArray(allowedHosts) || allowedHosts.length === 0) {
    throw new HttpError(ERROR_CLASS.REDIRECT_DISALLOWED, 'no host allowlist was provided');
  }

  let current;
  try {
    current = new URL(url);
  } catch {
    throw new HttpError(ERROR_CLASS.MALFORMED_RESPONSE, `unparseable request URL`);
  }
  assertReachableUrl(current, allowedHosts);

  const redirects = [];
  for (let hop = 0; ; hop += 1) {
    /** @type {Response} */
    let response;
    try {
      response = await fetchImpl(current.href, {
        method,
        headers,
        body: hop === 0 ? body : undefined,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new HttpError(
        classifyThrown(error),
        redactSecrets(`request to ${current.hostname} failed: ${errorMessage(error)}`, { secrets })
      );
    }

    const status = Number(response.status) || 0;
    const responseHeaders = toHeaderObject(response.headers);

    if (status >= 300 && status < 400) {
      const location = responseHeaders.location;
      if (!followRedirects) {
        throw new HttpError(
          ERROR_CLASS.REDIRECT_DISALLOWED,
          `${current.hostname} answered ${status} redirect; this endpoint never follows redirects`,
          { status }
        );
      }
      if (!location) {
        throw new HttpError(
          ERROR_CLASS.MALFORMED_RESPONSE,
          `${current.hostname} answered ${status} with no Location header`,
          { status }
        );
      }
      if (hop >= maxRedirects) {
        throw new HttpError(
          ERROR_CLASS.TOO_MANY_REDIRECTS,
          `exceeded ${maxRedirects} redirects starting at ${current.hostname}`,
          { status }
        );
      }
      let next;
      try {
        next = new URL(location, current);
      } catch {
        throw new HttpError(
          ERROR_CLASS.MALFORMED_RESPONSE,
          `${current.hostname} redirected to an unparseable Location`,
          { status }
        );
      }
      assertReachableUrl(next, allowedHosts);
      redirects.push(next.href);
      current = next;
      continue;
    }

    const { text, bytes, buffer } = await readBodyWithCap(response, maxBytes, secrets);
    const retryAfterMs = parseRetryAfter(responseHeaders['retry-after']);
    return {
      status,
      headers: responseHeaders,
      bodyText: text,
      bodyBytes: bytes,
      bodyBuffer: buffer,
      url: current.href,
      redirects,
      retryAfterMs,
    };
  }
}

/**
 * Convenience: {@link request} plus JSON parsing. Throws
 * {@link HttpError} with `MALFORMED_RESPONSE` when the body is not JSON.
 * Does not throw on non-2xx — returns `{ result, json }` so the caller can
 * inspect status and body together.
 * @param {string} url
 * @param {Parameters<typeof request>[1]} options
 * @returns {Promise<{ result: HttpResult, json: unknown }>}
 */
export async function requestJson(url, options) {
  const result = await request(url, options);
  let json;
  try {
    json = JSON.parse(result.bodyText);
  } catch {
    throw new HttpError(
      ERROR_CLASS.MALFORMED_RESPONSE,
      `${new URL(result.url).hostname} returned a non-JSON body (status ${result.status})`,
      { status: result.status }
    );
  }
  return { result, json };
}
