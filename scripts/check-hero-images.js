/**
 * Validates post hero-image requirements:
 * 1. Every article must define `image`
 * 2. Every article must define alt text (`image_alt` or image.alt)
 * 3. Local `~/assets/images/*` paths must exist
 * 4. `default.png` is forbidden unless explicitly allowlisted
 */

import { collectHeroImageDiagnostics } from './utils/hero-placeholders.js';

const diagnostics = collectHeroImageDiagnostics();
const errors = [...diagnostics.errors];
const jsonMode = process.argv.includes('--json');

if (jsonMode) {
  console.log(
    JSON.stringify({
      check: 'hero-images',
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
  console.error(`Hero image check found ${errors.length} issue(s):`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`Hero image check passed for ${diagnostics.filesCount} files.`);
