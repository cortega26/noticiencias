/**
 * check-hero-images.js
 *
 * Validates that every article in src/content/posts/ has an `image` field in
 * its frontmatter AND, for local ~/assets/images/ paths, that the referenced
 * file actually exists.  Run as part of the `lint` chain.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.resolve(REPO_ROOT, 'src', 'content', 'posts');
const ASSETS_IMAGES_DIR = path.resolve(REPO_ROOT, 'src', 'assets', 'images');
const POSTS_DIR_PREFIX = `${POSTS_DIR}${path.sep}`;
const VALID_EXTENSIONS = new Set(['.md', '.mdx']);

// Matches: image: "~/assets/images/foo.ext"  or  image: ~/assets/images/foo.ext
const LOCAL_IMAGE_RE = /^image:\s*['"]?(~\/assets\/images\/([^\s'"]+))['"]?\s*$/m;

// Presence check — matches any non-empty image: line (string or object opener)
const IMAGE_PRESENT_RE = /^image:\s*\S/m;

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

const errors = [];
const files = walkFiles(POSTS_DIR);

for (const file of files) {
  const safeFile = assertWithinPostsDir(file);

  const content = fs.readFileSync(safeFile, 'utf8');
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) continue;

  const relPath = path.relative(REPO_ROOT, safeFile);

  if (!IMAGE_PRESENT_RE.test(frontmatter)) {
    errors.push(`${relPath}: missing 'image' field in frontmatter`);
    continue;
  }

  const localMatch = LOCAL_IMAGE_RE.exec(frontmatter);
  if (localMatch) {
    const filename = localMatch[2];
    // Guard against path traversal in the filename extracted from the YAML value.
    if (filename.includes('..') || path.basename(filename) !== filename) {
      errors.push(`${relPath}: image path contains invalid characters: ${localMatch[1]}`);
      continue;
    }
    const absImagePath = path.resolve(ASSETS_IMAGES_DIR, filename);
    if (!fs.existsSync(absImagePath)) {
      errors.push(`${relPath}: image file not found: src/assets/images/${filename}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Hero image check found ${errors.length} issue(s):`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`Hero image check passed for ${files.length} files.`);
