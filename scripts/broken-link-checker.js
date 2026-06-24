#!/usr/bin/env node
/**
 * broken-link-checker.js
 *
 * Scans the built dist/ directory for broken internal links.
 * Extracts all <a href="..."> targets, resolves relative URLs,
 * and verifies the target files exist.
 *
 * Usage:
 *   node scripts/broken-link-checker.js [dist_dir]
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DIST_DIR = process.argv[2] || resolve(REPO_ROOT, 'dist');

// ---------------------------------------------------------------------------
// Collect all HTML files
// ---------------------------------------------------------------------------

function collectHtmlFiles(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        results.push(...collectHtmlFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.html') || entry.name.endsWith('.htm'))) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return results;
}

// ---------------------------------------------------------------------------
// Extract internal links from HTML
// ---------------------------------------------------------------------------

const LINK_RE = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

function extractInternalLinks(htmlContent, filePath) {
  const links = [];
  const matches = htmlContent.matchAll(LINK_RE);

  for (const match of matches) {
    let href = match[1];

    // Skip external URLs, anchors, mailto, tel
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('#')
    ) {
      continue;
    }

    // Resolve relative path
    const fileDir = dirname(filePath);
    const resolved = resolve(fileDir, href);

    // Only check links that point to files within dist/
    if (resolved.startsWith(DIST_DIR)) {
      links.push({ href, resolved, sourceFile: filePath });
    }
  }

  return links;
}

// ---------------------------------------------------------------------------
// Verify links
// ---------------------------------------------------------------------------

function verifyLink(resolved) {
  // Check if file exists
  if (existsSync(resolved)) {
    return { valid: true };
  }

  // Try with .html extension
  if (!extname(resolved)) {
    const withHtml = resolved + '.html';
    if (existsSync(withHtml)) {
      return { valid: true };
    }
    // Try index.html in directory
    const indexHtml = join(resolved, 'index.html');
    if (existsSync(indexHtml)) {
      return { valid: true };
    }
  }

  return { valid: false, reason: 'File not found' };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log(`[broken-link-checker] Scanning ${DIST_DIR}...`);

  const htmlFiles = collectHtmlFiles(DIST_DIR);
  console.log(`[broken-link-checker] Found ${htmlFiles.length} HTML files.`);

  const brokenLinks = [];
  let totalLinks = 0;

  for (const file of htmlFiles) {
    const content = readFileSync(file, 'utf-8');
    const links = extractInternalLinks(content, file);
    totalLinks += links.length;

    for (const link of links) {
      const result = verifyLink(link.resolved);
      if (!result.valid) {
        brokenLinks.push({
          source: link.sourceFile.replace(DIST_DIR, ''),
          target: link.href,
          reason: result.reason,
        });
      }
    }
  }

  console.log(`[broken-link-checker] Checked ${totalLinks} internal links.`);

  if (brokenLinks.length > 0) {
    console.error(`[broken-link-checker] ${brokenLinks.length} BROKEN LINK(S) FOUND:`);
    for (const bl of brokenLinks.slice(0, 20)) {
      console.error(`  ❌ ${bl.source} → ${bl.target} (${bl.reason})`);
    }
    if (brokenLinks.length > 20) {
      console.error(`  ... and ${brokenLinks.length - 20} more`);
    }
    process.exit(1);
  }

  console.log('[broken-link-checker] No broken internal links found.');
}

main();
