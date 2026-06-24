/**
 * noticiencias-api — Cloudflare Worker
 *
 * Handles interactive endpoints under /api/*:
 *   POST /api/report  — form submission from reportar-problema page
 *   GET  /api/health  — health check
 *   GET  /api/status  — pipeline status (reads from R2/KV)
 *
 * All other paths pass through to GitHub Pages (no Worker routing).
 */

import { handleReport } from './handlers/report';
import { handleStatus } from './handlers/status';
import { handleHealth } from './handlers/status';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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

    // Not a Worker route — should not be reached if route pattern is correct
    return new Response('Not Found', { status: 404 });
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
