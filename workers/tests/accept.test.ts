import { describe, it, expect } from 'vitest';
import { prefersMarkdown } from '../src/utils/accept';

describe('prefersMarkdown (RFC 9110 Accept negotiation)', () => {
  it('returns false for a missing Accept header', () => {
    expect(prefersMarkdown(null)).toBe(false);
  });

  it('returns false for an empty Accept header', () => {
    expect(prefersMarkdown('')).toBe(false);
  });

  it('returns false for a bare */* — no explicit preference for markdown', () => {
    expect(prefersMarkdown('*/*')).toBe(false);
  });

  it('returns false for an ordinary browser Accept header', () => {
    expect(
      prefersMarkdown(
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      )
    ).toBe(false);
  });

  it('returns true for a bare text/markdown request', () => {
    expect(prefersMarkdown('text/markdown')).toBe(true);
  });

  it('returns true when markdown outweighs html', () => {
    expect(prefersMarkdown('text/markdown, text/html;q=0.9')).toBe(true);
  });

  it('returns false when html outweighs markdown', () => {
    expect(prefersMarkdown('text/html, text/markdown;q=0.5')).toBe(false);
  });

  it('returns true on an exact q-value tie between markdown and html', () => {
    expect(prefersMarkdown('text/markdown;q=0.8, text/html;q=0.8')).toBe(true);
  });

  it('does not use a substring match on unrelated types', () => {
    // "application/vnd.text/markdown-ish" would match a naive .includes() check
    expect(prefersMarkdown('application/vnd.text/markdown-ish')).toBe(false);
  });

  it('ignores an explicitly zero-weighted markdown entry', () => {
    expect(prefersMarkdown('text/markdown;q=0, text/html')).toBe(false);
  });

  it('treats a malformed q-value as the default weight of 1', () => {
    expect(prefersMarkdown('text/markdown;q=not-a-number')).toBe(true);
  });

  it('is case-insensitive on the media type', () => {
    expect(prefersMarkdown('Text/Markdown')).toBe(true);
  });

  it('honors an explicit text/* wildcard as preferring markdown over a generic fallback', () => {
    expect(prefersMarkdown('text/*, */*;q=0.5')).toBe(true);
  });

  it('tolerates a trailing comma / empty segment', () => {
    expect(prefersMarkdown('text/markdown,')).toBe(true);
  });

  it('ignores a malformed entry with no slash', () => {
    expect(prefersMarkdown('not-a-media-type, text/markdown')).toBe(true);
  });

  it('handles multiple accept-params, using only q', () => {
    expect(prefersMarkdown('text/markdown;charset=utf-8;q=0.9, text/html;q=0.1')).toBe(true);
  });
});
