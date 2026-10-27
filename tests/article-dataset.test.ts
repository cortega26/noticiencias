import { describe, expect, it } from 'vitest';
import {
  addWindows,
  buildEditorialRows,
  headlineFeatures,
  toCsv,
} from '../scripts/analytics/article-dataset.mjs';

const post = (slug: string, date: string, data: Record<string, unknown> = {}) => ({
  slug,
  published: new Date(date),
  content: 'uno dos tres [cuatro](https://x.org)',
  data: { title: '¿Qué pasa con 3 nubes?', categories: ['Ciencia'], ...data },
});

describe('article dataset (#233, #234)', () => {
  it('extracts headline features', () => {
    expect(headlineFeatures('¿Qué pasa con 3 nubes?')).toMatchObject({
      title_is_question: true,
      title_has_number: true,
      title_words: 5,
    });
  });

  it('counts prior cadence and words, sorted by date', () => {
    const rows = buildEditorialRows([
      post('b', '2026-10-02T10:00:00Z'),
      post('a', '2026-10-01T12:00:00Z'),
      post('c', '2026-10-09T09:00:00Z'),
    ]);
    expect(rows.map((r) => r.slug)).toEqual(['a', 'b', 'c']);
    expect(rows[1]).toMatchObject({ posts_prev_24h: 1, posts_prev_7d: 1, word_count: 4 });
    expect(rows[2]).toMatchObject({ posts_prev_24h: 0, posts_prev_7d: 1 });
  });

  it('sums Search Console metrics inside each window after publication', () => {
    const rows = buildEditorialRows([post('a', '2026-10-01T12:00:00Z')]);
    addWindows(
      rows,
      [
        { slug: 'a', date: '2026-10-01', clicks: 2, impressions: 10 },
        { slug: 'a', date: '2026-10-05', clicks: 1, impressions: 30 },
        { slug: 'a', date: '2026-11-15', clicks: 9, impressions: 90 },
        { slug: 'other', date: '2026-10-01', clicks: 5, impressions: 5 },
      ],
      'discover'
    );
    expect(rows[0]).toMatchObject({
      discover_impressions_1d: 10,
      discover_clicks_7d: 3,
      discover_impressions_28d: 40,
      discover_ctr_7d: 0.075,
    });
  });

  it('quotes CSV cells that need it', () => {
    expect(toCsv([{ a: 'x,y', b: 'di "hola"' }])).toBe('a,b\n"x,y","di ""hola"""');
  });
});
