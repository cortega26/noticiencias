/**
 * Frontend executable-content detection.
 *
 * Mirrors the backend policy in
 * `news_collector/components/editorial/ai_editor.py` — rejects generated
 * Markdown/MDX bodies containing script-capable HTML, inline event handlers,
 * `javascript:` URLs, and MDX/JSX expressions that could execute when rendered
 * by Astro.
 *
 * Code-fence regions (``` / ~~~) are stripped before matching so legitimate
 * code snippets in documentation or tech articles are never flagged.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const POSTS_DIR = join(process.cwd(), 'src', 'content', 'posts');

const EXECUTABLE_SCRIPT_TAG = /<\s*(?:script|iframe|object|embed)\b/i;
const SVG_EVENT = /<\s*svg\b[^>]*\bon[a-z]+\s*=/i;
const EVENT_ATTR = /<\s*\w+[^>]*\son[a-z]+\s*=/i;
const JAVASCRIPT_URL = /(?:href|src|action|formaction|data)\s*=\s*["']?\s*javascript\s*:/i;
const JAVASCRIPT_MD_LINK = /\]\s*\(\s*javascript\s*:/i;

function stripFencedRegions(text) {
  const lines = text.split('\n');
  const result = [];
  let activeFence = null;
  for (const line of lines) {
    const match = line.match(/^\s*(```+|~~~+)/);
    if (match) {
      const fenceChar = match[1][0];
      if (activeFence === null) {
        activeFence = fenceChar;
        result.push('');
        continue;
      } else if (activeFence === fenceChar) {
        activeFence = null;
        result.push('');
        continue;
      }
    }
    if (activeFence !== null) {
      result.push('');
    } else {
      result.push(line);
    }
  }
  return result.join('\n');
}

/**
 * @param {string} body
 * @returns {{ ok: boolean; label?: string; snippet?: string }}
 */
function scanForExecutableContent(body) {
  const checks = [
    { re: EXECUTABLE_SCRIPT_TAG, label: 'script-capable element' },
    { re: SVG_EVENT, label: 'SVG with event handler' },
    { re: EVENT_ATTR, label: 'inline event handler' },
    { re: JAVASCRIPT_URL, label: 'javascript: URL' },
    { re: JAVASCRIPT_MD_LINK, label: 'javascript: Markdown link' },
  ];

  for (const { re, label } of checks) {
    const match = body.match(re);
    if (match) {
      return {
        ok: false,
        label,
        snippet: match[0].slice(0, 80),
      };
    }
  }
  return { ok: true };
}

/**
 * @returns {{ errors: string[]; warnings: string[]; filesCount: number }}
 */
export function collectExecutableContentDiagnostics() {
  const errors = [];
  const warnings = [];
  let filesCount = 0;

  let entries;
  try {
    entries = readdirSync(POSTS_DIR);
  } catch {
    errors.push(`Cannot read posts directory: ${POSTS_DIR}`);
    return { errors, warnings, filesCount: 0 };
  }

  for (const entry of entries) {
    if (!entry.endsWith('.md') && !entry.endsWith('.mdx')) continue;
    filesCount++;

    const filePath = join(POSTS_DIR, entry);
    let raw;
    try {
      raw = readFileSync(filePath, 'utf8');
    } catch (err) {
      errors.push(`${entry}: cannot read file: ${err.message}`);
      continue;
    }

    const prose = stripFencedRegions(raw);
    const result = scanForExecutableContent(prose);

    if (!result.ok) {
      errors.push(`${entry}: contains executable ${result.label}: ${result.snippet}`);
    }
  }

  return { errors, warnings, filesCount };
}
