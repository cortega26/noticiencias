/**
 * noticiencias-api — Cloudflare Worker
 *
 * Handles interactive endpoints under /api/*:
 *   POST /api/report  — form submission from reportar-problema page
 *   GET  /api/health  — health check
 *   GET  /api/status  — pipeline status (reads from R2/KV)
 *
 * Also performs Accept-based Markdown negotiation for article pages (see
 * docs/adr/0008-markdown-for-agents.md in the frontend repo): an
 * `Accept: text/markdown` request for an eligible article is served the
 * prebuilt artifact at `/llm-md/<same path>.md`; every other request
 * (including all static assets, now that the route covers the whole
 * zone) passes straight through to GitHub Pages, unchanged from today.
 */

import { handleReport } from './handlers/report';
import { handleStatus } from './handlers/status';
import { handleHealth } from './handlers/status';
import { prefersMarkdown } from './utils/accept';

/**
 * Adds `Accept` to a response's Vary header without destroying whatever
 * the origin already sent — GitHub Pages/Fastly sends `Vary:
 * Accept-Encoding` on every response (confirmed live), and a bare
 * `headers.set('Vary', 'Accept')` would silently discard that.
 */
function addVaryAccept(headers: Headers): void {
  const existing = headers.get('Vary');
  if (!existing) {
    headers.set('Vary', 'Accept');
    return;
  }
  const values = existing.split(',').map((v) => v.trim());
  if (!values.some((v) => v.toLowerCase() === 'accept')) {
    headers.set('Vary', `${existing}, Accept`);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // POST /api/report — form submission
    if (pathname === '/api/report' && method === 'POST') {
      return handleReport(request, env);
    }

    // GET /api/health — health check
    if (pathname === '/api/health' && method === 'GET') {
      return handleHealth(env);
    }

    // GET /api/status — pipeline status
    if (pathname === '/api/status' && method === 'GET') {
      return handleStatus(env);
    }

    // CORS preflight for /api/* routes
    if (method === 'OPTIONS' && pathname.startsWith('/api/')) {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // Unknown /api/* path — preserve the existing 404 contract rather than
    // falling through to origin passthrough below.
    if (pathname.startsWith('/api/')) {
      return new Response('Not Found', { status: 404 });
    }

    // Recursion guard: the artifact namespace is never itself negotiated.
    if (pathname.startsWith('/llm-md/')) {
      return fetch(request);
    }

    // Supplementary platform-level net for a genuinely uncaught exception
    // below; the explicit try/catch is the primary defense (see ADR).
    ctx.passThroughOnException();
    try {
      if (method === 'GET' && prefersMarkdown(request.headers.get('Accept'))) {
        const markdownUrl = new URL(`/llm-md${pathname}.md`, url);
        const markdownResponse = await fetch(markdownUrl);
        if (markdownResponse.ok) {
          const response = new Response(markdownResponse.body, markdownResponse);
          response.headers.set('Content-Type', 'text/markdown; charset=utf-8');
          addVaryAccept(response.headers);
          return response;
        }
        // No artifact for this path (non-article page, v1 post, or not
        // built) — fall through to the ordinary HTML passthrough below.
      }
    } catch {
      // Explicit application-level fail-open — never surface an error to
      // the client; serve the normal HTML response instead.
    }

    const originResponse = await fetch(request);

    // RFC 9110 §12.5.5: only the HTML representation actually varies by
    // Accept (it has a Markdown counterpart); non-HTML assets (images,
    // CSS, JS, RSS, sitemap, JSON, ...) never do, so leave them untouched
    // — no reason to touch their headers, including the origin's own
    // `Vary: Accept-Encoding`.
    if (!(originResponse.headers.get('Content-Type') ?? '').includes('text/html')) {
      return originResponse;
    }

    const response = new Response(originResponse.body, originResponse);
    addVaryAccept(response.headers);
    return response;
  },
};

// ---------------------------------------------------------------------------
// Environment bindings
// ---------------------------------------------------------------------------

export interface Env {
  ENVIRONMENT: string;
  // R2 bucket for storing form submissions (optional)
  REPORT_BUCKET?: R2Bucket;
  // KV namespace for pipeline status (optional)
  STATUS_KV?: KVNamespace;
  // KV namespace for report-endpoint rate limiting + idempotency (optional)
  RATE_LIMIT_KV?: KVNamespace;
  // Email service API key (optional — SendGrid, Mailgun, etc.)
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_TO?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': 'https://noticiencias.com',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
  };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
