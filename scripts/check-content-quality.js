/**
 * Validates published article body quality.
 * Blocks placeholder/error prose and bodies too thin to be real public articles.
 */

import { collectContentQualityDiagnostics } from './utils/content-quality.js';

const diagnostics = collectContentQualityDiagnostics();
const jsonMode = process.argv.includes('--json');

if (jsonMode) {
  const report = {
    check: 'content-quality',
    status: diagnostics.errors.length === 0 ? 'pass' : 'fail',
    filesCount: diagnostics.filesCount,
    errors: diagnostics.errors.map((msg) => {
      // Errors are formatted as "file: message"
      const colonIdx = msg.indexOf(': ');
      const file = colonIdx > 0 ? msg.slice(0, colonIdx) : '';
      const message = colonIdx > 0 ? msg.slice(colonIdx + 2) : msg;
      return { file, message };
    }),
    warnings: (diagnostics.warnings || []).map((msg) => {
      const colonIdx = msg.indexOf(': ');
      const file = colonIdx > 0 ? msg.slice(0, colonIdx) : '';
      const message = colonIdx > 0 ? msg.slice(colonIdx + 2) : msg;
      return { file, message };
    }),
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(diagnostics.errors.length === 0 ? 0 : 1);
}

if (diagnostics.errors.length > 0) {
  console.error(`Content quality check found ${diagnostics.errors.length} issue(s):`);
  for (const error of diagnostics.errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`Content quality check passed for ${diagnostics.filesCount} files.`);
