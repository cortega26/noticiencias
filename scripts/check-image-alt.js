/**
 * Validates image alt text quality:
 * 1. Every post with an `image` must have a non-empty `image_alt`
 * 2. `image_alt` must not start with "Imagen de" (screen-reader anti-pattern)
 * 3. `image_alt` must not be the pipeline boilerplate
 *    "Ilustración editorial relacionada con …" unless the post is allowlisted
 *    in `data/hero-image-alt-allowlist.json` (legacy grandfathering)
 *
 * Note: presence of `image_alt` is also enforced by check-hero-images.js.
 * This script adds quality rules on top of the existence check.
 */

import { collectImageAltDiagnostics } from './utils/hero-alt.js';

const diagnostics = collectImageAltDiagnostics();
const errors = [...diagnostics.errors];
const jsonMode = process.argv.includes('--json');

if (jsonMode) {
  console.log(
    JSON.stringify({
      check: 'image-alt',
      status: errors.length === 0 ? 'pass' : 'fail',
      filesCount: diagnostics.filesCount,
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

console.log(`Image alt check passed for ${diagnostics.filesCount} files.`);
