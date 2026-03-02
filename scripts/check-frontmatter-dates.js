import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.resolve(REPO_ROOT, 'src', 'content', 'posts');
const POSTS_DIR_PREFIX = `${POSTS_DIR}${path.sep}`;
const VALID_EXTENSIONS = new Set(['.md', '.mdx']);
const DATE_QUOTED_PATTERN = /^date:\s*(['"])\d{4}-\d{2}-\d{2}\1\s*$/m;

function assertWithinPostsDir(absPath) {
  const normalized = path.resolve(absPath);
  if (normalized !== POSTS_DIR && !normalized.startsWith(POSTS_DIR_PREFIX)) {
    throw new Error(`Path escapes posts directory boundary: ${normalized}`);
  }
  return normalized;
}

function walkFiles(dir, results = []) {
  const safeDir = assertWithinPostsDir(dir);

  // Codacy/SAST: path is allowlisted by assertWithinPostsDir and never user-controlled.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!fs.existsSync(safeDir)) return results;

  // Codacy/SAST: directory is constrained to REPO_ROOT/src/content/posts.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
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

const offenders = [];
const files = walkFiles(POSTS_DIR);

for (const file of files) {
  const safeFile = assertWithinPostsDir(file);

  // Codacy/SAST: file path is enumerated from allowlisted POSTS_DIR only.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const content = fs.readFileSync(safeFile, 'utf8');
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) continue;

  if (DATE_QUOTED_PATTERN.test(frontmatter)) {
    offenders.push(path.relative(REPO_ROOT, safeFile));
  }
}

if (offenders.length > 0) {
  console.error('Frontmatter date must be unquoted YAML date for Astro z.date():');
  for (const file of offenders) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log(`Frontmatter date check passed for ${files.length} files.`);
