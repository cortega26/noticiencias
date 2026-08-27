#!/usr/bin/env node
/**
 * check-doc-drift.js
 *
 * Validates that file paths, commands, and declared invariants referenced in
 * governance docs are true of the current repository. Catches stale
 * references and stale semantic claims before they mislead contributors.
 *
 * Checks:
 *   - File paths in backticks that look like repo paths exist on disk
 *   - npm scripts in `npm run <name>` exist in package.json
 *   - Authority-order references: claims that a file is "authoritative"
 *     (including the Pointer form) must reference existing files, and no
 *     two documents may claim authority over the same subject
 *   - Declared invariants, parsed from authoritative files (not hardcoded):
 *       - stale schema path `src/content/config.ts` (expected `src/content.config.ts`)
 *       - stale site host `noticiencias.cl` (expected from src/config.yaml or astro.config.mjs)
 *       - stale framework/runtime majors ("static Astro N site" / "Node N"
 *         claims that disagree with package.json versions)
 *   - Cross-repo references (`../noticiencias_news_collector/...`) when a
 *     sibling checkout exists; silently skipped when it does not
 *
 * Env overrides (used by the test suite; default to repo behavior):
 *   - DOC_DRIFT_ROOT: base directory for resolving doc paths
 *   - DOC_DRIFT_FILES: comma-separated list of docs to check
 *   - DOC_DRIFT_SIBLING_ROOT: sibling repo root for cross-repo refs
 *     (default: ../noticiencias_news_collector relative to this repo)
 *
 * Exit codes:
 *   0 — all paths, commands, invariants, and authority references verified
 *   1 — one or more broken references or stale claims found
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_DIR = resolve(__dirname, '..');

// DOC_DRIFT_ROOT / DOC_DRIFT_FILES let the test suite run the check against
// fixture doc trees instead of the live repo docs.
const REPO_ROOT = process.env.DOC_DRIFT_ROOT ? resolve(process.env.DOC_DRIFT_ROOT) : SCRIPT_DIR;

// ── Docs to check ──────────────────────────────────────────────
const DEFAULT_DOC_FILES = [
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'docs/ARCHITECTURE.md',
  'docs/SOURCE_OF_TRUTH.md',
  'docs/tagging.md',
  'docs/webhook-integration.md',
  'docs/report-pipeline-setup.md',
  'docs/supported-dependency-matrix.md',
  // eslint-disable-next-line no-secrets/no-secrets -- doc filename in the active allowlist
  'docs/DEPLOYMENT_SECURITY_HEADERS.md',
  'docs/EDITORIAL.md',
  'docs/EDITORIAL_VOICE.md',
];

const DOC_FILES = (() => {
  const envFiles = (process.env.DOC_DRIFT_FILES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return envFiles.length > 0 ? envFiles : DEFAULT_DOC_FILES;
})();

// ── npm scripts cache ──────────────────────────────────────────
const npmScripts = new Set();
try {
  const pkg = JSON.parse(readFileSync(resolve(SCRIPT_DIR, 'package.json'), 'utf-8'));
  for (const name of Object.keys(pkg.scripts || {})) npmScripts.add(name);
} catch {
  // Fixture runs (DOC_DRIFT_ROOT set) may have no package.json; npm scripts
  // simply cannot be verified in that mode.
}

// ── Declared invariants (parsed from authoritative files) ──────
// Versions and hosts are read from the files that own them, never
// hardcoded, so the check drifts with the code instead of against it.

// Sibling repo for cross-repo reference validation. When it is absent
// (CI without a sibling checkout) cross-repo refs are skipped silently.
const SIBLING_ROOT = process.env.DOC_DRIFT_SIBLING_ROOT
  ? resolve(process.env.DOC_DRIFT_SIBLING_ROOT)
  : resolve(SCRIPT_DIR, '..', 'noticiencias_news_collector');
const SIBLING_PRESENT = existsSync(SIBLING_ROOT);

// Site host: src/config.yaml site.site is authoritative; astro.config.mjs
// site: is the fallback when config.yaml is absent (fixture trees).
let SITE_HOST = null;
try {
  const yaml = readFileSync(resolve(REPO_ROOT, 'src/config.yaml'), 'utf-8');
  const m = yaml.match(/^\s{2}site:\s*['"]([^'"]+)['"]/m);
  if (m) SITE_HOST = m[1].replace(/\/+$/, '');
} catch {
  // no config.yaml (fixture tree)
}
if (!SITE_HOST) {
  try {
    const astroCfg = readFileSync(resolve(REPO_ROOT, 'astro.config.mjs'), 'utf-8');
    const m = astroCfg.match(/site:\s*['"]([^'"]+)['"]/);
    if (m) SITE_HOST = m[1].replace(/\/+$/, '');
  } catch {
    // no astro.config.mjs either (fixture tree)
  }
}

// Framework/runtime majors: from package.json (dependencies.astro,
// engines.node). Skipped in fixture mode when package.json is absent.
let ASTRO_MAJOR = null;
let NODE_MAJOR = null;
try {
  const pkg = JSON.parse(readFileSync(resolve(SCRIPT_DIR, 'package.json'), 'utf-8'));
  const astroVer = pkg.dependencies && pkg.dependencies.astro;
  if (typeof astroVer === 'string') {
    const m = astroVer.match(/(\d+)/);
    if (m) ASTRO_MAJOR = parseInt(m[1], 10);
  }
  const nodeRange = pkg.engines && pkg.engines.node;
  if (typeof nodeRange === 'string') {
    const m = nodeRange.match(/>=\s*(\d+)/);
    if (m) NODE_MAJOR = parseInt(m[1], 10);
  }
} catch {
  // fixture run without package.json
}

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
  // Cross-repo backend references are validated against the sibling repo
  // when it is checked out (see resolveDocPath); keep them as candidates.
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

  // Cross-repo backend references: validate against the sibling checkout
  // when present; otherwise the reference is skipped silently.
  if (cleaned.startsWith('../noticiencias_news_collector/')) {
    if (SIBLING_PRESENT) {
      const rest = cleaned.slice('../noticiencias_news_collector/'.length);
      return resolve(SIBLING_ROOT, rest);
    }
    return null;
  }
  if (cleaned.startsWith('news_collector/')) {
    if (SIBLING_PRESENT) {
      return resolve(SIBLING_ROOT, cleaned);
    }
    return null;
  }

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
    'public/',
    'workers/',
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

/**
 * Normalize an authority subject for grouping (used by the contradiction
 * check): lowercase, collapse whitespace, drop trailing punctuation.
 */
