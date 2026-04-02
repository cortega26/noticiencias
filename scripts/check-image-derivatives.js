import fs from 'node:fs';

import {
  MANIFEST_PATH,
  collectLocalPostImageSources,
  computeContentHash,
  getAssetImagePathFromSourceKey,
  loadManifest,
} from './utils/image-derivatives.js';

const requireUrls = process.env.IMAGE_DERIVATIVES_REQUIRE_URL === '1';

const manifest = loadManifest();
const errors = [];

if (!fs.existsSync(MANIFEST_PATH)) {
  errors.push(`Missing image derivatives manifest: ${MANIFEST_PATH}`);
}

for (const sourceKey of collectLocalPostImageSources()) {
  const entry = manifest[sourceKey];
  if (!entry) {
    errors.push(`${sourceKey}: missing manifest entry. Run npm run publish:image-derivatives.`);
    continue;
  }

  const absPath = getAssetImagePathFromSourceKey(sourceKey);
  const hash = computeContentHash(absPath);
  if (entry.hash !== hash) {
    errors.push(`${sourceKey}: manifest hash is stale. Run npm run publish:image-derivatives.`);
  }

  if (!Array.isArray(entry.variants) || entry.variants.length === 0) {
    errors.push(`${sourceKey}: manifest entry has no variants.`);
    continue;
  }

  for (const variant of entry.variants) {
    if (!variant.objectKey || !variant.format || !variant.width || !variant.height) {
      errors.push(`${sourceKey}: manifest variant is missing required fields.`);
    }
    if (requireUrls && !variant.url) {
      errors.push(`${sourceKey}: manifest variant is missing a CDN URL.`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Image derivative check found ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log('Image derivative check passed.');
