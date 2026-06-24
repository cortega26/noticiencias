#!/usr/bin/env node
/**
 * backend-notify.js
 *
 * Sends validation results to the backend webhook endpoint.
 * Called from CI workflows after content validation steps.
 *
 * Usage:
 *   node scripts/backend-notify.js --status=pass|fail --payload-file=<path>
 *
 * Environment:
 *   BACKEND_WEBHOOK_URL — backend webhook endpoint (required)
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
 *     run_url: "https://github.com/<owner>/<repo>/actions/runs/<run_id>"
 *   }
 */

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let status = null;
let payloadFile = null;
let event = 'validation_result';

for (const arg of args) {
  if (arg.startsWith('--status=')) {
    status = arg.slice('--status='.length);
  } else if (arg.startsWith('--payload-file=')) {
    payloadFile = arg.slice('--payload-file='.length);
  } else if (arg.startsWith('--event=')) {
    event = arg.slice('--event='.length);
  } else if (arg === '--help' || arg === '-h') {
    console.log(`Usage:
  node scripts/backend-notify.js --status=pass|fail --payload-file=<path>
  node scripts/backend-notify.js --status=pass|fail --payload-file=<path> --event=publish_complete

Environment:
  BACKEND_WEBHOOK_URL — backend webhook endpoint (required)`);
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

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let diagnostics;
try {
  const raw = readFileSync(resolve(payloadFile), 'utf-8');
  diagnostics = JSON.parse(raw);
  if (!Array.isArray(diagnostics)) {
    diagnostics = [diagnostics];
  }
} catch (e) {
  console.error(`[backend-notify] Cannot read payload file: ${payloadFile}\n${e.message}`);
  process.exit(2);
}

const repo = process.env.GITHUB_REPOSITORY || 'unknown';
const sha = process.env.GITHUB_SHA || 'unknown';
const branch = process.env.GITHUB_REF_NAME || 'unknown';
const runId = process.env.GITHUB_RUN_ID || 'unknown';

const payload = {
  event,
  commit_sha: sha,
  branch,
  status,
  diagnostics,
  frontend_ref: sha,
  run_url: `https://github.com/${repo}/actions/runs/${runId}`,
  timestamp: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Send notification
// ---------------------------------------------------------------------------

try {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    console.log(`[backend-notify] Notification sent (${response.status})`);
  } else {
    const body = await response.text().catch(() => '');
    console.error(
      `[backend-notify] Backend responded with ${response.status}: ${body.slice(0, 200)}`
    );
    // Non-fatal: notification failure should not block the pipeline
  }
} catch (err) {
  console.error(`[backend-notify] Failed to send notification: ${err.message}`);
  // Non-fatal
}
