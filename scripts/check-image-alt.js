/**
 * Validates image alt text quality:
 * 1. Every post with an `image` must have a non-empty `image_alt`
 * 2. `image_alt` must not start with "Imagen de" (screen-reader anti-pattern)
 *
 * Note: presence of `image_alt` is also enforced by check-hero-images.js.
 * This script adds quality rules on top of the existence check.
 */

import {
  walkPostFiles,
  resolveHeroPlaceholderPaths,
  extractFrontmatter,
} from './utils/hero-placeholders.js';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const paths = resolveHeroPlaceholderPaths();
const files = walkPostFiles(paths);
const errors = [];
const jsonMode = process.argv.includes('--json');

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) continue;

  const relPath = path.relative(paths.repoRoot, file);
  const parsed = yaml.load(frontmatter);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;

  if (!parsed.image) continue;

  const imageAlt = typeof parsed.image_alt === 'string' ? parsed.image_alt.trim() : '';

  if (!imageAlt) {
    errors.push(`${relPath}: missing 'image_alt' (required when 'image' is set)`);
    continue;
  }

  if (/^imagen\s+de\b/i.test(imageAlt)) {
    errors.push(
      `${relPath}: image_alt starts with "Imagen de" — use a descriptive Spanish phrase instead: "${imageAlt}"`
    );
  }
}

if (jsonMode) {
  const report = {
    check: 'image-alt',
    status: errors.length === 0 ? 'pass' : 'fail',
    filesCount: files.length,
    errors: errors.map((msg) => {
      const [file, ...rest] = msg.split(': ');
      return { file, message: rest.join(': ') };
    }),
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(errors.length === 0 ? 0 : 1);
}

if (errors.length > 0) {
  console.error(`Image alt check found ${errors.length} issue(s):`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`Image alt check passed for ${files.length} files.`);
