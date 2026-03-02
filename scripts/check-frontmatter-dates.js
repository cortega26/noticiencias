import fs from 'fs';
import path from 'path';

const POSTS_DIR = path.resolve('src/content/posts');
const VALID_EXTENSIONS = new Set(['.md', '.mdx']);
const DATE_QUOTED_PATTERN = /^date:\s*(['"])\d{4}-\d{2}-\d{2}\1\s*$/m;

function walkFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, results);
    } else if (VALID_EXTENSIONS.has(path.extname(entry.name))) {
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
  const content = fs.readFileSync(file, 'utf8');
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) continue;

  if (DATE_QUOTED_PATTERN.test(frontmatter)) {
    offenders.push(path.relative(process.cwd(), file));
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
