#!/usr/bin/env node
/**
 * check-content-staleness.js
 *
 * Identifies articles that haven't been updated in 180+ days.
 * Outputs structured JSON for CI alerting.
 *
 * Usage:
 *   node scripts/check-content-staleness.js [--threshold-days=180]
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const POSTS_DIR = resolve(REPO_ROOT, 'src', 'content', 'posts');

// Parse CLI args
const args = process.argv.slice(2);
let thresholdDays = 180;
let jsonMode = false;

for (const arg of args) {
  if (arg.startsWith('--threshold-days=')) {
    thresholdDays = parseInt(arg.slice('--threshold-days='.length), 10);
  } else if (arg === '--json') {
    jsonMode = true;
  }
}

const now = Date.now();
const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
const staleArticles = [];

const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));

for (const file of files) {
  const filePath = resolve(POSTS_DIR, file);
  const stats = statSync(filePath);
  const ageMs = now - stats.mtimeMs;

  if (ageMs < thresholdMs) {
    continue;
  }

  const ageDays = Math.round(ageMs / (24 * 60 * 60 * 1000));

  let title = basename(file, file.endsWith('.mdx') ? '.mdx' : '.md');
  let date = null;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const { data: fm } = matter(raw);
    title = fm.title || title;
    date = fm.date ? new Date(fm.date).toISOString().slice(0, 10) : null;
  } catch {
    // Use filename as fallback
  }

  staleArticles.push({
    slug: basename(file, file.endsWith('.mdx') ? '.mdx' : '.md'),
    title,
    date,
    age_days: ageDays,
    last_modified: stats.mtime.toISOString(),
  });
}

// Sort by staleness (oldest first)
staleArticles.sort((a, b) => b.age_days - a.age_days);

if (jsonMode) {
  console.log(
    JSON.stringify(
      {
        threshold_days: thresholdDays,
        total_articles: files.length,
        stale_count: staleArticles.length,
        stale_articles: staleArticles,
        generated_at: new Date().toISOString(),
      },
      null,
      2
    )
  );
} else {
  if (staleArticles.length === 0) {
    console.log(
      `[staleness] OK — No articles older than ${thresholdDays} days (${files.length} total).`
    );
    process.exit(0);
  }

  console.log(`[staleness] ${staleArticles.length} article(s) older than ${thresholdDays} days:`);
  for (const a of staleArticles.slice(0, 10)) {
    console.log(
      `  - ${a.title} (${a.age_days} días, última modificación: ${a.last_modified.slice(0, 10)})`
    );
  }
  if (staleArticles.length > 10) {
    console.log(`  ... y ${staleArticles.length - 10} más`);
  }
}

// Exit non-zero if >20% of articles are stale
const pctStale = files.length > 0 ? staleArticles.length / files.length : 0;
if (pctStale > 0.2) {
  console.error(
    `[staleness] CRITICAL: ${(pctStale * 100).toFixed(1)}% of articles are stale (threshold: 20%).`
  );
  process.exit(1);
}

process.exit(0);