function normalizeAuthoritySubject(subject) {
  return subject
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[.!:;]+$/, '');
}

/**
 * Extract authority claims from a single line of markdown.
 *
 * Recognized shapes (the ones actually used by the governance docs):
 *   - "the authoritative <subject> is `file`"
 *   - "the authoritative <subject> is [`file`](./target)"
 *   - "the authoritative <subject> is [file](./target)"   (Pointer form)
 *
 * Known limitations (deliberately not modeled):
 *   - "Authority: Subordinate to `X`" statements
 *     (docs/ARCHITECTURE.md) are not parsed; the referenced files are
 *     still existence-checked by the backtick path check above.
 *   - "authoritative <subject>" list bullets (docs/SOURCE_OF_TRUTH.md)
 *     where the subject and its file are on separate lines are not paired;
 *     each referenced file is still existence-checked by the path check.
 *   - Link targets that are absolute filesystem paths (old machine-specific
 *     hrefs like /home/<user>/...) are not verified: they describe a
 *     workspace layout, not a repo reference. Only relative link targets
 *     are checked for existence.
 */
const AUTHORITY_CLAIM_RE =
  /(?<!non-)authoritative\s+([^`\n]{1,80}?)\s+is\s+(?:`([^`]+)`|\[`([^`]+)`\]\(([^)]*)\)|\[([^\]\n]+)\]\(([^)]*)\))/gi;

function extractAuthorityClaims(line) {
  const claims = [];
  let m;
  while ((m = AUTHORITY_CLAIM_RE.exec(line)) !== null) {
    const subject = normalizeAuthoritySubject(m[1]);
    const ref = (m[2] || m[3] || m[5] || '').trim();
    const target = (m[4] || m[6] || '').trim();
    const claim = { subject, ref: null, target: null };
    if (ref && looksLikeFilePath(ref)) claim.ref = stripLineNumbers(ref);
    if (
      target &&
      !target.startsWith('http://') &&
      !target.startsWith('https://') &&
      !target.startsWith('/') &&
      !target.startsWith('#') &&
      !target.includes('*') &&
      !target.startsWith('mailto:')
    ) {
      claim.target = stripLineNumbers(target);
    }
    if (claim.ref || claim.target) claims.push(claim);
  }
  return claims;
}

/**
 * Extract "This file governs <subject>" self-claims. Used to detect two
 * documents claiming governance over the same subject.
 */
const GOVERNS_RE = /\b(?:this file|this document)\s+governs\s+([^.!]+)/gi;

function extractGovernsClaims(line) {
  const subjects = [];
  let m;
  while ((m = GOVERNS_RE.exec(line)) !== null) {
    subjects.push(normalizeAuthoritySubject(m[1]));
  }
  return subjects;
}

// ── Main ───────────────────────────────────────────────────────
const broken = [];
const authorityClaims = [];
const governsClaims = [];

/**
 * Check a single non-code line for declared-invariant violations.
 * Invariants are parsed from authoritative files (config.yaml,
 * astro.config.mjs, package.json), so expected values drift with code.
 */
function checkInvariants(line, docRel, lineNo) {
  const found = [];

  // Stale schema path: the pre-split path is gone; content.config.ts owns it.
  if (/`src\/content\/config\.ts`/.test(line)) {
    found.push({
      doc: docRel,
      type: 'stale_schema_path',
      ref: 'src/content/config.ts',
      line: lineNo,
      message: 'expected `src/content.config.ts` (schema moved out of src/content/)',
    });
  }

  // Stale site host: production host comes from config.yaml / astro.config.mjs.
  if (SITE_HOST && /noticiencias\.cl/.test(line)) {
    found.push({
      doc: docRel,
      type: 'stale_site_host',
      ref: 'noticiencias.cl',
      line: lineNo,
      message: `expected ${SITE_HOST} (parsed from site config)`,
    });
  }

  // Stale framework major: docs claiming "static Astro N site" (present-tense
  // current-state claims only) must match the installed major from package.json.
  if (ASTRO_MAJOR !== null) {
    const m = line.match(/static\s+Astro\s+(\d+)\s+site/i);
    if (m && parseInt(m[1], 10) !== ASTRO_MAJOR) {
      found.push({
        doc: docRel,
        type: 'stale_framework_major',
        ref: `static Astro ${m[1]} site`,
        line: lineNo,
        message: `expected Astro ${ASTRO_MAJOR} (parsed from package.json dependencies.astro)`,
      });
    }
  }

  // Stale runtime major: "Node N" claims in current-state contexts must match
  // the engines range major from package.json.
  if (NODE_MAJOR !== null) {
    const m = line.match(/Node(?:\.js)?\s+(?:v?)(\d+)/i);
    if (m && parseInt(m[1], 10) !== NODE_MAJOR) {
      found.push({
        doc: docRel,
        type: 'stale_runtime_major',
        ref: `Node ${m[1]}`,
        line: lineNo,
        message: `expected Node ${NODE_MAJOR} (parsed from package.json engines.node)`,
      });
    }
  }

  return found;
}

for (const docRel of DOC_FILES) {
  const docPath = resolve(REPO_ROOT, docRel);
  if (!existsSync(docPath)) {
    broken.push({ doc: docRel, type: 'doc_missing', ref: docRel });
    continue;
  }

  const lines = readFileSync(docPath, 'utf-8').split('\n');
  const docDir = dirname(docPath);
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    // Track code blocks (```)
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Declared invariants run on every non-code line, including table rows:
    // they are semantic claims, not path lookups, and must never go stale.
    for (const err of checkInvariants(line, docRel, lineNo)) broken.push(err);

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
            line: lineNo,
            message: `npm script "${ref.npmCmd}" not found in package.json`,
          });
        }
        continue;
      }

      const resolved = resolveDocPath(ref.cleaned, docDir);
      // Cross-repo refs resolve to null when the sibling is not checked out:
      // skip them silently in that case.
      if (resolved === null) continue;
      if (!existsSync(resolved)) {
        broken.push({
          doc: docRel,
          type: 'broken_path',
          ref: ref.raw,
          line: lineNo,
          message: `file not found: ${relative(REPO_ROOT, resolved)}`,
        });
      }
    }

    for (const claim of extractAuthorityClaims(line)) {
      authorityClaims.push({ doc: docRel, docDir, ...claim });
    }
    for (const subject of extractGovernsClaims(line)) {
      governsClaims.push({ doc: docRel, docDir, subject });
    }
  }
}

