/**
 * Descriptive hero-alt diagnostics (Codex P2 on frontend PR #191).
 *
 * The publication pipeline stamps `Ilustración editorial relacionada con
 * {title}` when the source image ships no alt text. That boilerplate hides
 * the image from screen-reader users and mislabels it in the visible caption
 * (PostLayout renders `image_alt` as both `alt` and `<figcaption>`), so new
 * posts must describe the actual image. Legacy posts are grandfathered via
 * `data/hero-image-alt-allowlist.json` with an explicit reason per file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveHeroPlaceholderPaths, walkPostFiles } from './hero-placeholders.js';
import { matter } from './frontmatter-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..');
export const BOILERPLATE_ALT_PREFIX = 'ilustración editorial relacionada con';
export const GENERIC_ALT_PREFIX = 'imagen de';

export function isBoilerplateHeroAlt(value) {
  if (typeof value !== 'string') return false;
  return value.trim().toLowerCase().startsWith(BOILERPLATE_ALT_PREFIX);
}

export function isGenericHeroAlt(value) {
  if (typeof value !== 'string') return false;
  return /^imagen\s+de\b/i.test(value.trim());
}

export function resolveHeroAltPaths(repoRoot = DEFAULT_REPO_ROOT) {
  const base = resolveHeroPlaceholderPaths(repoRoot);
  return {
    repoRoot: base.repoRoot,
    postsDir: base.postsDir,
    assetsImagesDir: base.assetsImagesDir,
    allowlistPath: path.resolve(base.repoRoot, 'data', 'hero-image-alt-allowlist.json'),
    postsDirPrefix: base.postsDirPrefix,
  };
}

export function loadHeroAltAllowlist(allowlistPath) {
  if (!fs.existsSync(allowlistPath)) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  return parsed.allowedAlts ?? {};
}

function altErrorForFile(relPath, imageAlt, allowlist, usedAllowlistEntries) {
  if (!imageAlt) {
    return `${relPath}: missing 'image_alt' (required when 'image' is set)`;
  }

  if (isGenericHeroAlt(imageAlt)) {
    return (
      `${relPath}: image_alt starts with "Imagen de" — use a descriptive Spanish ` +
      `phrase instead: "${imageAlt}"`
    );
  }

  if (isBoilerplateHeroAlt(imageAlt)) {
    usedAllowlistEntries.add(relPath);
    const reason = typeof allowlist[relPath] === 'string' ? allowlist[relPath].trim() : '';
    if (!reason) {
      return (
        `${relPath}: image_alt is the pipeline boilerplate ("Ilustración editorial ` +
        `relacionada con …") — describe the actual image instead: "${imageAlt}"`
      );
    }
  }

  return null;
}

function staleAltAllowlistErrors(allowlist, usedAllowlistEntries) {
  return Object.keys(allowlist)
    .filter((relPath) => !usedAllowlistEntries.has(relPath))
    .sort((a, b) => a.localeCompare(b))
    .map(
      (relPath) =>
        `${relPath}: hero-alt allowlist entry is stale (post no longer uses a boilerplate alt) — remove it from data/hero-image-alt-allowlist.json`
    );
}

export function collectImageAltDiagnostics(options = {}) {
  const paths = resolveHeroAltPaths(options.repoRoot);
  const errors = [];
  const files = walkPostFiles(paths);
  const allowlist = loadHeroAltAllowlist(paths.allowlistPath);
  const usedAllowlistEntries = new Set();

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const { data: parsed } = matter(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    if (!parsed.image) continue;

    const relPath = path.relative(paths.repoRoot, file);
    const imageAlt = typeof parsed.image_alt === 'string' ? parsed.image_alt.trim() : '';
    const error = altErrorForFile(relPath, imageAlt, allowlist, usedAllowlistEntries);
    if (error) errors.push(error);
  }

  const staleAllowlistEntries = Object.keys(allowlist)
    .filter((relPath) => !usedAllowlistEntries.has(relPath))
    .sort((a, b) => a.localeCompare(b));
  errors.push(...staleAltAllowlistErrors(allowlist, usedAllowlistEntries));

  return {
    paths,
    filesCount: files.length,
    errors,
    allowlist,
    staleAllowlistEntries,
  };
}
