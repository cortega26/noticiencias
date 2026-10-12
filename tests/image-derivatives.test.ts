import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  getDerivativeSourceKey,
  hasPublishedDerivativeUrls,
  resolveDerivativeVariants,
  resolveDerivativeWidths,
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

const fixtureEntry: ImageDerivativeEntry = {
  originalWidth: 1600,
  originalHeight: 900,
  hash: 'fixture-hash',
  variants: [
    {
      width: 400,
      height: 225,
      format: 'avif',
      objectKey: 'posts/uno/400.avif',
      url: 'https://cdn.example/posts/uno/400.avif',
    },
    {
      width: 900,
      height: 506,
      format: 'avif',
      objectKey: 'posts/uno/900.avif',
      url: null,
    },
    {
      width: 1400,
      height: 788,
      format: 'avif',
      objectKey: 'posts/uno/1400.avif',
      url: 'https://cdn.example/posts/uno/1400.avif',
    },
  ],
};

describe('image derivative manifest loading (temp-dir fixtures)', () => {
  let repoCwd = '';
  let tmpDir = '';

  beforeEach(() => {
    repoCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noti-derivatives-'));
  });

  afterEach(() => {
    process.chdir(repoCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  async function freshDerivatives() {
    vi.resetModules();
    process.chdir(tmpDir);
    return import('../src/utils/image-derivatives');
  }

  function writeManifest(manifest: unknown) {
    fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'data', 'image-derivatives-manifest.json'),
      JSON.stringify(manifest),
      'utf8'
    );
  }

  function writeDeliveryMode(mode: string) {
    fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'data', 'image-delivery-mode.json'),
      JSON.stringify({ mode }),
      'utf8'
    );
  }

  it('returns an empty manifest when the file is missing', async () => {
    const derivatives = await freshDerivatives();
    expect(derivatives.loadImageDerivativeManifest()).toEqual({});
    expect(derivatives.getImageDerivativeEntry('posts/uno')).toBeNull();
  });

  it('loads entries from a fixture manifest and misses unknown keys', async () => {
    writeManifest({ 'posts/uno': fixtureEntry });
    const derivatives = await freshDerivatives();
    expect(derivatives.loadImageDerivativeManifest()).toEqual({ 'posts/uno': fixtureEntry });
    expect(derivatives.getImageDerivativeEntry('posts/uno')).toEqual(fixtureEntry);
    expect(derivatives.getImageDerivativeEntry('posts/otro')).toBeNull();
    expect(derivatives.getImageDerivativeEntry(null)).toBeNull();
  });

  it('enables strict mode in r2 delivery and disables it in github delivery', async () => {
    writeManifest({});
    writeDeliveryMode('r2');
    expect((await freshDerivatives()).isStrictDerivativeModeEnabled()).toBe(true);

    writeDeliveryMode('github');
    expect((await freshDerivatives()).isStrictDerivativeModeEnabled()).toBe(false);
  });

  it('defaults strict mode on when no delivery-mode config exists', async () => {
    const derivatives = await freshDerivatives();
    expect(derivatives.isStrictDerivativeModeEnabled()).toBe(true);
  });
});

describe('image derivative variant resolution edge branches', () => {
  it('returns [] for null entries and entries without published urls', () => {
    expect(resolveDerivativeVariants(null, [400])).toEqual([]);
    expect(resolveDerivativeWidths(null, [400])).toEqual([]);
    expect(
      resolveDerivativeVariants(
        { ...fixtureEntry, variants: fixtureEntry.variants.map((v) => ({ ...v, url: null })) },
        [1400]
      )
    ).toEqual([]);
  });

  it('returns url-bearing variants sorted when no breakpoints are requested', () => {
    expect(resolveDerivativeVariants(fixtureEntry, []).map((v) => v.width)).toEqual([400, 1400]);
    expect(resolveDerivativeWidths(fixtureEntry, [])).toEqual([400, 900, 1400]);
  });

  it('falls back to every variant when breakpoints exclude all widths', () => {
    expect(resolveDerivativeWidths(fixtureEntry, [200])).toEqual([400, 900, 1400]);
  });

  it('selects null for empty input, largest without a target, largest past the max', () => {
    expect(selectPreferredVariantSrc([], 900)).toBeNull();
    const variants = [
      { src: 'https://cdn.example/400.avif', width: 400 },
      { src: 'https://cdn.example/1400.avif', width: 1400 },
    ];
    expect(selectPreferredVariantSrc(variants)).toBe('https://cdn.example/1400.avif');
    expect(selectPreferredVariantSrc(variants, 5000)).toBe('https://cdn.example/1400.avif');
  });

  it('extracts the derivative source key only from marked images', () => {
    expect(getDerivativeSourceKey({ __notiSourceKey: 'posts/uno' })).toBe('posts/uno');
    expect(getDerivativeSourceKey({})).toBeNull();
    expect(getDerivativeSourceKey(null)).toBeNull();
    expect(getDerivativeSourceKey('posts/uno')).toBeNull();
    expect(getDerivativeSourceKey({ __notiSourceKey: 42 })).toBeNull();
  });

  it('rejects null and variant-less entries as unpublished', () => {
    expect(hasPublishedDerivativeUrls(null)).toBe(false);
    expect(hasPublishedDerivativeUrls({ ...fixtureEntry, variants: [] })).toBe(false);
  });
});
