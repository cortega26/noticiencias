import { describe, expect, it } from 'vitest';

import {
  hasPublishedDerivativeUrls,
  resolveDerivativeVariants,
  selectPreferredVariantSrc,
  type ImageDerivativeEntry,
} from '../src/utils/image-derivatives';

describe('Image derivative helpers', () => {
  const entry: ImageDerivativeEntry = {
    originalWidth: 1600,
    originalHeight: 900,
    hash: 'abc123',
    variants: [
      {
        width: 400,
        height: 225,
        format: 'avif',
        objectKey: 'a',
        url: 'https://cdn.example/400.avif',
      },
      {
        width: 900,
        height: 506,
        format: 'avif',
        objectKey: 'b',
        url: 'https://cdn.example/900.avif',
      },
      {
        width: 1400,
        height: 788,
        format: 'avif',
        objectKey: 'c',
        url: 'https://cdn.example/1400.avif',
      },
    ],
  };

  it('returns only variants up to the requested max width', () => {
    expect(resolveDerivativeVariants(entry, [400, 900]).map((variant) => variant.width)).toEqual([
      400, 900,
    ]);
  });

  it('falls back to all variants when breakpoints are smaller than the smallest asset', () => {
    expect(resolveDerivativeVariants(entry, [200]).map((variant) => variant.width)).toEqual([
      400, 900, 1400,
    ]);
  });

  it('selects the closest preferred src for the requested width', () => {
    expect(
      selectPreferredVariantSrc(
        [
          { src: 'https://cdn.example/400.avif', width: 400 },
          { src: 'https://cdn.example/900.avif', width: 900 },
          { src: 'https://cdn.example/1400.avif', width: 1400 },
        ],
        850
      )
    ).toBe('https://cdn.example/900.avif');
  });

  it('detects when a manifest entry has published derivative URLs', () => {
    expect(hasPublishedDerivativeUrls(entry)).toBe(true);
    expect(
      hasPublishedDerivativeUrls({
        ...entry,
        variants: entry.variants.map((variant) => ({ ...variant, url: null })),
      })
    ).toBe(false);
  });
});
