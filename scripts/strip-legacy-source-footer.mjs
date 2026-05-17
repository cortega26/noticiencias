#!/usr/bin/env node
/**
 * One-shot migration: strip the redundant prose footer
 *   `Fuente original: [URL](URL)`
 * from all posts under src/content/posts/. The canonical place to render
 * a source is the TrustPanel component, fed from the `source_url` field
 * already present in the frontmatter. The prose footer was a legacy
 * artifact from when the front-end did not have TrustPanel and is now
 * a duplicate visible to readers.
 *
 * Idempotent: re-running on a clean repo is a no-op.
 * Reversible via `git checkout`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const postsDir = path.join(repoRoot, 'src', 'content', 'posts');

// Match the footer line plus the blank line that follows it, so the
// surrounding structure collapses correctly:
//   paragraph + blank + footer + blank + <!-- comment -->
//     → paragraph + blank + <!-- comment -->
// The trailing `\r?\n(\r?\n)?` consumes the footer's own newline and one
// optional adjacent blank line. The earlier regex (`\n+^...\s*$`) was
// too greedy on `\s*$` and ate both surrounding newlines, leaving the
// paragraph glued to the next block.
const FOOTER_RE = /^Fuente original:\s*\[[^\]]+\]\([^)]+\)[ \t]*\r?\n(\r?\n)?/m;

const files = fs
  .readdirSync(postsDir)
  .filter((name) => name.endsWith('.md') || name.endsWith('.mdx'))
  .map((name) => path.join(postsDir, name));

let changed = 0;
let untouched = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const cleaned = original.replace(FOOTER_RE, '');
  if (cleaned === original) {
    untouched += 1;
    continue;
  }
  fs.writeFileSync(file, cleaned, 'utf8');
  changed += 1;
  console.log(`stripped: ${path.relative(repoRoot, file)}`);
}

console.log(`\nDone. ${changed} file(s) updated, ${untouched} untouched.`);
