#!/usr/bin/env node
/**
 * check-doc-drift.js
 *
 * Validates that file paths and npm scripts referenced in governance docs
 * actually exist. Catches stale references before they mislead contributors.
 *
 * Checks:
 *   - File paths in backticks that look like repo paths exist on disk
 *   - npm scripts in `npm run <name>` exist in package.json
 *
 * Exit codes:
 *   0 — all paths and commands verified
 *   1 — one or more broken references found
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, relative, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// ── Docs to check ──────────────────────────────────────────────
const DOC_FILES = [
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'docs/ARCHITECTURE.md',
  'docs/SOURCE_OF_TRUTH.md',
];

// ── npm scripts cache ──────────────────────────────────────────
const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf-8'));
const npmScripts = new Set(Object.keys(pkg.scripts || {}));

// ── Helpers ────────────────────────────────────────────────────

/**
 * Strip line-number suffixes from paths like "foo.ts:122" or "foo.ts:24-25,34-35".
 */
function stripLineNumbers(raw) {
  return raw.replace(/:(\d+(-\d+)?(,\d+(-\d+)?)*)+$/, '');
}

/**
 * Check if a string looks like a valid repo file path (not a glob, not a URL, not a URL path).
 */
function looksLikeFilePath(s) {
  if (!s) return false;
  // Skip URLs and URL paths (like /search.json, /blog/, /rss.xml)
  if (s.startsWith('http://') || s.startsWith('https://')) return false;
  if (s.startsWith('/') && !s.includes('home/') && !s.includes('noticiencias')) return false;
  // Skip anchors only
  if (s.startsWith('#')) return false;
  // Skip wildcards / globs
  if (s.includes('*')) return false;
  // Skip cross-repo backend references
  if (s.startsWith('news_collector/') || s.startsWith('../noticiencias_news_collector'))
    return false;
  // Skip directory-only paths with no extension (harder to validate accurately)
  if (s.endsWith('/')) return false;
  // Skip JavaScript member expressions (data.permalink, post.title, etc.)
  if (
    /^[a-z_]+\.[a-z_]+$/.test(s) &&
    !/\.(ts|js|astro|md|yaml|yml|json|css|mjs|py|txt|xml)$/.test(s)
  )
    return false;
  // Must contain a dot extension or be a known directory prefix
  return (
    /\.(ts|js|astro|md|yaml|yml|json|css|mjs|py|txt|xml)$/.test(s) ||
    /^(src|scripts|tests|docs|data|\.github)/.test(s)
  );
}

/**
 * Resolve a path from a doc to an absolute filesystem path.
 * Paths that look like repo-root references (src/..., scripts/..., etc.)
 * are resolved from REPO_ROOT. Simple filenames (blog.ts) are tried against
 * common directories. Everything else is resolved relative to the doc.
 */
function resolveDocPath(rawPath, docDir) {
  // Strip leading / for absolute-ish paths
  let cleaned = rawPath.replace(/^\/+/, '');

  // Handle old workspace absolute paths:
  // /home/carlos/.../noticiencias/src/foo → src/foo
  const noticienciasIdx = cleaned.indexOf('noticiencias/');
  if (noticienciasIdx >= 0) {
    const after = cleaned.slice(noticienciasIdx);
    // Skip one directory level (either "noticiencias/" or the next segment)
    const slashIdx = after.indexOf('/');
    if (slashIdx >= 0) {
      cleaned = after.slice(slashIdx + 1);
    }
  }

  // Known repo-root prefixes: resolve from REPO_ROOT
  const rootPrefixes = [
    'src/',
    'scripts/',
    'tests/',
    'docs/',
    'data/',
    '.github/',
    '.contract-snapshots/',
  ];
  if (rootPrefixes.some((p) => cleaned.startsWith(p))) {
    return resolve(REPO_ROOT, cleaned);
  }

  // Top-level files: resolve from REPO_ROOT
  const topLevelFiles = [
    'package.json',
    'AGENTS.md',
    'CLAUDE.md',
    'README.md',
    'CONTRIBUTING.md',
    'CHANGELOG.md',
    'vitest.config.ts',
    'tsconfig.json',
    'astro.config.mjs',
    'eslint.config.mjs',
    'tailwind.config.mjs',
    '.gitignore',
    '.prettierrc',
  ];
  if (topLevelFiles.includes(cleaned)) {
    return resolve(REPO_ROOT, cleaned);
  }

  // Simple filenames without path (e.g. "blog.ts", "utils.ts"):
  // try common source directories broadly
  if (!cleaned.includes('/') && cleaned.includes('.')) {
    const searchDirs = [
      'src/utils',
      'src/utils/browser',
      'src/layouts',
      'src/layouts/template',
      'src/components/ds/atoms',
      'src/components/ds/molecules',
      'src/components/ds/organisms',
      'src/components/common',
      'src/components/template',
      'src/components/template/blog',
      'src/components/template/common',
      'src/components/template/ui',
      'src/components/template/widgets',
      'src/pages',
      'src/pages/blog',
      'src/pages/categorias',
      'src/pages/temas',
      'src/pages/series',
      'scripts',
      'tests',
      '.github/workflows',
      'docs',
      '',
    ];
    for (const d of searchDirs) {
      const candidate = resolve(REPO_ROOT, d, cleaned);
      if (existsSync(candidate)) return candidate;
    }
    // If none found, return the most likely one for error reporting
    return resolve(REPO_ROOT, 'src/utils', cleaned);
  }

  // Directory paths (no extension): resolve from REPO_ROOT
  if (!cleaned.includes('.')) {
    return resolve(REPO_ROOT, cleaned);
  }

  // Relative to doc directory
  return resolve(docDir, cleaned);
}

