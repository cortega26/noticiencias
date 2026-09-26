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
 *     publication_ids: ["<refinery_id>", ...],
 *     delivery_id: "v1:<run_id>:<event>"   // present in CI; backend dedupes
 *   }
 *
 * Sending is bounded-retry best-effort: transient failures (network, 429,
 * 5xx) are retried with exponential backoff; other 4xx are not. After the
 * final failed attempt a JSON diagnostic artifact is written to the path in
 * `BACKEND_NOTIFY_ARTIFACT_PATH` (defaults to the runner temp directory)
 * for CI to upload. The process still exits 0 — deploy never blocks.
 *
 * This module owns envelope construction — CLI callers pass raw diagnostic
 * record(s) via --payload-file (a single object or an array of them),
 * never a pre-built envelope, or it ends up double-nested inside
 * `diagnostics`. In-process callers get the same guarantee for free by
 * using buildEnvelope() instead of hand-assembling a payload.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const DELIVERY_ID_VERSION = 'v1';
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 1000;

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

/**
 * Versioned delivery/idempotency id for one logical callback.
 *
 * Stable across retries of the same workflow run + event, distinct across
 * runs. Returns null when there is no real run id (local invocation), so the
 * backend derives its own stable key instead of us fabricating a shared id.
 */
function deliveryIdFor({ event, runId }) {
  if (!runId || runId === 'unknown') return null;
  return `${DELIVERY_ID_VERSION}:${runId}:${event}`;
}

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

  const deliveryId = deliveryIdFor({ event, runId });
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
    ...(deliveryId ? { delivery_id: deliveryId } : {}),
  };
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

function writeFailureArtifact(artifactPath, { payload, attempts, status, error }) {
  if (!artifactPath) return;
  try {
    const record = {
      event: payload?.event ?? null,
      delivery_id: payload?.delivery_id ?? null,
      run_url: payload?.run_url ?? null,
      attempts,
      ...(status !== undefined ? { status } : {}),
      ...(error ? { error } : {}),
      generated_at: new Date().toISOString(),
    };
    writeFileSync(artifactPath, JSON.stringify(record, null, 2));
    console.error(`[backend-notify] Wrote failure artifact to ${artifactPath}`);
  } catch (err) {
    console.error(`[backend-notify] Could not write failure artifact: ${err.message}`);
  }
}

/**
 * POST an already-built envelope to the backend webhook with bounded
 * retries and exponential backoff. Best-effort: never throws — logs and
 * returns a result object instead, so CI never blocks on backend
 * notification. Never logs `webhookToken`.
 *
 * Retries only transient failures (network errors, 429, 5xx); a 4xx is
 * deterministic and is reported immediately. On final failure an optional
 * JSON diagnostic artifact is written for CI to upload.
 *
 * @param {object} opts
 * @param {string} opts.webhookUrl
 * @param {string} [opts.webhookToken]
 * @param {unknown} opts.payload
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {number} [opts.maxAttempts]
 * @param {number} [opts.baseDelayMs]
 * @param {(ms: number) => Promise<void>} [opts.sleepImpl]
 * @param {string | null} [opts.failureArtifactPath]
 */
export async function sendWebhookNotification({
  webhookUrl,
  webhookToken,
  payload,
  fetchImpl = fetch,
  maxAttempts = Number(process.env.BACKEND_WEBHOOK_MAX_ATTEMPTS) || DEFAULT_MAX_ATTEMPTS,
  baseDelayMs = Number(process.env.BACKEND_WEBHOOK_RETRY_BASE_MS) || DEFAULT_RETRY_BASE_MS,
  sleepImpl = sleep,
  failureArtifactPath = null,
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

  const attempts = Math.max(1, maxAttempts);
  let lastStatus;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(
          `[backend-notify] Notification sent (${response.status}) after ${attempt} attempt(s)`
        );
        return { ok: true, status: response.status, attempts: attempt };
      }

      const body = await response.text().catch(() => '');
      lastStatus = response.status;
      console.error(
        `[backend-notify] Backend responded with ${response.status} (attempt ${attempt}/${attempts}): ${body.slice(0, 200)}`
      );
      if (!isRetryableStatus(response.status)) {
        return { ok: false, status: response.status, attempts: attempt };
      }
    } catch (err) {
      lastError = err.message;
      lastStatus = undefined;
      console.error(`[backend-notify] Attempt ${attempt}/${attempts} failed: ${err.message}`);
    }

    if (attempt < attempts) {
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `[backend-notify] Retrying in ${delay}ms (attempt ${attempt + 1}/${attempts})...`
      );
      await sleepImpl(delay);
    }
  }

  const failure = lastStatus !== undefined ? { status: lastStatus } : { error: lastError };
  console.error(`[backend-notify] Giving up after ${attempts} attempt(s).`);
  writeFailureArtifact(failureArtifactPath, {
    payload,
    attempts,
    status: lastStatus,
    error: lastStatus === undefined ? lastError : undefined,
  });
  return { ok: false, attempts, ...failure };
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

  const failureArtifactPath =
    process.env.BACKEND_NOTIFY_ARTIFACT_PATH ||
    join(process.env.RUNNER_TEMP || process.cwd(), 'backend-notify-failure.json');

  await sendWebhookNotification({
    webhookUrl,
    webhookToken: process.env.BACKEND_WEBHOOK_TOKEN,
    payload,
    failureArtifactPath,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
