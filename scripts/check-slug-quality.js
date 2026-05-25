/**
 * Rejects posts whose filename slug matches the `article-NNN` pattern.
 * Example bad filename: 2026-01-31-article-520.md
 * The lint rule: basename (no extension) must NOT match /^\d{4}-\d{2}-\d{2}-article-\d+$/
 */

import { walkPostFiles, resolveHeroPlaceholderPaths } from './utils/hero-placeholders.js';
import path from 'node:path';

const BAD_SLUG = /^\d{4}-\d{2}-\d{2}-article-\d+$/;

const paths = resolveHeroPlaceholderPaths();
const files = walkPostFiles(paths);
const errors = [];

for (const file of files) {
  const basename = path.basename(file, path.extname(file));
  if (BAD_SLUG.test(basename)) {
    const relPath = path.relative(paths.repoRoot, file);
    errors.push(relPath);
  }
}

if (errors.length > 0) {
  console.error(`Slug quality check found ${errors.length} post(s) with article-NNN filenames:`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  console.error('Rename each file to derive the slug from the Spanish title.');
  process.exit(1);
}

console.log(`Slug quality check passed for ${files.length} files.`);
