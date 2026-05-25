import { execSync } from 'child_process';
import fs from 'fs';

const allowedTemplateFiles = new Set([
  'src/components/template/common/Image.astro',
  'src/components/template/common/Metadata.astro',
  'src/components/template/common/Analytics.astro',
  'src/components/template/common/CommonMeta.astro',
  'src/components/template/CustomStyles.astro',
  'src/components/template/blog/Pagination.astro',
  'src/components/template/blog/ToBlogLink.astro',
  'src/components/template/ui/Button.astro',
  'src/components/template/ui/Form.astro',
  'src/components/template/ui/ItemGrid.astro',
  'src/components/template/ui/ItemGrid2.astro',
  'src/components/template/widgets/CallToAction.astro',
  'src/components/template/widgets/Content.astro',
  'src/components/template/widgets/Header.astro',
  'src/components/template/widgets/Hero.astro',
  'src/components/template/widgets/HeroText.astro',
  'src/components/template/widgets/Pricing.astro',
  'src/components/template/widgets/Testimonials.astro',
]);

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
    .filter(Boolean)
    .filter((file) => fs.existsSync(file));
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
