import { describe, expect, it, vi } from 'vitest';
import { parseCurlMetadata, probeUrl, runPostDeployCheck } from '../scripts/post-deploy-check-lib.js';

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function htmlResponse(html: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...headers,
    },
  });
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function createHomeHtml() {
  return `
    <!doctype html>
    <html>
      <head><title>Noticiencias - Ciencia global, en español.</title></head>
      <body>
        <article><a href="/ciencia/uno/">Uno</a></article>
        <article><a href="/ciencia/dos/">Dos</a></article>
        <article><a href="/ciencia/tres/">Tres</a></article>
      </body>
    </html>
  `;
}

function createArticleHtml() {
  return `
    <!doctype html>
    <html>
      <head><title>Noticiencias | Articulo</title></head>
      <body>
        <h1>Articulo publicado</h1>
        <img src="/image.jpg" alt="Articulo" />
      </body>
    </html>
  `;
}

function edgeBlockedResponse(status = 403) {
  return htmlResponse('<html><title>Attention Required</title></html>', status, {
    server: 'cloudflare',
    'cf-ray': 'abc123',
    'cf-cache-status': 'DYNAMIC',
  });
}

function curlResult(body: string, status: number, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    body,
    headers,
    transport: 'curl' as const,
    url: 'https://noticiencias.com/',
    error: null,
  };
}

function mockFetchSequence(sequence: Array<Response | Error>) {
  return vi.fn(async () => {
    const next = sequence.shift();

    if (!next) {
      throw new Error('Unexpected fetch call');
    }

    if (next instanceof Error) {
      throw next;
    }

    return next;
  });
}

describe('Post-deploy deploy checker', () => {
  it('passes on an immediate healthy deployment', async () => {
    const fetchImpl = mockFetchSequence([
      htmlResponse(createHomeHtml()),
      htmlResponse(createArticleHtml()),
      jsonResponse([{ title: 'Uno', url: '/ciencia/uno/' }]),
    ]);

    const result = await runPostDeployCheck('https://noticiencias.com/', {
      mode: 'hybrid',
      fetchImpl,
      retryDelaysMs: [0],
      sleep: async () => {},
      logger: silentLogger,
    });

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('retries a transient 503 and succeeds within the retry window', async () => {
    const fetchImpl = mockFetchSequence([
      htmlResponse('temporary failure', 503),
      htmlResponse(createHomeHtml()),
    ]);

    const result = await probeUrl('https://noticiencias.com/', {
      mode: 'hybrid',
      fetchImpl,
      retryDelaysMs: [0, 1],
      sleep: async () => {},
      logger: silentLogger,
    });

    expect(result.outcome).toBe('success');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('uses curl fallback to recover from a Cloudflare-style 403', async () => {
    const fetchImpl = mockFetchSequence([edgeBlockedResponse()]);
    const curlRunner = vi.fn(async () => curlResult(createHomeHtml(), 200, { server: 'cloudflare' }));

    const result = await probeUrl('https://noticiencias.com/', {
      mode: 'hybrid',
      fetchImpl,
      curlRunner,
      retryDelaysMs: [0],
      sleep: async () => {},
      logger: silentLogger,
    });

    expect(result.outcome).toBe('success');
    expect(curlRunner).toHaveBeenCalledTimes(1);
  });

  it('warns and passes in hybrid mode when Cloudflare-style 403 persists', async () => {
    const fetchImpl = mockFetchSequence([edgeBlockedResponse(), edgeBlockedResponse()]);
    const curlRunner = vi.fn(async () =>
      curlResult('<html>Attention Required</html>', 403, { server: 'cloudflare', 'cf-ray': 'abc123' })
    );

    const result = await runPostDeployCheck('https://noticiencias.com/', {
      mode: 'hybrid',
      fetchImpl,
      curlRunner,
      retryDelaysMs: [0, 1],
      sleep: async () => {},
      logger: silentLogger,
    });

    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('continuing in hybrid mode');
  });

  it('fails in strict-live mode when Cloudflare-style 403 persists', async () => {
    const fetchImpl = mockFetchSequence([edgeBlockedResponse(), edgeBlockedResponse()]);
    const curlRunner = vi.fn(async () =>
      curlResult('<html>Attention Required</html>', 403, { server: 'cloudflare', 'cf-ray': 'abc123' })
    );

    await expect(
      runPostDeployCheck('https://noticiencias.com/', {
        mode: 'strict-live',
        fetchImpl,
        curlRunner,
        retryDelaysMs: [0, 1],
        sleep: async () => {},
        logger: silentLogger,
      })
    ).rejects.toThrow(/Failed to fetch/);
  });

  it('fails on invalid homepage HTML invariants', async () => {
    const fetchImpl = mockFetchSequence([
      htmlResponse('<html><head><title>Wrong Site</title></head><body><article>One</article></body></html>'),
    ]);

    await expect(
      runPostDeployCheck('https://noticiencias.com/', {
        mode: 'hybrid',
        fetchImpl,
        retryDelaysMs: [0],
        sleep: async () => {},
        logger: silentLogger,
      })
    ).rejects.toThrow(/Home title missing 'Noticiencias'/);
  });

  it('fails when search.json is invalid', async () => {
    const fetchImpl = mockFetchSequence([
      htmlResponse(createHomeHtml()),
      htmlResponse(createArticleHtml()),
      jsonResponse({ title: 'not-an-array' }),
    ]);

    await expect(
      runPostDeployCheck('https://noticiencias.com/', {
        mode: 'hybrid',
        fetchImpl,
        retryDelaysMs: [0],
        sleep: async () => {},
        logger: silentLogger,
      })
    ).rejects.toThrow(/Search index is not an array/);
  });

  it('fails when search.json is empty', async () => {
    const fetchImpl = mockFetchSequence([
      htmlResponse(createHomeHtml()),
      htmlResponse(createArticleHtml()),
      jsonResponse([]),
    ]);

    await expect(
      runPostDeployCheck('https://noticiencias.com/', {
        mode: 'hybrid',
        fetchImpl,
        retryDelaysMs: [0],
        sleep: async () => {},
        logger: silentLogger,
      })
    ).rejects.toThrow(/Search index is empty/);
  });

  it('parses multiline curl header metadata without crashing', () => {
    const output = [
      '<html>ok</html>',
      '__NOTICIENCIAS_CURL_STATUS__:403',
      '__NOTICIENCIAS_CURL_HEADERS__:{',
      '"server":["cloudflare"],',
      '"cf-ray":["abc123-IAD"]',
      '}',
      '__NOTICIENCIAS_CURL_END__:1',
      '',
    ].join('\n');

    const parsed = parseCurlMetadata(output, {
      statusMarker: '__NOTICIENCIAS_CURL_STATUS__',
      headerMarker: '__NOTICIENCIAS_CURL_HEADERS__',
      endMarker: '__NOTICIENCIAS_CURL_END__',
    });

    expect(parsed.status).toBe(403);
    expect(parsed.body).toContain('<html>ok</html>');
    expect(parsed.headers).toEqual({
      server: ['cloudflare'],
      'cf-ray': ['abc123-IAD'],
    });
  });
});
