/**
 * Validates published articles for executable HTML/MDX content.
 * Mirrors the backend publication gate in ai_editor.py.
 */

import { collectExecutableContentDiagnostics } from './utils/executable-content.js';

const diagnostics = collectExecutableContentDiagnostics();
const jsonMode = process.argv.includes('--json');

if (jsonMode) {
  const report = {
    check: 'executable-content',
    status: diagnostics.errors.length === 0 ? 'pass' : 'fail',
    filesCount: diagnostics.filesCount,
    errors: diagnostics.errors.map((msg) => {
      const colonIdx = msg.indexOf(': ');
      const file = colonIdx > 0 ? msg.slice(0, colonIdx) : '';
      const message = colonIdx > 0 ? msg.slice(colonIdx + 2) : msg;
      return { file, message };
    }),
  };
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const msg of diagnostics.errors) {
    console.error(msg);
  }
  for (const msg of diagnostics.warnings) {
    console.warn(msg);
  }
  if (diagnostics.errors.length > 0) {
    console.error(
      `\n[executable-content] FAIL — ${diagnostics.errors.length} article(s) contain executable content.`
    );
    process.exit(1);
  }
  console.log(
    `[executable-content] OK — ${diagnostics.filesCount} article(s) checked, no executable content found.`
  );
}
