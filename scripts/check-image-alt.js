/**
 * Validates image alt text quality:
 * 1. Every post with an `image` must have a non-empty `image_alt`
 * 2. `image_alt` must not start with "Imagen de" (screen-reader anti-pattern)
 * 3. `image_alt` must not be the publication-pipeline boilerplate
 *    "Ilustración editorial relacionada con …" — describe the actual image
 *    instead (this value feeds both the `alt` attribute and the visible
 *    caption in PostLayout)
 *
 * The diagnostics live in this file (not in scripts/utils/) because this
 * check is their only consumer (LAW-F5). Tests drive the CLI in a fixture
 * repo via --repoRoot and assert on the --json output.
 *
 * Note: presence of `image_alt` is also enforced by check-hero-images.js.
 * This script adds quality rules on top of the existence check.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveHeroPlaceholderPaths, walkPostFiles } from './utils/hero-placeholders.js';
import { matter } from './utils/frontmatter-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');
const BOILERPLATE_ALT_PREFIX = 'ilustración editorial relacionada con';

function repoRootFromArgs(argv = process.argv) {
  const flag = argv.find((arg) => arg.startsWith('--repoRoot='));
  return flag ? path.resolve(flag.slice('--repoRoot='.length)) : DEFAULT_REPO_ROOT;
}

function isBoilerplateHeroAlt(value) {
  if (typeof value !== 'string') return false;
  return value.trim().toLowerCase().startsWith(BOILERPLATE_ALT_PREFIX);
}

function isGenericHeroAlt(value) {
  if (typeof value !== 'string') return false;
  return /^imagen\s+de\b/i.test(value.trim());
}

function collectDiagnostics(repoRoot) {
  const errors = [];
  const files = walkPostFiles(resolveHeroPlaceholderPaths(repoRoot));

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const { data: parsed } = matter(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    if (!parsed.image) continue;

    const relPath = path.relative(repoRoot, file);
    const imageAlt = typeof parsed.image_alt === 'string' ? parsed.image_alt.trim() : '';

    if (!imageAlt) {
      errors.push(`${relPath}: missing 'image_alt' (required when 'image' is set)`);
    } else if (isGenericHeroAlt(imageAlt)) {
      errors.push(
        `${relPath}: image_alt starts with "Imagen de" — use a descriptive Spanish phrase instead: "${imageAlt}"`
      );
    } else if (isBoilerplateHeroAlt(imageAlt)) {
      errors.push(
        `${relPath}: image_alt is the pipeline boilerplate ("Ilustración editorial relacionada con …") — describe the actual image instead: "${imageAlt}"`
      );
    }
  }

  return { filesCount: files.length, errors };
}

const repoRoot = repoRootFromArgs();
const { filesCount, errors } = collectDiagnostics(repoRoot);
const jsonMode = process.argv.includes('--json');

if (jsonMode) {
  console.log(
    JSON.stringify({
      check: 'image-alt',
      status: errors.length === 0 ? 'pass' : 'fail',
      filesCount,
      errors: errors.map((e) => {
        const colonIdx = e.indexOf(': ');
        return colonIdx > 0
          ? { file: e.slice(0, colonIdx), message: e.slice(colonIdx + 2) }
          : { file: '', message: e };
      }),
    })
  );
  process.exit(errors.length === 0 ? 0 : 1);
}

if (errors.length > 0) {
  console.error(`Image alt check found ${errors.length} issue(s):`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`Image alt check passed for ${filesCount} files.`);
