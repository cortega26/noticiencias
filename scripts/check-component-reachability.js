/**
 * Component reachability checker (plan 044).
 *
 * Parses static imports from src/pages/**, src/layouts/**, and
 * astro.config.mjs as roots, follows imported .astro/.ts/.js files
 * through path aliases, and reports components with no inbound path.
 *
 * Supports an allowlist for dynamic imports or content-referenced
 * components via a JSON file at .component-reachability-allowlist.json.
 *
 * Usage: node scripts/check-component-reachability.js
 * Exits 0 if no unapproved unreachable components, 1 otherwise.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname, basename } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const PAGES = join(SRC, 'pages');
const LAYOUTS = join(SRC, 'layouts');
const CONFIG = join(ROOT, 'astro.config.mjs');

const ALLOWLIST_PATH = join(ROOT, '.component-reachability-allowlist.json');

// Collect all .astro files under src/components
function findComponents(dir, components = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      findComponents(full, components);
    } else if (entry.endsWith('.astro')) {
      components.push(full);
    }
  }
  return components;
}

// Find all files matching a pattern under a root
function findFiles(dir, pattern, files = []) {
  if (!existsSync(dir)) return files;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      findFiles(full, pattern, files);
    } else if (pattern.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

// Resolve a import path to a file path
function resolveImport(importPath, fromFile) {
  // Handle alias: ~/ → src/
  if (importPath.startsWith('~/')) {
    const rel = importPath.slice(2);
    for (const ext of ['', '.astro', '.ts', '.js', '.tsx', '.jsx']) {
      const candidate = join(SRC, rel + ext);
      if (existsSync(candidate)) return candidate;
      // Check index
      const indexCandidate = join(SRC, rel, 'index' + ext);
      if (existsSync(indexCandidate)) return indexCandidate;
    }
  }
  // Handle relative imports
  if (importPath.startsWith('.')) {
    const fromDir = resolve(fromFile, '..');
    const resolved = resolve(fromDir, importPath);
    for (const ext of ['', '.astro', '.ts', '.js', '.tsx', '.jsx']) {
      const candidate = resolved + ext;
      if (existsSync(candidate)) return candidate;
      const indexCandidate = join(resolved, 'index' + ext);
      if (existsSync(indexCandidate)) return indexCandidate;
    }
  }
  return null;
}

// Extract imports from a file (not a directory)
function getImports(filePath) {
  if (!existsSync(filePath)) return [];
  const stat = statSync(filePath);
  if (!stat.isFile()) return [];
  const content = readFileSync(filePath, 'utf-8');
  const imports = [];
  // Match: import X from 'path' or import { X } from 'path'
  const importRegex = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

// Build the reachability graph
const roots = [];
// Pages and layouts as roots
roots.push(...findFiles(PAGES, /\.(astro|ts|js)$/));
roots.push(...findFiles(LAYOUTS, /\.(astro|ts|js)$/));
// Config as root
if (existsSync(CONFIG)) roots.push(CONFIG);
// Integration entry
const integrationPath = join(SRC, 'integration/index.ts');
if (existsSync(integrationPath)) roots.push(integrationPath);

// BFS from roots
const reachable = new Set();
const queue = [...roots];
while (queue.length > 0) {
  const file = queue.shift();
  if (reachable.has(file)) continue;
  reachable.add(file);
  const imports = getImports(file);
  for (const imp of imports) {
    const resolved = resolveImport(imp, file);
    if (resolved && !reachable.has(resolved)) {
      queue.push(resolved);
    }
  }
}

// Load allowlist
let allowlist = [];
if (existsSync(ALLOWLIST_PATH)) {
  allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf-8'));
}

// Find unreachable components
const allComponents = findComponents(join(SRC, 'components'));
const unreachable = allComponents.filter(
  (comp) => !reachable.has(comp) && !allowlist.includes(comp)
);

if (unreachable.length === 0) {
  console.log('✅ All components are reachable from active roots.');
  process.exit(0);
}

console.error(`❌ ${unreachable.length} unreachable component(s) found:`);
for (const comp of unreachable) {
  const rel = comp.replace(ROOT + '/', '');
  console.error(`  ${rel}`);
}
console.error(
  '\nTo approve a component as dynamically imported, add it to .component-reachability-allowlist.json'
);
process.exit(1);
