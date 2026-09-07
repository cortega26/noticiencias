import { describe, expect, it, vi } from 'vitest';
import {
  ERROR_CLASS,
  HttpError,
  classifyStatus,
  classifyThrown,
  computeBackoff,
  isDisallowedHost,
  parseRetryAfter,
  redactSecrets,
  request,
  requestJson,
} from '../../scripts/social/http.js';

/**
 * Plan social-distribution §12/§17/§18: bounded, redacted transport. No real
 * network, no real waiting — every `fetch` is a fake returning canned
 * `Response` objects (real ones, so the byte-stream cap path is exercised).
 */

type Init = { method?: string; headers?: Record<string, string>; body?: string };

function fakeFetch(...responses: Array<Response | (() => Promise<Response>)>) {
  const queue = [...responses];
  const calls: Array<{ url: string; init?: Init }> = [];
  const fn = vi.fn(async (url: string, init?: Init) => {
    calls.push({ url, init });
    const next = queue.shift();
    if (next === undefined) throw new Error('fakeFetch: no more queued responses');
    return typeof next === 'function' ? next() : next;
  });
  return Object.assign(fn, { calls });
}

const ALLOW = ['noticiencias.com'];

describe('request', () => {
  it('returns status, lowercased headers and body for a plain GET', async () => {
    const fetchImpl = fakeFetch(
      new Response('<html>ok</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })
    );
    const res = await request('https://noticiencias.com/x/', { fetchImpl, allowedHosts: ALLOW });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/html');
    expect(res.bodyText).toBe('<html>ok</html>');
    expect(res.bodyBytes).toBe(15);
    expect(res.redirects).toEqual([]);
  });

  it('never follows a redirect for a fixed API endpoint (credentials cannot be replayed)', async () => {
    const fetchImpl = fakeFetch(
      new Response(null, { status: 302, headers: { location: 'https://evil.example/' } })
    );
    await expect(
      request('https://api.github.com/x', {
        fetchImpl,
        allowedHosts: ['api.github.com'],
        headers: { authorization: 'Bearer ghp_' + 'a'.repeat(36) },
      })
    ).rejects.toMatchObject({ errorClass: ERROR_CLASS.REDIRECT_DISALLOWED });
  });

  it('follows a public redirect hop-by-hop within the allowlist and records the chain', async () => {
    const fetchImpl = fakeFetch(
      new Response(null, {
        status: 301,
        headers: { location: 'https://noticiencias.com/final/' },
      }),
      new Response('done', { status: 200 })
    );
    const res = await request('https://noticiencias.com/start/', {
      fetchImpl,
      allowedHosts: ALLOW,
      followRedirects: true,
    });
    expect(res.redirects).toEqual(['https://noticiencias.com/final/']);
    expect(res.url).toBe('https://noticiencias.com/final/');
    expect(res.bodyText).toBe('done');
  });

  it('rejects a redirect that leaves the allowlist', async () => {
    const fetchImpl = fakeFetch(
      new Response(null, { status: 302, headers: { location: 'https://evil.example/x' } })
    );
    await expect(
      request('https://noticiencias.com/start/', {
        fetchImpl,
        allowedHosts: ALLOW,
        followRedirects: true,
      })
    ).rejects.toMatchObject({ errorClass: ERROR_CLASS.REDIRECT_DISALLOWED });
  });

  it('rejects a redirect to a private IP literal', async () => {
    const fetchImpl = fakeFetch(
      new Response(null, { status: 302, headers: { location: 'https://169.254.169.254/latest' } })
    );
    await expect(
      request('https://noticiencias.com/start/', {
        fetchImpl,
        allowedHosts: [...ALLOW, '169.254.169.254'],
        followRedirects: true,
      })
    ).rejects.toMatchObject({ errorClass: ERROR_CLASS.REDIRECT_DISALLOWED });
  });

  it('caps redirect hops', async () => {
    const hop = () =>
      Promise.resolve(
        new Response(null, { status: 301, headers: { location: 'https://noticiencias.com/next/' } })
      );
    const fetchImpl = fakeFetch(hop, hop, hop, hop, hop);
    await expect(
      request('https://noticiencias.com/start/', {
        fetchImpl,
        allowedHosts: ALLOW,
        followRedirects: true,
        maxRedirects: 2,
      })
    ).rejects.toMatchObject({ errorClass: ERROR_CLASS.TOO_MANY_REDIRECTS });
  });

  it('aborts an oversized body while streaming instead of buffering it', async () => {
    const fetchImpl = fakeFetch(new Response('x'.repeat(5000), { status: 200 }));
    await expect(
      request('https://noticiencias.com/big/', { fetchImpl, allowedHosts: ALLOW, maxBytes: 100 })
    ).rejects.toMatchObject({ errorClass: ERROR_CLASS.RESPONSE_TOO_LARGE });
  });

  it('classifies a timeout and scrubs secrets from the message', async () => {
    const secret = 'app-password-' + 'z'.repeat(20);
    const fetchImpl = fakeFetch(() => {
      const err = new Error(`socket hung up while sending ${secret}`);
      err.name = 'TimeoutError';
      return Promise.reject(err);
    });
    const error = await request('https://noticiencias.com/x/', {
      fetchImpl,
      allowedHosts: ALLOW,
      secrets: [secret],
    }).catch((e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error.errorClass).toBe(ERROR_CLASS.TIMEOUT);
    expect(error.message).not.toContain(secret);
    expect(error.sanitizedMessage).toContain('[REDACTED]');
  });

  it('refuses to run without a host allowlist', async () => {
    await expect(
      request('https://noticiencias.com/x/', {
        fetchImpl: fakeFetch(),
        allowedHosts: [] as string[],
      })
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('returns non-2xx responses instead of throwing (facts, not decisions)', async () => {
    const fetchImpl = fakeFetch(
      new Response('nope', { status: 429, headers: { 'retry-after': '30' } })
    );
    const res = await request('https://noticiencias.com/x/', { fetchImpl, allowedHosts: ALLOW });
    expect(res.status).toBe(429);
    expect(res.retryAfterMs).toBe(30_000);
    expect(classifyStatus(res.status, res.headers)).toBe(ERROR_CLASS.RATE_LIMITED);
  });
});

describe('requestJson', () => {
  it('parses a JSON body', async () => {
    const fetchImpl = fakeFetch(new Response('{"a":1}', { status: 200 }));
    const { json } = await requestJson('https://api.github.com/x', {
      fetchImpl,
      allowedHosts: ['api.github.com'],
    });
    expect(json).toEqual({ a: 1 });
  });

  it('throws MALFORMED_RESPONSE on a non-JSON body', async () => {
    const fetchImpl = fakeFetch(new Response('<html>', { status: 200 }));
    await expect(
      requestJson('https://api.github.com/x', { fetchImpl, allowedHosts: ['api.github.com'] })
    ).rejects.toMatchObject({ errorClass: ERROR_CLASS.MALFORMED_RESPONSE });
  });
});

describe('classifyStatus', () => {
  it('maps status codes to error classes', () => {
    expect(classifyStatus(204)).toBe(ERROR_CLASS.OK);
    expect(classifyStatus(429)).toBe(ERROR_CLASS.RATE_LIMITED);
    expect(classifyStatus(403, { 'retry-after': '60' })).toBe(ERROR_CLASS.RATE_LIMITED);
    expect(classifyStatus(403, { 'x-ratelimit-remaining': '0' })).toBe(ERROR_CLASS.RATE_LIMITED);
    expect(classifyStatus(403)).toBe(ERROR_CLASS.AUTH);
    expect(classifyStatus(401)).toBe(ERROR_CLASS.AUTH);
    expect(classifyStatus(404)).toBe(ERROR_CLASS.NOT_FOUND);
    expect(classifyStatus(500)).toBe(ERROR_CLASS.SERVER_ERROR);
    expect(classifyStatus(422)).toBe(ERROR_CLASS.CLIENT_ERROR);
  });
});

describe('classifyThrown', () => {
  it('maps thrown transport errors', () => {
    const timeout = new Error('t');
    timeout.name = 'TimeoutError';
    expect(classifyThrown(timeout)).toBe(ERROR_CLASS.TIMEOUT);
    expect(classifyThrown({ cause: { code: 'ENOTFOUND' } })).toBe(ERROR_CLASS.DNS);
    expect(classifyThrown({ cause: { code: 'ECONNREFUSED' } })).toBe(ERROR_CLASS.CONNECTION);
    expect(classifyThrown(new Error('unknown'))).toBe(ERROR_CLASS.CONNECTION);
  });
});

describe('parseRetryAfter', () => {
  it('reads delta-seconds', () => {
    expect(parseRetryAfter('120')).toBe(120_000);
  });

  it('reads an HTTP-date relative to an injected clock', () => {
    const now = () => Date.parse('2026-01-01T00:00:00Z');
    expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:30 GMT', { now })).toBe(30_000);
  });

  it('returns null for missing or unparseable values', () => {
    expect(parseRetryAfter(undefined)).toBeNull();
    expect(parseRetryAfter('')).toBeNull();
    expect(parseRetryAfter('soon')).toBeNull();
  });
});

describe('computeBackoff', () => {
  it('is full-jitter within the exponential ceiling', () => {
    expect(computeBackoff(0, { rng: () => 0, baseMs: 2000 })).toBe(0);
    expect(computeBackoff(3, { rng: () => 1, baseMs: 2000, capMs: 60_000 })).toBe(16_000);
    expect(computeBackoff(10, { rng: () => 1, baseMs: 2000, capMs: 60_000 })).toBe(60_000);
  });

  it('floors the delay at Retry-After', () => {
    expect(computeBackoff(0, { rng: () => 0, retryAfterMs: 45_000 })).toBe(45_000);
    expect(
      computeBackoff(5, { rng: () => 1, baseMs: 2000, capMs: 60_000, retryAfterMs: 1000 })
    ).toBe(60_000);
  });
});

describe('redactSecrets', () => {
  it('scrubs bearer tokens, JWTs, GitHub tokens and explicit secrets', () => {
    expect(redactSecrets('Authorization: Bearer abc.def-123')).toBe(
      'Authorization: Bearer [REDACTED]'
    );
    // Assembled from parts so the secret scanner does not flag the fixture.
    const fakeJwt = ['eyJ', 'aa', '.eyJ', 'bb', '.', 'cc'].join('');
    expect(redactSecrets(`t=${fakeJwt}`)).toBe('t=[REDACTED_JWT]');
    expect(redactSecrets('x ghp_' + 'A'.repeat(36) + ' y')).toBe('x [REDACTED_TOKEN] y');
    expect(redactSecrets('key=hunter2hunter2', { secrets: ['hunter2hunter2'] })).toBe(
      'key=[REDACTED]'
    );
  });
});

describe('isDisallowedHost', () => {
  it('rejects IP literals and loopback names, allows named hosts', () => {
    expect(isDisallowedHost('10.0.0.1')).toBe(true);
    expect(isDisallowedHost('169.254.169.254')).toBe(true);
    expect(isDisallowedHost('::1')).toBe(true);
    expect(isDisallowedHost('[::ffff:127.0.0.1]')).toBe(true);
    expect(isDisallowedHost('localhost')).toBe(true);
    expect(isDisallowedHost('printer.local')).toBe(true);
    expect(isDisallowedHost('noticiencias.com')).toBe(false);
    expect(isDisallowedHost('api.github.com')).toBe(false);
  });
});
