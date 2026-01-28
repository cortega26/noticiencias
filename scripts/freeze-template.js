import { execSync } from 'child_process';

try {
  // Check for modifications in src/components/template against main branch
  // Adjust 'origin/main' if needed based on CI environment
  const diff = execSync('git diff --name-only origin/main...HEAD -- src/components/template').toString();
  
  if (diff.trim().length > 0) {
    console.error('\n\x1b[31m⛔ ARCHITECTURE VIOLATION: src/components/template/ is FROZEN.\x1b[0m');
    console.error('   We are deprecating this directory. Please move the component to src/components/ds/ before editing.');
    console.error('   Files modified:\n', diff);
    process.exit(1);
  }
} catch {
  // Graceful degradation if git fails or branches missing
  console.warn('⚠️  Could not verify template freeze status (git error). Skipping.');
}
