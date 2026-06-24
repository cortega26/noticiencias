#!/usr/bin/env node
/**
 * pre-publish-gate.js
 *
 * Publication gate: runs all content validation checks before build.
 * If any check fails, collects diagnostics, notifies backend, and blocks deployment.
 *
 * Usage:
 *   node scripts/pre-publish-gate.js
 *
 * This is the CI entry point called before npm run build in deploy.yml.
 * It aggregates diagnostics from all checks and optionally notifies the backend.
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Checks to run (in order, fail-fast)
// ---------------------------------------------------------------------------

const CHECKS = [
  { name: 'frontmatter-dates', script: 'check-frontmatter-dates.js', label: 'Frontmatter dates' },
  { name: 'hero-images', script: 'check-hero-images.js', label: 'Hero images' },
  { name: 'image-alt', script: 'check-image-alt.js', label: 'Image alt text' },
  { name: 'slug-quality', script: 'check-slug-quality.js', label: 'Slug quality' },
  { name: 'image-extensions', script: 'check-image-file-extensions.js', label: 'Image extensions' },
  { name: 'content-quality', script: 'check-content-quality.js', label: 'Content quality' },
  { name: 'tags', script: 'check-tags.js', label: 'Tag taxonomy' },
  { name: 'editorial-fields', script: 'check-editorial-fields.js', label: 'Editorial fields' },
];

// ---------------------------------------------------------------------------
// Run all checks, collect diagnostics
// ---------------------------------------------------------------------------

const diagnostics = [];
let hasFailures = false;

for (const check of CHECKS) {
  const scriptPath = resolve(__dirname, check.script);

  try {
    const result = spawnSync('node', [scriptPath, '--json'], {
      cwd: REPO_ROOT,
      timeout: 30000,
      encoding: 'utf-8',
    });

    if (result.error) {
      diagnostics.push({
        check: check.name,
        status: 'error',
        filesCount: 0,
        errors: [{ file: '', message: `Script error: ${result.error.message}` }],
      });
      hasFailures = true;
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch {
      diagnostics.push({
        check: check.name,
        status: 'error',
        filesCount: 0,
        errors: [{ file: '', message: `Failed to parse output: ${result.stdout.slice(0, 200)}` }],
      });
      hasFailures = true;
      continue;
    }

    diagnostics.push(parsed);

    if (parsed.status === 'fail') {
      hasFailures = true;
    }
  } catch (err) {
    diagnostics.push({
      check: check.name,
      status: 'error',
      filesCount: 0,
      errors: [{ file: '', message: `Unexpected error: ${err.message}` }],
    });
    hasFailures = true;
  }
}

// ---------------------------------------------------------------------------
// Write aggregated diagnostics for backend notification
// ---------------------------------------------------------------------------

const dataDir = resolve(REPO_ROOT, 'data');
try {
  mkdirSync(dataDir, { recursive: true });
} catch {
  // Directory already exists
}

const payloadPath = resolve(dataDir, 'pre-publish-diagnostics.json');
writeFileSync(payloadPath, JSON.stringify(diagnostics, null, 2));

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`\n[pre-publish-gate] Ran ${CHECKS.length} checks:`);
for (const d of diagnostics) {
  const icon = d.status === 'pass' ? '✅' : d.status === 'warning' ? '⚠️' : '❌';
  const errorCount = d.errors ? d.errors.length : 0;
  const detail = d.status === 'pass' ? '' : ` (${errorCount} issue(s))`;
  console.log(`  ${icon} ${d.check}${detail}`);
}

if (hasFailures) {
  console.error(`\n[pre-publish-gate] GATE FAILED — blocking deployment.`);
  console.error(`[pre-publish-gate] Diagnostics written to: ${payloadPath}`);

  // Notify backend if webhook URL is configured
  const webhookUrl = process.env.BACKEND_WEBHOOK_URL;
  if (webhookUrl) {
    console.log(`[pre-publish-gate] Notifying backend at ${webhookUrl}...`);
    spawnSync(
      'node',
      [resolve(__dirname, 'backend-notify.js'), '--status=fail', `--payload-file=${payloadPath}`],
      {
        cwd: REPO_ROOT,
        timeout: 15000,
        encoding: 'utf-8',
        stdio: 'inherit',
      }
    );
  }

  process.exit(1);
}

console.log(`\n[pre-publish-gate] ALL CHECKS PASSED — proceeding to build.`);
