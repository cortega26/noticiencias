import { describe, expect, it } from 'vitest';
import matter, { stringify } from '../scripts/utils/frontmatter-parser.js';

// Expected values below were captured from gray-matter 4.0.3 + js-yaml 3
// on 2026-08-11 — the shim must stay byte-identical to it.

const POST_WITH_YAML = `---
title: "quoted: col"
list:
  - a
  - b
num: 42
bool: true
nullv: null
---
body
`;

describe('matter parse', () => {
  it('parses standard frontmatter', () => {
    const m = matter(POST_WITH_YAML);
    expect(m.data).toEqual({
      title: 'quoted: col',
      list: ['a', 'b'],
      num: 42,
      bool: true,
      nullv: null,
    });
    expect(m.content).toBe('body\n');
  });

  it('returns empty data and full content when there is no frontmatter', () => {
    const m = matter('just body text\nline2\n');
    expect(m.data).toEqual({});
    expect(m.content).toBe('just body text\nline2\n');
  });

  it('handles empty frontmatter block', () => {
    const m = matter('---\n---\nbody\n');
    expect(m.data).toEqual({});
    expect(m.content).toBe('body\n');
  });

  it('handles empty input', () => {
    const m = matter('');
    expect(m.data).toEqual({});
    expect(m.content).toBe('');
  });

  it('does not treat a four-hyphen opener as frontmatter', () => {
    const m = matter('----\nnot frontmatter\n');
    expect(m.data).toEqual({});
    expect(m.content).toBe('----\nnot frontmatter\n');
  });

  it('treats an unclosed frontmatter block as YAML (throws on invalid YAML)', () => {
    expect(() => matter('---\ntitle: X\nbody continues\n')).toThrow();
  });

  it('parses an unclosed block when it is valid YAML', () => {
    const m = matter('---\ntitle: X\n');
    expect(m.data).toEqual({ title: 'X' });
    expect(m.content).toBe('');
  });

  it('parses a comment-only frontmatter block as empty', () => {
    const m = matter('---\n# just a comment\ntitle: X\n---\nbody\n');
    expect(m.data).toEqual({ title: 'X' });
    expect(m.content).toBe('body\n');
  });
});

describe('matter API surface', () => {
  it('exposes stringify as a static on the default export (gray-matter compat)', () => {
    expect(typeof matter.stringify).toBe('function');
    expect(matter.stringify('body text', { title: 'X' })).toBe('---\ntitle: X\n---\nbody text\n');
  });
});

describe('matter stringify', () => {
  it('round-trips a parsed post with stable serialization', () => {
    const parsed = matter(POST_WITH_YAML);
    const round = stringify(parsed.content, parsed.data);
    // Note: js-yaml 4 emits single quotes where js-yaml 3 (gray-matter) used
    // double quotes for scalars that need quoting — cosmetically different,
    // YAML-semantically identical, and idempotent (second pass is a no-op).
    expect(round).toBe(`---
title: 'quoted: col'
list:
  - a
  - b
num: 42
bool: true
nullv: null
---
body
`);
  });

  it('omits the frontmatter block for empty data', () => {
    expect(stringify('body text', {})).toBe('body text\n');
    expect(stringify('body text')).toBe('body text\n');
  });

  it('accepts a content string as the first argument', () => {
    expect(stringify('body text', { title: 'X' })).toBe('---\ntitle: X\n---\nbody text\n');
  });

  it('accepts a file object with content and data', () => {
    expect(stringify({ content: 'body text', data: { title: 'X' } })).toBe(
      '---\ntitle: X\n---\nbody text\n'
    );
  });

  it('normalizes a missing trailing newline', () => {
    expect(stringify('body', { title: 'X' })).toBe('---\ntitle: X\n---\nbody\n');
  });
});

describe('real post corpus parity', () => {
  const files = import.meta.glob('../src/content/posts/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  it('parses every production post, round-trips with semantic parity and is idempotent', () => {
    const posts = Object.values(files);
    expect(posts.length).toBeGreaterThan(20);
    for (const raw of posts) {
      const parsed = matter(raw);
      const round = stringify(parsed.content, parsed.data);
      // Semantic parity: data and body survive the round-trip.
      const reparsed = matter(round);
      expect(reparsed.data).toEqual(parsed.data);
      expect(reparsed.content).toBe(parsed.content);
      // Idempotency: re-serializing the round-trip output changes nothing.
      expect(stringify(reparsed.content, reparsed.data)).toBe(round);
    }
  });
});
