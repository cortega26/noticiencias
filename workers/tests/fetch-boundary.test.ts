/**
 * Fetch-boundary tests (plan 031 Step 3) — exercise the real Worker routing
 * layer (default export's fetch) inside the actual workerd runtime via the
 * Cloudflare Vitest pool, with real miniflare R2/KV bindings.
 *
 * These complement (not duplicate) report.handler.test.ts: that file calls
 * handleReport() directly with mocked Env; this file goes through the
 * exported fetch boundary — path/method dispatch, CORS, and the
 * request-scoped bindings workerd actually provides.
 */

import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import worker, { type Env as WorkerEnv } from '../src';

// cloudflare:test's env is typed as the generated Cloudflare.Env, whose
// bindings are optional; the Worker's own Env declares ENVIRONMENT required.
// The miniflare pool provides all bindings below, so the cast is safe.
const testEnv = env as unknown as WorkerEnv;

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  return new IncomingRequest(`https://noticiencias.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: json,
  });
}

/**
 * Each test gets its own client IP so the per-file shared KV storage does
 * not accumulate rate-limit hits across tests (rate limiting keys on
 * CF-Connecting-IP, which defaults to 'unknown' when absent).
 */
let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  return `10.0.0.${ipCounter % 250 + 1}`;
}

async function fetchThrough(request: Request): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

const VALID_PAYLOAD = { problem_type: 'content_factual', description: 'Algo está mal' };

describe('worker fetch boundary (plan 031)', () => {
  beforeEach(async () => {
    // Isolated per-test storage: reset the report bucket and rate-limit KV.
    // The pool config (vitest.config.ts) always provides both bindings.
    await testEnv.REPORT_BUCKET!.delete('reports/2026-08-11/test.json').catch(() => {});
    await testEnv.RATE_LIMIT_KV!.delete('test-key').catch(() => {});
  });

  it('routes POST /api/report to the report handler (201)', async () => {
    const response = await fetchThrough(post('/api/report', VALID_PAYLOAD, { 'CF-Connecting-IP': uniqueIp() }));
    expect(response.status).toBe(201);
    const json = (await response.json()) as { id: string };
    expect(json.id).toBeTruthy();
  });

  it('returns 404 for unknown /api paths', async () => {
    const response = await fetchThrough(post('/api/unknown', VALID_PAYLOAD, { 'CF-Connecting-IP': uniqueIp() }));
    expect(response.status).toBe(404);
  });

  it('returns 404 for GET /api/report (method not routed)', async () => {
    const response = await fetchThrough(
      new IncomingRequest('https://noticiencias.com/api/report', {
        headers: { 'CF-Connecting-IP': uniqueIp() },
      })
    );
    expect(response.status).toBe(404);
  });

  it('returns 204 CORS preflight for /api/* with the CORS headers', async () => {
    const response = await fetchThrough(
      new IncomingRequest('https://noticiencias.com/api/report', {
        method: 'OPTIONS',
        headers: { 'CF-Connecting-IP': uniqueIp() },
      })
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://noticiencias.com');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('returns 204 CORS preflight for other /api/* routes', async () => {
    const response = await fetchThrough(
      new IncomingRequest('https://noticiencias.com/api/health', {
        method: 'OPTIONS',
        headers: { 'CF-Connecting-IP': uniqueIp() },
      })
    );
    expect(response.status).toBe(204);
  });

  it('returns 400 for malformed JSON at the boundary', async () => {
    const response = await fetchThrough(post('/api/report', '{not json', { 'CF-Connecting-IP': uniqueIp() }));
    expect(response.status).toBe(400);
  });

  it('returns 422 for a schema-invalid payload (bogus problem_type)', async () => {
    const response = await fetchThrough(
      post('/api/report', { problem_type: 'bogus' }, { 'CF-Connecting-IP': uniqueIp() })
    );
    expect(response.status).toBe(422);
  });

  it('rejects oversized bodies at the boundary with 413', async () => {
    const response = await fetchThrough(
      post(
        '/api/report',
        { problem_type: 'content_factual', description: 'x'.repeat(30_000) },
        { 'CF-Connecting-IP': uniqueIp() }
      )
    );
    expect(response.status).toBe(413);
  });

  it('rate-limits the same IP after 5 requests at the boundary', async () => {
    const ip = uniqueIp();
    const results: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await fetchThrough(
        post('/api/report', { ...VALID_PAYLOAD, description: `intento ${i}` }, {
          'CF-Connecting-IP': ip,
        })
      );
      results.push(response.status);
    }
    expect(results.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(results[5]).toBe(429);
  });

  it('returns the same id for an identical retried payload (idempotency at the boundary)', async () => {
    const ip = uniqueIp();
    const first = await fetchThrough(post('/api/report', VALID_PAYLOAD, { 'CF-Connecting-IP': ip }));
    const firstJson = (await first.json()) as { id: string };
    const second = await fetchThrough(post('/api/report', VALID_PAYLOAD, { 'CF-Connecting-IP': ip }));
    const secondJson = (await second.json()) as { id: string };
    expect(secondJson.id).toBe(firstJson.id);
  });

  it('never exposes the token or email in responses', async () => {
    const response = await fetchThrough(
      post(
        '/api/report',
        {
          ...VALID_PAYLOAD,
          reporter_email: 'secreto@example.com',
          description: 'contenido-sensible',
        },
        { 'CF-Connecting-IP': uniqueIp() }
      )
    );
    const text = await response.text();
    expect(text).not.toContain('secreto@example.com');
    expect(text).not.toContain('contenido-sensible');
  });

  it('routes GET /api/health through the boundary', async () => {
    const response = await fetchThrough(
      new IncomingRequest('https://noticiencias.com/api/health', {
        headers: { 'CF-Connecting-IP': uniqueIp() },
      })
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { status: string };
    expect(json.status).toBe('ok');
  });
});
