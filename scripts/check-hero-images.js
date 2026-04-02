/**
 * Validates post hero-image requirements:
 * 1. Every article must define `image`
 * 2. Every article must define alt text (`image_alt` or image.alt)
 * 3. Local `~/assets/images/*` paths must exist
 * 4. `default.png` is forbidden unless explicitly allowlisted
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.resolve(REPO_ROOT, 'src', 'content', 'posts');
const ASSETS_IMAGES_DIR = path.resolve(REPO_ROOT, 'src', 'assets', 'images');
const ALLOWLIST_PATH = path.resolve(
  REPO_ROOT,
  'data',
  'hero-image-placeholder-allowlist.json'
);
const POSTS_DIR_PREFIX = `${POSTS_DIR}${path.sep}`;
const VALID_EXTENSIONS = new Set(['.md', '.mdx']);
const DEFAULT_IMAGE_PATH = '~/assets/images/default.png';

function assertWithinPostsDir(absPath) {
  const normalized = path.resolve(absPath);
  if (normalized !== POSTS_DIR && !normalized.startsWith(POSTS_DIR_PREFIX)) {
    throw new Error(`Path escapes posts directory boundary: ${normalized}`);
  }
  return normalized;
}

function walkFiles(dir, results = []) {
  const safeDir = assertWithinPostsDir(dir);

  if (!fs.existsSync(safeDir)) return results;
  const entries = fs.readdirSync(safeDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = assertWithinPostsDir(path.resolve(safeDir, entry.name));
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      walkFiles(fullPath, results);
    } else if (entry.isFile() && VALID_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractFrontmatter(content) {
  if (!content.startsWith('---\n')) return '';
  const endIdx = content.indexOf('\n---\n', 4);
  if (endIdx === -1) return '';
  return content.slice(4, endIdx);
}

function loadPlaceholderAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  return parsed.allowedPlaceholders ?? {};
}

function validateLocalAssetPath(imageSrc, relPath, errors) {
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

  const absImagePath = path.resolve(ASSETS_IMAGES_DIR, filename);
  if (!fs.existsSync(absImagePath)) {
    errors.push(`${relPath}: image file not found: src/assets/images/${filename}`);
  }
}

const errors = [];
const files = walkFiles(POSTS_DIR);
const allowlist = loadPlaceholderAllowlist();
const usedAllowlistEntries = new Set();

for (const file of files) {
  const safeFile = assertWithinPostsDir(file);
  const content = fs.readFileSync(safeFile, 'utf8');
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) continue;

  const relPath = path.relative(REPO_ROOT, safeFile);
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

  const imageSrc =
    typeof imageValue === 'string'
      ? imageValue.trim()
      : typeof imageValue === 'object' && imageValue !== null && typeof imageValue.src === 'string'
        ? imageValue.src.trim()
        : '';

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
    if (!allowlist[relPath]) {
      errors.push(
        `${relPath}: placeholder image ${DEFAULT_IMAGE_PATH} is not allowlisted`
      );
    } else {
      usedAllowlistEntries.add(relPath);
    }
  }

  if (imageSrc.startsWith('~/assets/images/')) {
    validateLocalAssetPath(imageSrc, relPath, errors);
  }
}

const staleAllowlistEntries = Object.keys(allowlist).filter(
  (relPath) => !usedAllowlistEntries.has(relPath)
);
for (const relPath of staleAllowlistEntries) {
  errors.push(
    `${ALLOWLIST_PATH}: stale allowlist entry for ${relPath}; remove it or restore the placeholder reference`
  );
}

if (errors.length > 0) {
  console.error(`Hero image check found ${errors.length} issue(s):`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`Hero image check passed for ${files.length} files.`);
