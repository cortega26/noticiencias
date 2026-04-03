import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectHeroImageDiagnostics,
  DEFAULT_REPO_ROOT,
} from './hero-placeholders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REFINERY_MANIFEST_FILENAME = 'refinery_manifest.json';
export const DEFAULT_DELETED_ROUTE_SMOKE_CHECKS_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'data',
  'deleted-route-smoke-checks.json'
);

export function resolvePublishedSidecarPaths(repoRoot = DEFAULT_REPO_ROOT) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  return {
    repoRoot: resolvedRepoRoot,
    postsDir: path.resolve(resolvedRepoRoot, 'src', 'content', 'posts'),
    manifestPath: path.resolve(
      resolvedRepoRoot,
      'src',
      'content',
      'posts',
      REFINERY_MANIFEST_FILENAME
    ),
    deletedRouteSmokeChecksPath: path.resolve(
      resolvedRepoRoot,
      'data',
      'deleted-route-smoke-checks.json'
    ),
  };
}

function loadManifestEntries(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

export function collectPublishedContentSidecarDiagnostics(options = {}) {
  const paths = resolvePublishedSidecarPaths(options.repoRoot);
  const heroDiagnostics = collectHeroImageDiagnostics(options);
  const manifestEntries = loadManifestEntries(paths.manifestPath);
  const staleManifestEntries = [];
  const errors = [];

  for (const [articleId, fileName] of Object.entries(manifestEntries)) {
    if (typeof fileName !== 'string' || !fileName.trim()) {
      errors.push(
        `${paths.manifestPath}: manifest entry for "${articleId}" must map to a non-empty filename`
      );
      continue;
    }

    const targetPath = path.resolve(paths.postsDir, fileName);
    if (!targetPath.startsWith(`${paths.postsDir}${path.sep}`)) {
      errors.push(
        `${paths.manifestPath}: manifest entry for "${articleId}" escapes posts directory: ${fileName}`
      );
      continue;
    }

    if (!fs.existsSync(targetPath)) {
      staleManifestEntries.push({ articleId, fileName });
      errors.push(
        `${paths.manifestPath}: stale manifest entry "${articleId}" -> ${fileName}; target post is missing`
      );
    }
  }

  for (const relPath of heroDiagnostics.staleAllowlistEntries) {
    errors.push(
      `${heroDiagnostics.paths.allowlistPath}: stale allowlist entry for ${relPath}; run npm run sync:hero-placeholders or restore the placeholder reference`
    );
  }

  return {
    paths,
    errors,
    staleManifestEntries,
    staleAllowlistEntries: heroDiagnostics.staleAllowlistEntries,
  };
}
