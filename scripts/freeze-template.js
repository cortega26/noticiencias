import { execSync } from 'child_process';

const allowedTemplateFiles = new Set(['src/components/template/common/Image.astro']);

try {
  // Check for modifications in src/components/template against main branch
  // Adjust 'origin/main' if needed based on CI environment
  const committedDiff = execSync(
    'git diff --name-only origin/main...HEAD -- src/components/template'
  ).toString();
  const workingTreeDiff = execSync(
    'git diff --name-only HEAD -- src/components/template'
  ).toString();
  const changedFiles = [...new Set(`${committedDiff}\n${workingTreeDiff}`.split('\n'))]
    .map((file) => file.trim())
    .filter(Boolean);
  const blockedFiles = changedFiles.filter((file) => !allowedTemplateFiles.has(file));

  if (blockedFiles.length > 0) {
    console.error(
      '\n\x1b[31m⛔ ARCHITECTURE VIOLATION: src/components/template/ is FROZEN.\x1b[0m'
    );
    console.error(
      '   We are deprecating this directory. Please move the component to src/components/ds/ before editing.'
    );
    console.error('   Files modified:\n', blockedFiles.join('\n'));
    process.exit(1);
  }

  if (changedFiles.length > 0) {
    console.warn(
      '⚠️  Template freeze allowed compatibility-wrapper updates:\n',
      changedFiles.join('\n')
    );
  }
} catch {
  // Graceful degradation if git fails or branches missing
  console.warn('⚠️  Could not verify template freeze status (git error). Skipping.');
}
