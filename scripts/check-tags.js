/**
 * check-tags.js
 *
 * Validates the `tags` field in every published post against the contract
 * defined in docs/tagging.md.
 *
 * Rules enforced (sourced from tagging.md and the backend TagNormalizer):
 *   - tags must be an array of strings
 *   - maximum 8 tags per article
 *   - each tag: minimum 3 characters, maximum 40 characters
 *   - each tag must match ^[a-z0-9áéíóúüñ\s]+$u  (lowercase, no stray uppercase)
 *   - each tag must be trimmed (no leading/trailing whitespace)
 *   - no duplicate tags within the same post (case-insensitive)
 *
 * Exit codes:
 *   0 — all posts pass
 *   1 — one or more violations found
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.resolve(REPO_ROOT, 'src', 'content', 'posts');
const POSTS_DIR_PREFIX = `${POSTS_DIR}${path.sep}`;
const VALID_EXTENSIONS = new Set(['.md', '.mdx']);

// Limits from tagging.md / backend TagNormalizer
const MAX_TAGS = 8;
const MIN_TAG_LENGTH = 3;
const MAX_TAG_LENGTH = 40;
const TAG_PATTERN = /^[a-z0-9\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc\u00f1\s]+$/u;

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

const issues = [];
const files = walkFiles(POSTS_DIR);
let checkedCount = 0;

for (const file of files) {
  const safeFile = assertWithinPostsDir(file);
  const content = fs.readFileSync(safeFile, 'utf8');

  let parsed;
  try {
    parsed = matter(content);
  } catch {
    issues.push({
      file: path.relative(REPO_ROOT, safeFile),
      problems: ['YAML parse error in frontmatter'],
    });
    continue;
  }

  checkedCount++;
  const relPath = path.relative(REPO_ROOT, safeFile);
  const tags = parsed.data.tags;

  // tags field absent — schema defaults to [] — nothing to validate
  if (tags === undefined || tags === null) continue;

  if (!Array.isArray(tags)) {
    issues.push({ file: relPath, problems: ['tags must be an array'] });
    continue;
  }

  const fileIssues = [];

  if (tags.length > MAX_TAGS) {
    fileIssues.push(`too many tags: ${tags.length} (max ${MAX_TAGS})`);
  }

  const seen = new Set();
  for (const rawTag of tags) {
    if (typeof rawTag !== 'string') {
      fileIssues.push(`tag is not a string: ${JSON.stringify(rawTag)}`);
      continue;
    }

    // Normalize to NFC to handle any decomposed Unicode in source files
    const tag = rawTag.normalize('NFC');

    if (tag !== tag.trimStart() || tag !== tag.trimEnd()) {
      fileIssues.push(`tag has leading/trailing whitespace: "${rawTag}"`);
    }

    if (tag.trim().length < MIN_TAG_LENGTH) {
      fileIssues.push(`tag too short (min ${MIN_TAG_LENGTH} chars): "${rawTag}"`);
    }

    if (tag.length > MAX_TAG_LENGTH) {
      fileIssues.push(`tag too long (max ${MAX_TAG_LENGTH} chars): "${rawTag}"`);
    }

    if (!TAG_PATTERN.test(tag.trim())) {
      fileIssues.push(
        `tag contains disallowed characters (must be lowercase letters, digits, Spanish accents, spaces): "${rawTag}"`
      );
    }

    const lower = tag.trim().toLowerCase();
    if (seen.has(lower)) {
      fileIssues.push(`duplicate tag (case-insensitive): "${rawTag}"`);
    }
    seen.add(lower);
  }

  if (fileIssues.length > 0) {
    issues.push({ file: relPath, problems: fileIssues });
  }
}

if (issues.length > 0) {
  console.error(`[check:tags] ${issues.length} post(s) have tag violations:\n`);
  for (const { file, problems } of issues) {
    console.error(`  ${file}`);
    for (const p of problems) {
      console.error(`    \u2022 ${p}`);
    }
  }
  console.error(
    '\nSee docs/tagging.md for the tag contract. Fix violations in the post frontmatter.'
  );
  process.exit(1);
}

console.log(`[check:tags] OK \u2014 ${checkedCount} posts checked, no tag violations found.`);
