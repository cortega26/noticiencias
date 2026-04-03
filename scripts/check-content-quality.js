/**
 * Validates published article body quality.
 * Blocks placeholder/error prose and bodies too thin to be real public articles.
 */

import { collectContentQualityDiagnostics } from './utils/content-quality.js';

const diagnostics = collectContentQualityDiagnostics();

if (diagnostics.errors.length > 0) {
  console.error(`Content quality check found ${diagnostics.errors.length} issue(s):`);
  for (const error of diagnostics.errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`Content quality check passed for ${diagnostics.filesCount} files.`);
