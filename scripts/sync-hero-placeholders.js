import path from 'node:path';

import { syncHeroPlaceholderAllowlist } from './utils/hero-placeholders.js';

const result = syncHeroPlaceholderAllowlist();

if (result.changed) {
  console.log(
    `Updated hero placeholder allowlist: ${path.relative(process.cwd(), result.paths.allowlistPath)}`
  );
} else {
  console.log('Hero placeholder allowlist already in sync.');
}

if (result.staleAllowlistEntries.length > 0) {
  console.log(
    `Pruned ${result.staleAllowlistEntries.length} stale allowlist entr${result.staleAllowlistEntries.length === 1 ? 'y' : 'ies'}.`
  );
}

if (result.errors.length > 0) {
  console.error(`Hero placeholder sync found ${result.errors.length} issue(s):`);
  for (const error of result.errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`Hero image sync passed for ${result.filesCount} files.`);
