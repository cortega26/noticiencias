import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';
import { globSync } from 'glob';

export const MIN_CONTENT_QUALITY_WORDS = 80;
export const BLOCKED_CONTENT_PATTERNS = [
  {
    id: 'placeholder-language',
    pattern:
      /ilegible\s+y\s+corrupt|impidiendo\s+la\s+elaboraci[oó]n\s+de\s+un\s+texto|no\s+se\s+pudo\s+(?:elaborar|construir|redactar)\s+un\s+art[ií]culo/i,
  },
  {
    id: 'unreadable-source',
    pattern:
      /source\s+(?:was|is)\s+unreadable|content\s+provided\s+for\s+this\s+article\s+is\s+unreadable/i,
  },
];

const WORD_RE = /\b[\p{L}\p{N}'-]+\b/gu;

function normalizeBody(body) {
  return body
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^\s*Fuente original:\s*\[[^\]]+\]\([^)]+\)\s*$/gim, ' ')
    .trim();
}

function extractNarrativeText(body) {
  const cleaned = normalizeBody(body);
  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .filter((line) => !line.startsWith('>'))
    .map((line) => line.replace(/^([-*+]|\d+\.)\s+/, '').trim())
    .filter(Boolean);

  return lines.join(' ');
}

function countNarrativeBlocks(body) {
  return normalizeBody(body)
    .split(/\n\s*\n/g)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !line.startsWith('#'))
        .filter((line) => !line.startsWith('>'))
        .join(' ')
        .trim()
    )
    .filter(Boolean).length;
}

function countWords(text) {
  return text.match(WORD_RE)?.length ?? 0;
}

export function collectContentQualityDiagnostics({
  repoRoot = process.cwd(),
  postsGlob = 'src/content/posts/*.md',
} = {}) {
  const files = globSync(postsGlob, {
    cwd: repoRoot,
    nodir: true,
    windowsPathsNoEscape: true,
  }).sort();

  const errors = [];

  for (const relativePath of files) {
    const absolutePath = path.join(repoRoot, relativePath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = matter(raw);
    const normalizedBody = normalizeBody(parsed.content);
    const narrativeText = extractNarrativeText(parsed.content);
    const wordCount = countWords(narrativeText);
    const blockCount = countNarrativeBlocks(parsed.content);

    for (const { id, pattern } of BLOCKED_CONTENT_PATTERNS) {
      if (pattern.test(normalizedBody)) {
        errors.push(`${relativePath}: blocked content-quality pattern detected (${id})`);
      }
    }

    if (wordCount < MIN_CONTENT_QUALITY_WORDS && blockCount <= 2) {
      errors.push(
        `${relativePath}: article body is too thin for publication (${wordCount} < ${MIN_CONTENT_QUALITY_WORDS} words)`
      );
    }
  }

  return {
    filesCount: files.length,
    errors,
  };
}
