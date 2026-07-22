#!/usr/bin/env node
/**
 * backend-notify.js
 *
 * Sends validation results to the backend webhook endpoint.
 * Called from CI workflows after content validation steps, or imported
 * directly by other sender scripts (e.g. post-publish-callback.js) that
 * want to build and send an envelope in-process rather than round-tripping
 * through a payload file and a subprocess.
 *
 * CLI usage:
 *   node scripts/backend-notify.js --status=pass|fail --payload-file=<path> [--publication-ids-file=<path>]
 *
 * Environment:
 *   BACKEND_WEBHOOK_URL — backend webhook endpoint (required)
 *   BACKEND_WEBHOOK_TOKEN — sent as "Authorization: Bearer <token>" when set
 *   GITHUB_SHA, GITHUB_REF_NAME, GITHUB_RUN_ID — injected by GitHub Actions
 *
 * Contract (POST to BACKEND_WEBHOOK_URL):
 *   {
 *     event: "validation_result",
 *     commit_sha: "<sha>",
 *     branch: "<branch>",
 *     status: "pass" | "fail",
 *     diagnostics: [
 *       { check: "frontmatter-dates", status: "pass", filesCount: N, errors: [...] },
 *       ...
 *     ],
 *     frontend_ref: "<sha>",
 *     run_url: "https://github.com/<owner>/<repo>/actions/runs/<run_id>",
 *     publication_ids: ["<refinery_id>", ...]
 *   }
 *
 * This module owns envelope construction — CLI callers pass raw diagnostic
 * record(s) via --payload-file (a single object or an array of them),
 * never a pre-built envelope, or it ends up double-nested inside
 * `diagnostics`. In-process callers get the same guarantee for free by
 * using buildEnvelope() instead of hand-assembling a payload.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Build the webhook envelope. `diagnostics` may be a single diagnostic
 * object or an array of them — always normalized to an array here, so
 * callers never need to remember which shape to pass.
 *
 * @param {object} opts
 * @param {string} opts.event
 * @param {string} opts.status
 * @param {object | object[]} opts.diagnostics
 * @param {string[]} [opts.publicationIds]
 * @param {Record<string, string | undefined>} [opts.githubEnv]
 */
export function buildEnvelope({ event, status, diagnostics, publicationIds = [], githubEnv = {} }) {
  const env = githubEnv;
  const repo = env.GITHUB_REPOSITORY || 'unknown';
  const sha = env.GITHUB_SHA || 'unknown';
  const branch = env.GITHUB_REF_NAME || 'unknown';
  const runId = env.GITHUB_RUN_ID || 'unknown';

  return {
    event,
    commit_sha: sha,
    branch,
    status,
    diagnostics: Array.isArray(diagnostics) ? diagnostics : [diagnostics],
    frontend_ref: sha,
    run_url: `https://github.com/${repo}/actions/runs/${runId}`,
    timestamp: new Date().toISOString(),
    publication_ids: publicationIds || [],
  };
}

/**
 * POST an already-built envelope to the backend webhook. Best-effort:
 * never throws — logs and returns a result object instead, so CI never
 * blocks on backend notification. Never logs `webhookToken`.
 *
 * @param {object} opts
 * @param {string} opts.webhookUrl
 * @param {string} [opts.webhookToken]
 * @param {unknown} opts.payload
 * @param {typeof fetch} [opts.fetchImpl]
 */
export async function sendWebhookNotification({
  webhookUrl,
  webhookToken,
  payload,
  fetchImpl = fetch,
}) {
  if (!webhookUrl) {
    console.error('[backend-notify] BACKEND_WEBHOOK_URL not set. Skipping notification.');
    return { skipped: true };
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (webhookToken) {
    headers.Authorization = `Bearer ${webhookToken}`;
  }

  try {
    const response = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`[backend-notify] Notification sent (${response.status})`);
    } else {
      const body = await response.text().catch(() => '');
      console.error(
        `[backend-notify] Backend responded with ${response.status}: ${body.slice(0, 200)}`
      );
    }
    return { ok: response.ok, status: response.status };
  } catch (err) {
    console.error(`[backend-notify] Failed to send notification: ${err.message}`);
    return { error: err.message };
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  let status = null;
  let payloadFile = null;
  let event = 'validation_result';
  let publicationIdsFile = null;

  for (const arg of args) {
    if (arg.startsWith('--status=')) {
      status = arg.slice('--status='.length);
    } else if (arg.startsWith('--payload-file=')) {
      payloadFile = arg.slice('--payload-file='.length);
    } else if (arg.startsWith('--event=')) {
      event = arg.slice('--event='.length);
    } else if (arg.startsWith('--publication-ids-file=')) {
      publicationIdsFile = arg.slice('--publication-ids-file='.length);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  node scripts/backend-notify.js --status=pass|fail --payload-file=<path> [--publication-ids-file=<path>]
  node scripts/backend-notify.js --status=pass|fail --payload-file=<path> --event=publish_complete [--publication-ids-file=<path>]

Environment:
  BACKEND_WEBHOOK_URL — backend webhook endpoint (required)
  BACKEND_WEBHOOK_TOKEN — sent as "Authorization: Bearer <token>" when set`);
      process.exit(0);
    }
  }

  if (!status) {
    console.error('[backend-notify] ERROR: --status is required (pass|fail)');
    process.exit(2);
  }
  if (!payloadFile) {
    console.error('[backend-notify] ERROR: --payload-file is required');
    process.exit(2);
  }

  const webhookUrl = process.env.BACKEND_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[backend-notify] ERROR: BACKEND_WEBHOOK_URL environment variable is not set.');
    console.error('[backend-notify] Skipping notification — no webhook URL configured.');
    process.exit(0); // Non-fatal: notification is best-effort
  }

  let diagnostics;
  try {
    const raw = readFileSync(resolve(payloadFile), 'utf-8');
    diagnostics = JSON.parse(raw);
  } catch (e) {
    console.error(`[backend-notify] Cannot read payload file: ${payloadFile}\n${e.message}`);
    process.exit(2);
  }

  let publicationIds = [];
  if (publicationIdsFile) {
    try {
      const raw = readFileSync(resolve(publicationIdsFile), 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        publicationIds = parsed;
      } else {
        console.error(
          `[backend-notify] --publication-ids-file must contain a JSON array, got ${typeof parsed}`
        );
      }
    } catch (e) {
      console.error(
        `[backend-notify] Cannot read publication-ids file: ${publicationIdsFile}\n${e.message}`
      );
    }
  }

  const payload = buildEnvelope({
    event,
    status,
    diagnostics,
    publicationIds,
    githubEnv: process.env,
  });

  await sendWebhookNotification({
    webhookUrl,
    webhookToken: process.env.BACKEND_WEBHOOK_TOKEN,
    payload,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
