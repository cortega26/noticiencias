import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..');
export const DEFAULT_IMAGE_PATH = '~/assets/images/default.png';
export const VALID_EXTENSIONS = new Set(['.md', '.mdx']);

export function resolveHeroPlaceholderPaths(repoRoot = DEFAULT_REPO_ROOT) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const postsDir = path.resolve(resolvedRepoRoot, 'src', 'content', 'posts');
  return {
    repoRoot: resolvedRepoRoot,
    postsDir,
    assetsImagesDir: path.resolve(resolvedRepoRoot, 'src', 'assets', 'images'),
    allowlistPath: path.resolve(resolvedRepoRoot, 'data', 'hero-image-placeholder-allowlist.json'),
    postsDirPrefix: `${postsDir}${path.sep}`,
  };
}

export function assertWithinPostsDir(absPath, paths) {
  const normalized = path.resolve(absPath);
  if (normalized !== paths.postsDir && !normalized.startsWith(paths.postsDirPrefix)) {
    throw new Error(`Path escapes posts directory boundary: ${normalized}`);
  }
  return normalized;
}

export function walkPostFiles(paths, dir = paths.postsDir, results = []) {
  const safeDir = assertWithinPostsDir(dir, paths);

  if (!fs.existsSync(safeDir)) return results;

  const entries = fs
    .readdirSync(safeDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = assertWithinPostsDir(path.resolve(safeDir, entry.name), paths);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      walkPostFiles(paths, fullPath, results);
    } else if (entry.isFile() && VALID_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

export function extractFrontmatter(content) {
  if (!content.startsWith('---\n')) return '';
  const endIdx = content.indexOf('\n---\n', 4);
  if (endIdx === -1) return '';
  return content.slice(4, endIdx);
}

export function loadPlaceholderAllowlist(allowlistPath) {
  if (!fs.existsSync(allowlistPath)) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  return parsed.allowedPlaceholders ?? {};
}

export function serializePlaceholderAllowlist(allowedPlaceholders) {
  return `${JSON.stringify({ allowedPlaceholders }, null, 2)}\n`;
}

function getImageSource(imageValue) {
  return typeof imageValue === 'string'
    ? imageValue.trim()
    : typeof imageValue === 'object' && imageValue !== null && typeof imageValue.src === 'string'
      ? imageValue.src.trim()
      : '';
}

function validateLocalAssetPath(imageSrc, relPath, assetsImagesDir, errors) {
  const filename = imageSrc.replace(/^~\/assets\/images\//, '');
  if (
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    path.basename(filename) !== filename
  ) {
    errors.push(`${relPath}: image path contains invalid characters: ${imageSrc}`);
    return;
  }

  const absImagePath = path.resolve(assetsImagesDir, filename);
  if (!fs.existsSync(absImagePath)) {
    errors.push(`${relPath}: image file not found: src/assets/images/${filename}`);
  }
}

export function collectHeroImageDiagnostics(options = {}) {
  const paths = resolveHeroPlaceholderPaths(options.repoRoot);
  const errors = [];
  const files = walkPostFiles(paths);
  const allowlist = loadPlaceholderAllowlist(paths.allowlistPath);
  const usedAllowlistEntries = new Set();
  const nextAllowedPlaceholders = {};

  for (const file of files) {
    const safeFile = assertWithinPostsDir(file, paths);
    const content = fs.readFileSync(safeFile, 'utf8');
    const frontmatter = extractFrontmatter(content);
    if (!frontmatter) continue;

    const relPath = path.relative(paths.repoRoot, safeFile);
    const parsed = yaml.load(frontmatter);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors.push(`${relPath}: frontmatter could not be parsed as an object`);
      continue;
    }

    const imageValue = parsed.image;
    if (!imageValue) {
      errors.push(`${relPath}: missing 'image' field in frontmatter`);
      continue;
    }

    const imageSrc = getImageSource(imageValue);
    if (!imageSrc) {
      errors.push(`${relPath}: image field must be a non-empty string or object with src`);
      continue;
    }

    const inlineAlt =
      typeof imageValue === 'object' && imageValue !== null && typeof imageValue.alt === 'string'
        ? imageValue.alt.trim()
        : '';
    const imageAlt = typeof parsed.image_alt === 'string' ? parsed.image_alt.trim() : '';
    if (!inlineAlt && !imageAlt) {
      errors.push(`${relPath}: missing 'image_alt' text for hero image`);
    }

    if (imageSrc === DEFAULT_IMAGE_PATH) {
      const allowlistReason =
        typeof allowlist[relPath] === 'string' ? allowlist[relPath].trim() : '';
      if (!allowlistReason) {
        errors.push(
          `${relPath}: placeholder image ${DEFAULT_IMAGE_PATH} is not allowlisted with an explicit reason`
        );
      } else {
        usedAllowlistEntries.add(relPath);
        nextAllowedPlaceholders[relPath] = allowlistReason;
      }
    }

    if (imageSrc.startsWith('~/assets/images/')) {
      validateLocalAssetPath(imageSrc, relPath, paths.assetsImagesDir, errors);
    }
  }

  const staleAllowlistEntries = Object.keys(allowlist)
    .filter((relPath) => !usedAllowlistEntries.has(relPath))
    .sort((a, b) => a.localeCompare(b));
  const orderedNextAllowlist = Object.fromEntries(
    Object.entries(nextAllowedPlaceholders).sort(([left], [right]) => left.localeCompare(right))
  );

  return {
    paths,
    filesCount: files.length,
    errors,
    allowlist,
    nextAllowedPlaceholders: orderedNextAllowlist,
    staleAllowlistEntries,
  };
}

export function syncHeroPlaceholderAllowlist(options = {}) {
  const diagnostics = collectHeroImageDiagnostics(options);
  const nextContents = serializePlaceholderAllowlist(diagnostics.nextAllowedPlaceholders);
  const previousContents = fs.existsSync(diagnostics.paths.allowlistPath)
    ? fs.readFileSync(diagnostics.paths.allowlistPath, 'utf8')
    : '';
  const changed = previousContents !== nextContents;

  if (changed) {
    fs.mkdirSync(path.dirname(diagnostics.paths.allowlistPath), {
      recursive: true,
    });
    fs.writeFileSync(diagnostics.paths.allowlistPath, nextContents, 'utf8');
  }

  return {
    ...diagnostics,
    changed,
  };
}
