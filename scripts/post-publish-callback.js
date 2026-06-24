#!/usr/bin/env node
/**
 * post-publish-callback.js
 *
 * Sends a "deploy complete" notification to the backend after successful deployment.
 *
 * Usage:
 *   node scripts/post-publish-callback.js [deploy_url]
 *
 * Environment:
 *   BACKEND_WEBHOOK_URL — backend webhook endpoint (optional; skips notification if not set)
 *   GITHUB_SHA, GITHUB_REF_NAME, GITHUB_RUN_ID — injected by GitHub Actions
 */

import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const deployUrl = process.argv[2] || process.env.DEPLOY_URL || '';
const webhookUrl = process.env.BACKEND_WEBHOOK_URL;

// ---------------------------------------------------------------------------
// Count published articles
// ---------------------------------------------------------------------------

function countArticles() {
  const postsDir = resolve(REPO_ROOT, 'src', 'content', 'posts');
  try {
    return readdirSync(postsDir).filter((f) => f.endsWith('.md') || f.endsWith('.mdx')).length;
  } catch {
    return 0;
  }
}

const articleCount = countArticles();
const repo = process.env.GITHUB_REPOSITORY || 'unknown';
const sha = process.env.GITHUB_SHA || 'unknown';
const branch = process.env.GITHUB_REF_NAME || 'unknown';
const runId = process.env.GITHUB_RUN_ID || 'unknown';

const payload = {
  event: 'publish_complete',
  commit_sha: sha,
  branch,
  status: 'success',
  diagnostics: [
    {
      check: 'deploy',
      status: 'pass',
      article_count: articleCount,
      deploy_url: deployUrl,
    },
  ],
  frontend_ref: sha,
  run_url: `https://github.com/${repo}/actions/runs/${runId}`,
  timestamp: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Write payload to data/
// ---------------------------------------------------------------------------

try {
  mkdirSync(resolve(REPO_ROOT, 'data'), { recursive: true });
} catch {
  // Directory already exists
}

const payloadFile = resolve(REPO_ROOT, 'data', 'post-publish-payload.json');
writeFileSync(payloadFile, JSON.stringify(payload, null, 2));

console.log(`[post-publish-callback] Deploy complete. ${articleCount} articles published.`);
if (deployUrl) {
  console.log(`[post-publish-callback] Deploy URL: ${deployUrl}`);
}

// ---------------------------------------------------------------------------
// Notify backend (best-effort)
// ---------------------------------------------------------------------------

if (!webhookUrl) {
  console.log('[post-publish-callback] BACKEND_WEBHOOK_URL not set. Skipping notification.');
  process.exit(0);
}

console.log(`[post-publish-callback] Notifying backend at ${webhookUrl}...`);

const result = spawnSync(
  'node',
  [
    resolve(__dirname, 'backend-notify.js'),
    '--status=success',
    `--payload-file=${payloadFile}`,
    '--event=publish_complete',
  ],
  {
    cwd: REPO_ROOT,
    timeout: 15000,
    encoding: 'utf-8',
    stdio: 'inherit',
  }
);

if (result.status !== 0) {
  console.warn('[post-publish-callback] Backend notification had issues but deploy was successful.');
}
