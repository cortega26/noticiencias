/**
 * GET /api/health  — health check
 * GET /api/status — pipeline status
 */

import { type Env, jsonResponse } from '../index';

export async function handleHealth(env: Env): Promise<Response> {
  return jsonResponse({
    status: 'ok',
    environment: env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  });
}

export async function handleStatus(env: Env): Promise<Response> {
  // Try to read pipeline status from KV if configured
  let pipelineStatus = null;
  if (env.STATUS_KV) {
    try {
      const raw = await env.STATUS_KV.get('pipeline-status', 'json');
      if (raw) {
        pipelineStatus = raw;
      }
    } catch (err) {
      console.error('Failed to read pipeline status from KV:', err);
    }
  }

  // Fallback: return basic status
  return jsonResponse({
    status: 'ok',
    environment: env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
    pipeline: pipelineStatus || {
      status: 'unknown',
      message: 'Pipeline status not yet reported. Metrics generation may not have run.',
    },
  });
}
