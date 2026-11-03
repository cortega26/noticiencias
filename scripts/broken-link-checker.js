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

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DIST_DIR = resolve(process.argv[2] || resolve(REPO_ROOT, 'dist'));
const SITE_ORIGIN = 'https://noticiencias.com';

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

function extractInternalLinks(htmlContent, filePath) {
  const links = [];
  const pagePath = '/' + relative(DIST_DIR, filePath).split(sep).join('/');
  const pageUrl = new URL(pagePath.replace(/index\.html$/, ''), SITE_ORIGIN);
  const $ = cheerio.load(htmlContent);
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')?.trim();
    if (!href || href.startsWith('#')) return;

    let url;
    let pathname;
    try {
      url = new URL(href, pageUrl);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.hostname !== new URL(SITE_ORIGIN).hostname
      )
        return;
      pathname = decodeURIComponent(url.pathname);
    } catch {
      links.push({ href, resolved: null, sourceFile: filePath });
      return;
    }

    const resolved = resolve(DIST_DIR, '.' + pathname);
    if (resolved !== DIST_DIR && !resolved.startsWith(DIST_DIR + sep)) {
      links.push({ href, resolved: null, sourceFile: filePath });
      return;
    }
    links.push({ href, resolved, sourceFile: filePath });
  });

  return links;
}

// ---------------------------------------------------------------------------
// Verify links
// ---------------------------------------------------------------------------

function verifyLink(resolved) {
  if (!resolved) return { valid: false, reason: 'Invalid internal URL' };
  // Check if file exists
  if (existsSync(resolved) && statSync(resolved).isFile()) {
    return { valid: true };
  }

  if (existsSync(join(resolved, 'index.html'))) return { valid: true };

  // Try with .html extension
  if (!extname(resolved)) {
    const withHtml = resolved + '.html';
    if (existsSync(withHtml)) {
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
  if (htmlFiles.length === 0) {
    console.error('[broken-link-checker] No HTML files found; build the site first.');
    process.exit(1);
  }

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

  if (totalLinks === 0) {
    console.error('[broken-link-checker] No internal links found; the audit cannot pass.');
    process.exit(1);
  }

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
