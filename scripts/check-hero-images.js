/**
 * Validates post hero-image requirements:
 * 1. Every article must define `image`
 * 2. Every article must define alt text (`image_alt` or image.alt)
 * 3. Local `~/assets/images/*` paths must exist
 * 4. `default.png` is forbidden unless explicitly allowlisted
 */

import {
  collectHeroImageDiagnostics,
} from './utils/hero-placeholders.js';

const diagnostics = collectHeroImageDiagnostics();
const errors = [...diagnostics.errors];

for (const relPath of diagnostics.staleAllowlistEntries) {
  errors.push(
    `${diagnostics.paths.allowlistPath}: stale allowlist entry for ${relPath}; run npm run sync:hero-placeholders or restore the placeholder reference`
  );
}

if (errors.length > 0) {
  console.error(`Hero image check found ${errors.length} issue(s):`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`Hero image check passed for ${diagnostics.filesCount} files.`);
