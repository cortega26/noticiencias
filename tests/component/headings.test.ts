/**
 * Unit tests for heading structure utilities.
 * Tests heading ordering validation used in content quality checks.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Inline the heading validation logic from scripts/utils/content-quality.js
// for unit testing without importing the full module (which depends on gray-matter, glob, etc.)
// ---------------------------------------------------------------------------

const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*\S)\s*$/;

interface HeadingInfo {
  level: number;
  text: string;
  line: number;
}

function extractHeadings(markdownBody: string): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  const lines = markdownBody.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(HEADING_RE);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2],
        line: i + 1,
      });
    }
  }

  return headings;
}

interface HeadingValidationResult {
  valid: boolean;
  errors: string[];
}

function validateHeadingStructure(headings: HeadingInfo[]): HeadingValidationResult {
  const errors: string[] = [];

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];

    // First heading must be H2 (no H1 in body)
    if (i === 0 && h.level === 1) {
      errors.push(`Line ${h.line}: Body must not contain H1 — start with H2`);
    }

    // Check heading descent: can only go down 1 level at a time
    if (i > 0) {
      const prev = headings[i - 1];
      if (h.level > prev.level + 1) {
        errors.push(
          `Line ${h.line}: Heading jumps from H${prev.level} to H${h.level} — must descend one level at a time`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractHeadings', () => {
  it('extracts headings from markdown', () => {
    const md = [
      '## Introduction',
      'Some text here.',
      '### Details',
      'More text.',
      '## Another section',
    ].join('\n');

    const headings = extractHeadings(md);
    expect(headings).toHaveLength(3);
    expect(headings[0]).toEqual({ level: 2, text: 'Introduction', line: 1 });
    expect(headings[1]).toEqual({ level: 3, text: 'Details', line: 3 });
    expect(headings[2]).toEqual({ level: 2, text: 'Another section', line: 5 });
  });

  it('returns empty array for text without headings', () => {
    const md = 'Just some paragraph text.\nNo headings here.';
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(0);
  });

  it('handles headings with leading whitespace', () => {
    const md = '  ## Indented heading';
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(1);
    expect(headings[0].level).toBe(2);
  });

  it('ignores closing hashes (not headings)', () => {
    const md = 'This is ## not a heading ## here';
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(0);
  });

  it('detects all heading levels', () => {
    const md = ['## H2', '### H3', '#### H4', '##### H5', '###### H6'].join('\n');
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(5);
    expect(headings.map((h) => h.level)).toEqual([2, 3, 4, 5, 6]);
  });
});

describe('validateHeadingStructure', () => {
  it('accepts proper H2 → H3 → H2 structure', () => {
    const headings: HeadingInfo[] = [
      { level: 2, text: 'Intro', line: 1 },
      { level: 3, text: 'Detail', line: 3 },
      { level: 2, text: 'Another', line: 5 },
    ];
    const result = validateHeadingStructure(headings);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts flat H2 structure', () => {
    const headings: HeadingInfo[] = [
      { level: 2, text: 'A', line: 1 },
      { level: 2, text: 'B', line: 3 },
    ];
    const result = validateHeadingStructure(headings);
    expect(result.valid).toBe(true);
  });

  it('rejects H1 in body', () => {
    const headings: HeadingInfo[] = [{ level: 1, text: 'Title', line: 1 }];
    const result = validateHeadingStructure(headings);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('H1'))).toBe(true);
  });

  it('rejects H2 → H4 skip', () => {
    const headings: HeadingInfo[] = [
      { level: 2, text: 'Intro', line: 1 },
      { level: 4, text: 'Deep detail', line: 3 },
    ];
    const result = validateHeadingStructure(headings);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('H2 to H4'))).toBe(true);
  });

  it('accepts H2 → H3 → H4 descent', () => {
    const headings: HeadingInfo[] = [
      { level: 2, text: 'A', line: 1 },
      { level: 3, text: 'B', line: 3 },
      { level: 4, text: 'C', line: 5 },
    ];
    const result = validateHeadingStructure(headings);
    expect(result.valid).toBe(true);
  });

  it('rejects multiple H1 headings', () => {
    const headings: HeadingInfo[] = [
      { level: 1, text: 'First', line: 1 },
      { level: 2, text: 'Middle', line: 3 },
      { level: 1, text: 'Second', line: 5 },
    ];
    const result = validateHeadingStructure(headings);
    expect(result.valid).toBe(false);
  });
});
