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
 *   BACKEND_WEBHOOK_TOKEN — sent as "Authorization: Bearer <token>" when set
 *   GITHUB_SHA, GITHUB_REF_NAME, GITHUB_RUN_ID — injected by GitHub Actions
 *   GITHUB_BASE_SHA — commit before this deploy's push range (used to bound
 *     which posts' refinery_id values become publication_ids)
 *
 * Calls backend-notify.js's buildEnvelope/sendWebhookNotification directly
 * (in-process) rather than writing a payload file and spawning it as a
 * subprocess — that file-based indirection is what previously produced a
 * double-nested envelope (this script's own full envelope, re-wrapped as
 * a single `diagnostics` element by the other script's file-not-array
 * fallback). Calling the exported functions directly makes that bug class
 * structurally impossible.
 */

import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEnvelope, sendWebhookNotification } from './backend-notify.js';
import { getChangedPostRefineryIds } from './utils/publication-ids.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const deployUrl = process.argv[2] || process.env.DEPLOY_URL || '';
const webhookUrl = process.env.BACKEND_WEBHOOK_URL;

function countArticles() {
  const postsDir = resolve(REPO_ROOT, 'src', 'content', 'posts');
  try {
    return readdirSync(postsDir).filter((f) => f.endsWith('.md') || f.endsWith('.mdx')).length;
  } catch {
    return 0;
  }
}

async function main() {
  const articleCount = countArticles();
  const sha = process.env.GITHUB_SHA || 'unknown';
  const baseSha = process.env.GITHUB_BASE_SHA || '';

  const publicationIds =
    baseSha && sha !== 'unknown'
      ? getChangedPostRefineryIds({ baseSha, headSha: sha, repoRoot: REPO_ROOT })
      : [];

  if (!baseSha) {
    console.warn(
      '[post-publish-callback] GITHUB_BASE_SHA not set — cannot bound the changed-post ' +
        'set for this deploy. publication_ids will be empty, so the backend will not ' +
        'transition any article to completed for this callback.'
    );
  }

  console.log(`[post-publish-callback] Deploy complete. ${articleCount} articles published.`);
  if (deployUrl) {
    console.log(`[post-publish-callback] Deploy URL: ${deployUrl}`);
  }
  console.log(
    `[post-publish-callback] ${publicationIds.length} publication_ids derived from this deploy's changed posts.`
  );

  if (!webhookUrl) {
    console.log('[post-publish-callback] BACKEND_WEBHOOK_URL not set. Skipping notification.');
    return;
  }

  const diagnostic = {
    check: 'deploy',
    status: 'pass',
    article_count: articleCount,
    deploy_url: deployUrl,
  };

  const payload = buildEnvelope({
    event: 'publish_complete',
    status: 'success',
    diagnostics: diagnostic,
    publicationIds,
    githubEnv: process.env,
  });

  console.log(`[post-publish-callback] Notifying backend at ${webhookUrl}...`);
  const result = await sendWebhookNotification({
    webhookUrl,
    webhookToken: process.env.BACKEND_WEBHOOK_TOKEN,
    payload,
  });

  if (!result.ok) {
    console.warn(
      '[post-publish-callback] Backend notification had issues but deploy was successful.'
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
