import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import matter from '../scripts/utils/frontmatter-parser.js';

const articlePath = path.resolve(
  __dirname,
  '..',
  'src',
  'content',
  'posts',
  '2026-09-21-senal-de-radio-de-un-exoplaneta-revela-posible-aurora.md'
);

describe('article 2955 MeerKAT correction', () => {
  const raw = fs.readFileSync(articlePath, 'utf8');
  const parsed = matter(raw);
  const { content } = parsed;
  const data = parsed.data as Record<string, unknown>;

  it('keeps the obsolete instrument only in correction metadata and uses MeerKAT in the article', () => {
    const { correction_summary: _correctionSummary, ...articleMetadata } = data;

    expect(String(data.correction_summary)).toMatch(/VLA.*MeerKAT/s);
    expect(content).not.toMatch(/\b(?:VLA|Very Large Array)\b/i);
    expect(JSON.stringify(articleMetadata)).not.toMatch(/\b(?:VLA|Very Large Array)\b/i);
    expect(JSON.stringify(articleMetadata)).toMatch(/MeerKAT/i);
    expect(content).not.toMatch(/Emily Conover/i);
    expect(data.author).toBe('Redacción de Noticiencias');
  });

  it('retains the original publication date and identifies the study as a preprint', () => {
    expect(raw).toMatch(/^date: 2026-09-21$/m);
    expect(data.publication_status).toBe('preprint');
    expect(data.corrected_at).toBe('2026-10-10');
    expect(data.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://arxiv.org/abs/2609.16720',
          role: 'primary',
        }),
      ])
    );
  });
});
