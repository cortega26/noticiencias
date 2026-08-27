/**
 * Markdown-negotiation tests for the broadened Worker route (see
 * docs/adr/0008-markdown-for-agents.md in the frontend repo). Exercises
 * the real fetch boundary the same way fetch-boundary.test.ts does, but
 * mocks the outbound origin/artifact fetch calls (vi.spyOn(globalThis,
 * 'fetch')) the same way tests/report.handler.test.ts already does, so
 * no test here makes a real network request.
 */

import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker, { type Env as WorkerEnv } from '../src';

const testEnv = { ENVIRONMENT: 'test' } as unknown as WorkerEnv;

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

function get(path: string, accept?: string): Request {
  return new IncomingRequest(`https://noticiencias.com${path}`, {
    headers: accept ? { Accept: accept } : {},
  });
}

function extractUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

// GitHub Pages/Fastly sends `Vary: Accept-Encoding` on every real response
// (confirmed live against production) — mocks default to that so tests
// exercise the actual merge behavior, not an idealized header-free origin.
function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    ...init,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      Vary: 'Accept-Encoding',
      ...init.headers,
    },
  });
}

function assetResponse(body: string, contentType: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': contentType, Vary: 'Accept-Encoding' },
  });
}

async function fetchThrough(request: Request): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

describe('worker Markdown negotiation (ADR-0008)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('serves the Markdown artifact for an eligible article with Accept: text/markdown', async () => {
    fetchSpy.mockImplementation(async (input: string | URL | Request) => {
      const url = extractUrl(input);
      if (url.includes('/llm-md/')) {
        return new Response('# Título\n\ncontenido', { status: 200 });
      }
      return htmlResponse('<html>html</html>');
    });

    const response = await fetchThrough(get('/ciencia/algun-articulo', 'text/markdown'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('Vary')).toBe('Accept');
    expect(await response.text()).toContain('contenido');

    const requestedUrls = fetchSpy.mock.calls.map((call: unknown[]) =>
      extractUrl(call[0] as string | URL | Request)
    );
    expect(requestedUrls).toContain('https://noticiencias.com/llm-md/ciencia/algun-articulo.md');
  });

  it('falls back to HTML when no Markdown artifact exists for the path', async () => {
    fetchSpy.mockImplementation(async (input: string | URL | Request) => {
      const url = extractUrl(input);
      if (url.includes('/llm-md/')) {
        return new Response('Not Found', { status: 404 });
      }
      return htmlResponse('<html>html</html>');
    });

    const response = await fetchThrough(get('/una-pagina-no-articulo', 'text/markdown'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<html>html</html>');
  });

  it('goes straight to origin HTML for an ordinary browser Accept header (no markdown fetch attempted)', async () => {
    fetchSpy.mockResolvedValue(htmlResponse('<html>html</html>'));

    const response = await fetchThrough(
      get('/ciencia/algun-articulo', 'text/html,application/xhtml+xml,*/*;q=0.8')
    );

    expect(await response.text()).toBe('<html>html</html>');
    // Merged, not overwritten — the origin's own Vary: Accept-Encoding
    // must survive alongside the negotiation Vary: Accept.
    expect(response.headers.get('Vary')).toBe('Accept-Encoding, Accept');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledWith] = fetchSpy.mock.calls[0];
    const calledUrl = extractUrl(calledWith as string | URL | Request);
    expect(calledUrl).not.toContain('/llm-md/');
  });

  it('serves HTML for a bare */* Accept header (no explicit markdown preference)', async () => {
    fetchSpy.mockResolvedValue(htmlResponse('<html>html</html>'));

    const response = await fetchThrough(get('/ciencia/algun-articulo', '*/*'));

    expect(await response.text()).toBe('<html>html</html>');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('serves HTML when the client explicitly disables markdown with q=0', async () => {
    fetchSpy.mockResolvedValue(htmlResponse('<html>html</html>'));

    const response = await fetchThrough(
      get('/ciencia/algun-articulo', 'text/markdown;q=0, text/html')
    );

    expect(await response.text()).toBe('<html>html</html>');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('leaves non-HTML assets completely untouched (no Vary: Accept added)', async () => {
    fetchSpy.mockResolvedValue(assetResponse('body { color: red }', 'text/css; charset=utf-8'));

    const response = await fetchThrough(get('/_astro/some-chunk.css'));

    expect(await response.text()).toBe('body { color: red }');
    expect(response.headers.get('Vary')).toBe('Accept-Encoding');
    expect(response.headers.get('Content-Type')).toBe('text/css; charset=utf-8');
  });

  it('preserves the origin Vary header on the Markdown branch too', async () => {
    fetchSpy.mockImplementation(async (input: string | URL | Request) => {
      const url = extractUrl(input);
      if (url.includes('/llm-md/')) {
        return assetResponse('# contenido', 'text/plain; charset=utf-8');
      }
      return htmlResponse('<html>html</html>');
    });

    const response = await fetchThrough(get('/ciencia/algun-articulo', 'text/markdown'));

    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('Vary')).toBe('Accept-Encoding, Accept');
  });

  it('does not duplicate Accept if the origin already varies by it', async () => {
    fetchSpy.mockResolvedValue(htmlResponse('<html>html</html>', { headers: { Vary: 'accept' } }));

    const response = await fetchThrough(get('/ciencia/algun-articulo', 'text/html'));

    expect(response.headers.get('Vary')).toBe('accept');
  });

  it('never negotiates requests already under /llm-md/ (recursion guard)', async () => {
    fetchSpy.mockResolvedValue(new Response('# artifact', { status: 200 }));

    const response = await fetchThrough(get('/llm-md/ciencia/algun-articulo.md', 'text/markdown'));

    expect(await response.text()).toBe('# artifact');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('fails open to HTML when the negotiation path throws', async () => {
    fetchSpy.mockImplementation(async (input: string | URL | Request) => {
      const url = extractUrl(input);
      if (url.includes('/llm-md/')) {
        throw new Error('boom');
      }
      return htmlResponse('<html>html</html>');
    });

    const response = await fetchThrough(get('/ciencia/algun-articulo', 'text/markdown'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<html>html</html>');
  });

  it('still returns 404 for an unknown /api/* path (unchanged by the broadened route)', async () => {
    fetchSpy.mockResolvedValue(htmlResponse('<html>html</html>'));

    const response = await fetchThrough(get('/api/unknown'));

    expect(response.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
