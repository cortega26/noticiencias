import { collectPublishedContentSidecarDiagnostics } from './utils/published-content-sidecars.js';

const diagnostics = collectPublishedContentSidecarDiagnostics();

if (diagnostics.errors.length > 0) {
  console.error(`Published content sidecar check found ${diagnostics.errors.length} issue(s):`);
  for (const err of diagnostics.errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log('Published content sidecar check passed.');
