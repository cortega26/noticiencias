import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';
import { globSync } from 'glob';

export const MIN_CONTENT_QUALITY_WORDS = 80;
export const MIN_TITLE_LENGTH = 20;
export const MAX_TITLE_LENGTH = 140;
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
export const BLOCKED_IMAGE_ALT_PATTERNS = [
  {
    id: 'generic-editorial-alt',
    pattern: /^imagen editorial de\b/i,
  },
];

const WORD_RE = /\b[\p{L}\p{N}'-]+\b/gu;
const FENCE_DELIMITER_RE = /^\s*(```+|~~~+)/;
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*\S)\s*$/;

function stripFencedCodeBlocks(body) {
  const lines = body.split('\n');
  const strippedLines = [];
  let activeFence = null;

  for (const line of lines) {
    const fenceMatch = line.match(FENCE_DELIMITER_RE);
    if (fenceMatch) {
      const fenceToken = fenceMatch[1];
      const fenceChar = fenceToken[0];
      if (!activeFence) {
        activeFence = fenceChar;
      } else if (activeFence === fenceChar) {
        activeFence = null;
      }
      continue;
    }

    if (!activeFence) {
      strippedLines.push(line);
    }
  }

  return strippedLines.join('\n');
}

function normalizeBody(body) {
  return stripFencedCodeBlocks(body)
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

function isValidHttpUrl(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getImageAlt(data) {
  if (typeof data.image_alt === 'string') {
    return data.image_alt;
  }

  if (data.image && typeof data.image === 'object' && typeof data.image.alt === 'string') {
    return data.image.alt;
  }

  return '';
}

function collectFrontmatterDiagnostics(data) {
  const diagnostics = [];
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const categories = Array.isArray(data.categories) ? data.categories.filter(Boolean) : [];
  const tags = Array.isArray(data.tags) ? data.tags.filter(Boolean) : [];
  const imageAlt = getImageAlt(data).trim();

  if (title.length < MIN_TITLE_LENGTH || title.length > MAX_TITLE_LENGTH) {
    diagnostics.push(
      `title length must be between ${MIN_TITLE_LENGTH} and ${MAX_TITLE_LENGTH} characters`
    );
  }

  if (categories.length !== 1 || typeof categories[0] !== 'string') {
    diagnostics.push('categories must contain exactly one primary editorial category');
  }

  if (tags.length === 0 || tags.some((tag) => typeof tag !== 'string' || tag.trim() === '')) {
    diagnostics.push('tags must contain at least one non-empty editorial tag');
  }

  if (!isValidHttpUrl(data.source_url)) {
    diagnostics.push('source_url must be an absolute http(s) URL');
  }

  if (!imageAlt) {
    diagnostics.push('image_alt or image.alt must be present');
  }

  if (data.featured === true && !Number.isInteger(data.featured_rank)) {
    diagnostics.push('featured_rank must be a positive integer when featured is true');
  }

  if (
    Array.isArray(data.summary_points) &&
    (data.summary_points.length < 2 ||
      data.summary_points.length > 5 ||
      data.summary_points.some((item) => typeof item !== 'string' || item.trim() === ''))
  ) {
    diagnostics.push('summary_points must contain 2 to 5 non-empty items when present');
  }

  if (
    Array.isArray(data.glossary) &&
    data.glossary.some(
      (item) =>
        !item ||
        typeof item.term !== 'string' ||
        item.term.trim() === '' ||
        typeof item.definition !== 'string' ||
        item.definition.trim() === ''
    )
  ) {
    diagnostics.push('glossary entries must include non-empty term and definition');
  }

  if (
    Array.isArray(data.sources) &&
    data.sources.some((source) => !source || !isValidHttpUrl(source.url))
  ) {
    diagnostics.push('sources must use absolute http(s) URLs');
  }

  for (const { id, pattern } of BLOCKED_IMAGE_ALT_PATTERNS) {
    if (pattern.test(imageAlt)) {
      diagnostics.push(`blocked image_alt pattern detected (${id})`);
    }
  }

  return diagnostics;
}

function collectHeadingStructureDiagnostics(body) {
  const diagnostics = [];
  const lines = normalizeBody(body).split('\n');
  let previousLevel = 1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const headingMatch = line.match(HEADING_RE);
    if (!headingMatch) continue;

    const level = headingMatch[1].length;
    const headingText = headingMatch[2].trim();
    const lineNumber = index + 1;

    if (level === 1) {
      diagnostics.push(
        `article body heading must not use H1 at line ${lineNumber} ("${headingText}")`
      );
    } else if (level > previousLevel + 1) {
      diagnostics.push(
        `article body heading skips from H${previousLevel} to H${level} at line ${lineNumber} ("${headingText}")`
      );
    }

    previousLevel = level;
  }

  return diagnostics;
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

    for (const diagnostic of collectFrontmatterDiagnostics(parsed.data)) {
      errors.push(`${relativePath}: ${diagnostic}`);
    }

    for (const { id, pattern } of BLOCKED_CONTENT_PATTERNS) {
      if (pattern.test(normalizedBody)) {
        errors.push(`${relativePath}: blocked content-quality pattern detected (${id})`);
      }
    }

    for (const diagnostic of collectHeadingStructureDiagnostics(parsed.content)) {
      errors.push(`${relativePath}: ${diagnostic}`);
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