// ── Authority-order reference verification ─────────────────────
const authorityErrors = [];
const authorityBySubject = new Map(); // subject → Map(resolvedPath → Set(docs))

function recordAuthoritySubject(subject, resolvedPath, doc) {
  if (!authorityBySubject.has(subject)) authorityBySubject.set(subject, new Map());
  const byPath = authorityBySubject.get(subject);
  if (!byPath.has(resolvedPath)) byPath.set(resolvedPath, new Set());
  byPath.get(resolvedPath).add(doc);
}

for (const claim of authorityClaims) {
  if (claim.ref) {
    const resolved = resolveDocPath(claim.ref, claim.docDir);
    if (!existsSync(resolved)) {
      authorityErrors.push({
        doc: claim.doc,
        type: 'authority_ref',
        ref: claim.ref,
        message: `authority reference not found: ${relative(REPO_ROOT, resolved)}`,
      });
    } else {
      recordAuthoritySubject(claim.subject, resolved, claim.doc);
    }
  }
  if (claim.target) {
    const resolvedTarget = resolveDocPath(claim.target, claim.docDir);
    if (!existsSync(resolvedTarget)) {
      authorityErrors.push({
        doc: claim.doc,
        type: 'authority_ref',
        ref: claim.target,
        message: `authority link target not found: ${relative(REPO_ROOT, resolvedTarget)}`,
      });
    }
  }
}

