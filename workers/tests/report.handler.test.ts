/**
 * Runtime tests for handleReport() — exercises the actual Worker handler
 * with mocked Env bindings (no @cloudflare/vitest-pool-workers needed;
 * Request/Response/crypto are Node 18+ globals and the handler only uses
 * standard Web APIs).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleReport } from '../src/handlers/report';
import type { Env } from '../src/index';

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://noticiencias.com/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: json,
  });
}

function makeFakeR2(shouldFail = false) {
  const objects = new Map<string, string>();
  return {
    put: vi.fn(async (key: string, value: string) => {
      if (shouldFail) throw new Error('R2 unavailable');
      objects.set(key, value);
    }),
    objects,
  };
}

function makeFakeKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    store,
  };
}

const VALID_PAYLOAD = { problem_type: 'content_factual', description: 'Algo está mal' };

describe('handleReport', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
  });

  it('returns 422 for an invalid payload without touching any sink', async () => {
    const r2 = makeFakeR2();
    const env = { ENVIRONMENT: 'test', REPORT_BUCKET: r2 as never } as Env;

    const res = await handleReport(makeRequest({ problem_type: 'bogus' }), env);

    expect(res.status).toBe(422);
    expect(r2.put).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const env = { ENVIRONMENT: 'test' } as Env;
    const res = await handleReport(makeRequest('{not json'), env);
    expect(res.status).toBe(400);
  });

  it('returns 413 when Content-Length exceeds the body limit', async () => {
    const env = { ENVIRONMENT: 'test' } as Env;
    const res = await handleReport(
      makeRequest(VALID_PAYLOAD, { 'Content-Length': String(50_000) }),
      env
    );
    expect(res.status).toBe(413);
  });

  it('returns 413 when the actual stream exceeds the limit despite an understated Content-Length', async () => {
    const env = { ENVIRONMENT: 'test' } as Env;
    const oversized = { problem_type: 'content_factual', description: 'x'.repeat(30_000) };
    const req = new Request('https://noticiencias.com/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '10' },
      body: JSON.stringify(oversized),
    });
    const res = await handleReport(req, env);
    expect(res.status).toBe(413);
  });

  it('returns 503 when no durable sink is configured', async () => {
    const env = { ENVIRONMENT: 'test' } as Env;
    const res = await handleReport(makeRequest(VALID_PAYLOAD), env);
    expect(res.status).toBe(503);
  });

  it('returns 201 with an id when R2 succeeds', async () => {
    const r2 = makeFakeR2();
    const env = { ENVIRONMENT: 'test', REPORT_BUCKET: r2 as never } as Env;

    const res = await handleReport(makeRequest(VALID_PAYLOAD), env);
    const json = (await res.json()) as { id: string };

    expect(res.status).toBe(201);
    expect(json.id).toBeTruthy();
    expect(r2.objects.size).toBe(1);
  });

  it('returns 201 via email alone when R2 is not configured but email succeeds', async () => {
    const env = {
      ENVIRONMENT: 'test',
      EMAIL_API_KEY: 'key',
      EMAIL_FROM: 'from@noticiencias.com',
      EMAIL_TO: 'to@noticiencias.com',
    } as Env;

    const res = await handleReport(makeRequest(VALID_PAYLOAD), env);
    expect(res.status).toBe(201);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('returns 503 when R2 fails and email is not configured', async () => {
    const r2 = makeFakeR2(true);
    const env = { ENVIRONMENT: 'test', REPORT_BUCKET: r2 as never } as Env;

    const res = await handleReport(makeRequest(VALID_PAYLOAD), env);
    expect(res.status).toBe(503);
  });

  it('returns 201 when R2 fails but email succeeds (at least one sink)', async () => {
    const r2 = makeFakeR2(true);
    const env = {
      ENVIRONMENT: 'test',
      REPORT_BUCKET: r2 as never,
      EMAIL_API_KEY: 'key',
      EMAIL_FROM: 'from@noticiencias.com',
      EMAIL_TO: 'to@noticiencias.com',
    } as Env;

    const res = await handleReport(makeRequest(VALID_PAYLOAD), env);
    expect(res.status).toBe(201);
  });

  it('rate-limits after the configured threshold for the same IP', async () => {
    const rateLimitKv = makeFakeKV();
    const r2 = makeFakeR2();
    const env = {
      ENVIRONMENT: 'test',
      REPORT_BUCKET: r2 as never,
      RATE_LIMIT_KV: rateLimitKv as never,
    } as Env;

    const results: number[] = [];
    for (let i = 0; i < 6; i++) {
      // Vary the payload slightly so idempotency doesn't short-circuit this test.
      const req = makeRequest(
        { ...VALID_PAYLOAD, description: `intento ${i}` },
        { 'CF-Connecting-IP': '1.2.3.4' }
      );
      const res = await handleReport(req, env);
      results.push(res.status);
    }

    expect(results.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(results[5]).toBe(429);
  });

  it('returns the same report id for an identical retried payload (idempotency)', async () => {
    const rateLimitKv = makeFakeKV();
    const r2 = makeFakeR2();
    const env = {
      ENVIRONMENT: 'test',
      REPORT_BUCKET: r2 as never,
      RATE_LIMIT_KV: rateLimitKv as never,
    } as Env;

    const first = await handleReport(makeRequest(VALID_PAYLOAD), env);
    const firstJson = (await first.json()) as { id: string };

    const second = await handleReport(makeRequest(VALID_PAYLOAD), env);
    const secondJson = (await second.json()) as { id: string };

    expect(secondJson.id).toBe(firstJson.id);
    // Only one object should actually have been written to R2.
    expect(r2.objects.size).toBe(1);
  });

  it('does not log the reporter email or description', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const r2 = makeFakeR2();
    const env = { ENVIRONMENT: 'test', REPORT_BUCKET: r2 as never } as Env;

    await handleReport(
      makeRequest({
        ...VALID_PAYLOAD,
        reporter_email: 'secreto@example.com',
        description: 'informacion-sensible-del-reporte',
      }),
      env
    );

    const logged = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).not.toContain('secreto@example.com');
    expect(logged).not.toContain('informacion-sensible-del-reporte');
    consoleSpy.mockRestore();
  });
});
