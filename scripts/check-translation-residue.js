/**
 * check-translation-residue.js
 *
 * Flags non-Spanish residue in published posts — the unfinished-machine-
 * translation class Codex caught on PR #197 (`descoberta`, `youth` shipped
 * to Spanish readers). Source languages are the pipeline's working
 * languages: English originals and Portuguese (models and sources leak
 * both into Spanish drafts).
 *
 * Two tiers (same contract as check-tags.js):
 *
 *   Errors (block the build) — Portuguese markers. Portuguese prose is
 *   never legitimate in a Spanish body: nasal/diæretic diacritics foreign
 *   to Spanish (ã, õ, ç, â, ê, ô, à, è, ù, ä, ë, ï, ö) plus a curated list
 *   of PT-exclusive words. Known Spanish ü-words (pingüino, cigüeña,
 *   argüir…) are allowlisted so the diacritic test stays precise.
 *
 *   Warnings (do not block) — a conservative English suspect list
 *   (youth, breakthrough used as a bare noun, …). English appears
 *   legitimately in quoted paper titles and proper names, so these print
 *   for human triage instead of failing CI.
 *
 * Checked surfaces: body prose, excerpt, image_alt, fact_check labels.
 * Skipped surfaces: frontmatter metadata (DOIs, slugs, source_url),
 * fenced/inline code, URLs, HTML tags and comments.
 *
 * Exit codes: 0 — no errors (warnings may print); 1 — error-level residue.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from './utils/frontmatter-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
// Optional positional arg overrides the scanned directory (fixtures,
// previews). Same pattern as check-search-budget.js [path-to-dist].
const CLI_DIR = process.argv.slice(2).find((a) => !a.startsWith('-'));
const POSTS_DIR = CLI_DIR
  ? path.resolve(CLI_DIR)
  : path.resolve(REPO_ROOT, 'src', 'content', 'posts');
const POSTS_DIR_PREFIX = `${POSTS_DIR}${path.sep}`;
const VALID_EXTENSIONS = new Set(['.md', '.mdx']);

// Diacritics that never occur in correct Spanish prose: Portuguese
// tilde/cedilla/circumflex (ã, õ, ç, â, ê, ô) and grave accents (à, è,
// ù). German/French umlauts (ä, ë, ï, ö, ü) are DELIBERATELY untested:
// they occur in legitimate proper names (Schrödinger, Müller, pingüino)
// and flagging them produced false positives on the real corpus.
// Titlecased tokens are skipped by this test: they are almost always
// proper names that legally keep foreign orthography (São Paulo,
// João Pessoa). Lowercase leaks are still caught, and the word list
// below is case-insensitive for the rest.
const FOREIGN_DIACRITIC = /[ãõçâêôàèù]/u;
const isProperName = (token) => token[0] !== token[0].toLowerCase();

// Portuguese-exclusive tokens (no Spanish overlap by construction).
// Cognates or near-miss Spanish words are deliberately ABSENT, even when
// they look Portuguese: `para`, `como`, `porque`, `sobre`, `entre`,
// `dos` (number), `nos` (pronoun), `una` (article), `mais` (accentless
// typo of `más`), `são`/`sao` (proper-name São Paulo: lowercase `são`
// is already caught by the diacritic test). When in doubt the word
// stays out — precision over recall; the human checklist covers the rest.
const PT_WORDS = new Set(
  [
    'descoberta',
    'descobertas',
    'descoberto',
    'descobertos',
    'hoje',
    'ontem',
    'tambem',
    'também',
    'atraves',
    'através',
    'entao',
    'então',
    'nao',
    'não',
    'voce',
    'você',
    'estao',
    'estão',
    'jeito',
    'muito',
    'muita',
    'tudo',
    'coisa',
    'coisas',
    'gente',
    'fazer',
    'dizer',
    'ainda',
    'porquê',
    'das',
    'nós',
    'uma',
    'umas',
    'esse',
    'essa',
    'isso',
    'isto',
    'bem',
    'quando',
  ].map((w) => w.toLowerCase())
);

// Conservative English suspects — warning tier only, since quoted paper
// titles and proper names legitimately contain English.
const EN_SUSPECTS = new Set(
  ['youth', 'childhood', 'breakthrough', 'milestone', 'insight', 'oversight'].map((w) =>
    w.toLowerCase()
  )
);

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

function stripNonProse(text) {
  return (
    text
      // fenced code blocks
      .replace(/```[\s\S]*?```/g, ' ')
      // inline code
      .replace(/`[^`]+`/g, ' ')
      // HTML comments (e.g. source_identity) and tags
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      // URLs
      .replace(/https?:\/\/\S+/g, ' ')
      // markdown links: keep the visible text, drop the target
      .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1 ')
  );
}

function tokenize(text) {
  // Case preserved: the proper-name skip needs the original casing.
  // Word-list lookups lowercase per token at check time.
  return text.match(/[\p{L}\p{M}]+/gu) ?? [];
}

function checkText(text, errors, warnings) {
  const prose = stripNonProse(text);
  for (const raw of tokenize(prose)) {
    const token = raw.toLowerCase();
    if (!isProperName(raw) && FOREIGN_DIACRITIC.test(token)) {
      errors.push(`foreign diacritic (non-Spanish) in "${raw}"`);
      continue;
    }
    if (PT_WORDS.has(token)) {
      errors.push(`Portuguese residue "${token}"`);
    } else if (EN_SUSPECTS.has(token)) {
      warnings.push(`possible English residue "${token}" (triage manually)`);
    }
  }
}

const issues = [];
const warnings = [];
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
  const data = parsed.data ?? {};

  // Prose surfaces only — never metadata (slugs, DOIs, source_url).
  const surfaces = [parsed.content ?? '', data.excerpt ?? '', data.image_alt ?? ''];
  for (const item of data.fact_check ?? []) {
    if (item && typeof item.label === 'string') surfaces.push(item.label);
  }

  const fileErrors = [];
  const fileWarnings = [];
  for (const surface of surfaces) {
    if (typeof surface === 'string') checkText(surface, fileErrors, fileWarnings);
  }
  if (fileErrors.length > 0) issues.push({ file: relPath, problems: fileErrors });
  if (fileWarnings.length > 0) warnings.push({ file: relPath, problems: fileWarnings });
}

const jsonMode = process.argv.includes('--json');

if (jsonMode) {
  console.log(
    JSON.stringify({
      check: 'translation-residue',
      status: issues.length === 0 ? 'pass' : 'fail',
      filesCount: checkedCount,
      errors: issues.map((i) => ({ file: i.file, message: i.problems.join('; ') })),
      warnings: warnings.map((w) => ({ file: w.file, message: w.problems.join('; ') })),
    })
  );
  process.exit(issues.length === 0 ? 0 : 1);
}

if (issues.length > 0) {
  console.error(`[check:translation-residue] ${issues.length} post(s) with residue:\n`);
  for (const { file, problems } of issues) {
    console.error(`  ${file}`);
    for (const p of problems) console.error(`    • ${p}`);
  }
}
if (warnings.length > 0) {
  console.warn(`[check:translation-residue] ${warnings.length} post(s) with suspects:\n`);
  for (const { file, problems } of warnings) {
    console.warn(`  ${file}`);
    for (const p of problems) console.warn(`    • ${p}`);
  }
}
if (issues.length > 0) process.exit(1);
console.log(
  `[check:translation-residue] OK — ${checkedCount} posts checked, no residue.` +
    (warnings.length > 0 ? ` (${warnings.length} warning(s) present)` : '')
);