for (const claim of governsClaims) {
  recordAuthoritySubject(claim.subject, resolve(REPO_ROOT, claim.doc), claim.doc);
}

for (const [subject, byPath] of authorityBySubject) {
  if (byPath.size > 1) {
    const detail = [...byPath.entries()]
      .map(([path, docs]) => `${relative(REPO_ROOT, path)} (claimed by ${[...docs].join(', ')})`)
      .join(' vs ');
    authorityErrors.push({
      doc: 'multiple',
      type: 'authority_conflict',
      ref: subject,
      message: `conflicting authority over "${subject}": ${detail}`,
    });
  }
}

for (const err of authorityErrors) broken.push(err);

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
  const authorityRefErrors = unique.filter((b) => b.type === 'authority_ref');
  const authorityConflictErrors = unique.filter((b) => b.type === 'authority_conflict');
  const invariantErrors = unique.filter((b) =>
    [
      'stale_schema_path',
      'stale_site_host',
      'stale_framework_major',
      'stale_runtime_major',
    ].includes(b.type)
  );

  if (missingDocs.length > 0) {
    console.error(`[check:doc-drift] ${missingDocs.length} doc(s) not found:`);
    for (const b of missingDocs) console.error(`  • ${b.ref}`);
  }
  if (pathErrors.length > 0) {
    console.error(`[check:doc-drift] ${pathErrors.length} broken path(s):`);
    for (const b of pathErrors) {
      console.error(`  ${b.doc}:${b.line || '?'}: \`${b.ref}\``);
      console.error(`    → ${b.message}`);
    }
  }
  if (scriptErrors.length > 0) {
    console.error(`[check:doc-drift] ${scriptErrors.length} unknown npm script(s):`);
    for (const b of scriptErrors) console.error(`  ${b.doc}:${b.line || '?'}: ${b.ref}`);
  }
  if (invariantErrors.length > 0) {
    console.error(`[check:doc-drift] ${invariantErrors.length} stale declared claim(s):`);
    for (const b of invariantErrors) {
      console.error(`  ${b.doc}:${b.line}: \`${b.ref}\``);
      console.error(`    → ${b.message}`);
    }
  }
  if (authorityRefErrors.length > 0) {
    console.error(`[check:doc-drift] ${authorityRefErrors.length} broken authority reference(s):`);
    for (const b of authorityRefErrors) {
      console.error(`  ${b.doc}: authority over "${b.ref}"`);
      console.error(`    → ${b.message}`);
    }
  }
  if (authorityConflictErrors.length > 0) {
    console.error(
      `[check:doc-drift] ${authorityConflictErrors.length} conflicting authority claim(s):`
    );
    for (const b of authorityConflictErrors) {
      console.error(`  ${b.ref}: ${b.message}`);
    }
  }

  console.error('\nUpdate the docs to reference existing files, commands, and authority sources.');
  process.exit(
    pathErrors.length > 0 ||
      authorityRefErrors.length > 0 ||
      authorityConflictErrors.length > 0 ||
      invariantErrors.length > 0 ||
      missingDocs.length > 0
      ? 1
      : 0
  );
}

console.log(
  `[check:doc-drift] OK — ${DOC_FILES.length} docs checked, all paths, commands, invariants, and authority references verified.`
);