/**
 * Extract file paths from a single line of markdown.
 * Returns array of { raw, resolved } objects.
 */
function extractPaths(line) {
  const results = [];

  // Match backtick-enclosed paths: `src/foo/bar.ts`
  const backtickRe = /`([^`]+)`/g;
  let m;
  while ((m = backtickRe.exec(line)) !== null) {
    const raw = m[1].trim();
    const cleaned = stripLineNumbers(raw);
    if (looksLikeFilePath(cleaned)) {
      results.push({ raw, cleaned });
    }
  }

  // Match npm run commands: npm run <name>
  const npmRe = /`npm run (\S+)`/g;
  while ((m = npmRe.exec(line)) !== null) {
    results.push({ raw: m[0], npmCmd: m[1] });
  }

  return results;
}

// ── Main ───────────────────────────────────────────────────────
const broken = [];

for (const docRel of DOC_FILES) {
  const docPath = resolve(REPO_ROOT, docRel);
  if (!existsSync(docPath)) {
    broken.push({ doc: docRel, type: 'doc_missing', ref: docRel });
    continue;
  }

  const lines = readFileSync(docPath, 'utf-8').split('\n');
  const docDir = dirname(docPath);
  let inCodeBlock = false;

  for (const line of lines) {
    // Track code blocks (```)
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Skip markdown table rows (they contain pipes and often trigger false positives)
    if (line.trim().startsWith('|')) continue;

    const refs = extractPaths(line);
    for (const ref of refs) {
      if (ref.npmCmd) {
        if (!npmScripts.has(ref.npmCmd)) {
          broken.push({
            doc: docRel,
            type: 'npm_script',
            ref: ref.raw,
            message: `npm script "${ref.npmCmd}" not found in package.json`,
          });
        }
        continue;
      }

      const resolved = resolveDocPath(ref.cleaned, docDir);
      if (!existsSync(resolved)) {
        // Check if it exists with a different extension
        const dir = dirname(resolved);
        const base = basename(resolved, ref.cleaned.match(/\.\w+$/)?.[0] || '');
        const ext = ref.cleaned.match(/\.\w+$/)?.[0] || '';

        broken.push({
          doc: docRel,
          type: 'broken_path',
          ref: ref.raw,
          message: `file not found: ${relative(REPO_ROOT, resolved)}`,
        });
      }
    }
  }
}

// ── Deduplicate ─────────────────────────────────────────────────
const seen = new Set();
const unique = broken.filter((b) => {
  const key = `${b.doc}:${b.ref}:${b.type}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// ── Report ─────────────────────────────────────────────────────
if (unique.length > 0) {
  const pathErrors = unique.filter((b) => b.type === 'broken_path');
  const scriptErrors = unique.filter((b) => b.type === 'npm_script');
  const missingDocs = unique.filter((b) => b.type === 'doc_missing');

  if (missingDocs.length > 0) {
    console.error(`[check:doc-drift] ${missingDocs.length} doc(s) not found:`);
    for (const b of missingDocs) console.error(`  • ${b.ref}`);
  }
  if (pathErrors.length > 0) {
    console.error(`[check:doc-drift] ${pathErrors.length} broken path(s):`);
    for (const b of pathErrors) {
      console.error(`  ${b.doc}: \`${b.ref}\``);
      console.error(`    → ${b.message}`);
    }
  }
  if (scriptErrors.length > 0) {
    console.error(`[check:doc-drift] ${scriptErrors.length} unknown npm script(s):`);
    for (const b of scriptErrors) console.error(`  ${b.doc}: ${b.ref}`);
  }

  console.error('\nUpdate the docs to reference existing files and commands.');
  process.exit(pathErrors.length > 0 ? 1 : 0);
}

console.log(
  `[check:doc-drift] OK — ${DOC_FILES.length} docs checked, all paths and commands verified.`
);
