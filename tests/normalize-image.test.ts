import { describe, expect, it } from 'vitest';
import { normalizeImage } from '../src/utils/normalizeImage';

describe('normalizeImage', () => {
  it('returns null for falsy input', () => {
    expect(normalizeImage(null)).toBeNull();
    expect(normalizeImage(undefined)).toBeNull();
    expect(normalizeImage('')).toBeNull();
  });

  it('classifies a remote URL string as remote', () => {
    expect(normalizeImage('https://example.com/img.jpg')).toEqual({
      src: 'https://example.com/img.jpg',
      alt: '',
      kind: 'remote',
    });
  });

  it('classifies a project-alias string as local', () => {
    expect(normalizeImage('~/assets/hero.jpg')).toMatchObject({ kind: 'local' });
  });

  it('classifies a root-relative string as local', () => {
    expect(normalizeImage('/images/hero.jpg')).toMatchObject({ kind: 'local' });
  });

  it('classifies a protocol-relative string ("//host/img.jpg") as remote', () => {
    expect(normalizeImage('//example.com/img.jpg')).toMatchObject({ kind: 'remote' });
  });

  it('passes through an already-normalized object unchanged', () => {
    const already = { src: 'a.jpg', alt: 'A', kind: 'local' as const };
    expect(normalizeImage(already)).toBe(already);
  });

  it('normalizes an Astro ImageMetadata-shaped object as local', () => {
    const result = normalizeImage({ src: 'a.jpg', width: 100, height: 50, format: 'jpg' });
    expect(result).toEqual({ src: 'a.jpg', alt: '', width: 100, height: 50, kind: 'local' });
  });

  it('normalizes a backend object wrapper missing height, coercing width to a number', () => {
    // Only `src` + `width` (no `height`) so this doesn't match the Astro
    // ImageMetadata branch, which requires all three and ignores `alt`.
    const result = normalizeImage({ src: '/a.jpg', alt: 'Desc', width: '100' });
    expect(result).toEqual({ src: '/a.jpg', alt: 'Desc', width: 100, kind: 'local' });
  });

  it('defaults an object with only a remote src to kind remote', () => {
    const result = normalizeImage({ src: 'https://example.com/a.jpg' });
    expect(result).toMatchObject({ kind: 'remote' });
  });
});
