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
const jsonMode = process.argv.includes('--json');

for (const file of files) {
  const basename = path.basename(file, path.extname(file));
  if (BAD_SLUG.test(basename)) {
    const relPath = path.relative(paths.repoRoot, file);
    errors.push(relPath);
  }
}

if (jsonMode) {
  const report = {
    check: 'slug-quality',
    status: errors.length === 0 ? 'pass' : 'fail',
    filesCount: files.length,
    errors: errors.map((f) => ({
      file: f,
      message: 'Filename matches article-NNN pattern; rename to derive slug from Spanish title',
    })),
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(errors.length === 0 ? 0 : 1);
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
