import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for the social-distribution build manifest
 * (`src/pages/social-manifest.json.ts`, plan social-distribution §7/§8).
 *
 * `buildProvenance` is pure (env in, object|null out). `buildSocialManifest`
 * depends on the permalink helpers, mocked here so the test exercises only
 * the manifest's own logic: `normalizeSocial`, canonical validation, the
 * fail-closed duplicate-id / duplicate-canonical guards, and the
 * deterministic ordering.
 */

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));

vi.mock('~/utils/blog', () => ({
  // The slug is just the collection id in these tests.
  resolvePostPermalink: vi.fn(async (entry: { id: string }) => entry.id),
}));

vi.mock('~/utils/permalinks', () => ({
  getPermalink: vi.fn((slug = '') => `/${slug}`),
  getCanonical: vi.fn((path = '') => `https://noticiencias.com${path}/`),
}));

import {
  buildProvenance,
  buildSocialManifest,
  type SocialManifestArticle,
} from '../../src/pages/social-manifest.json';

type Entry = {
  id: string;
  data: {
    title: string;
    date: Date;
    excerpt?: string;
    social?: { publish: boolean; id?: string };
  };
};

function entry(id: string, over: Partial<Entry['data']> = {}): Entry {
  return {
    id,
    data: { title: `Title ${id}`, date: new Date('2026-01-02T00:00:00Z'), ...over },
  };
}

const DEPLOY_ENV = {
  GITHUB_WORKFLOW: 'Deploy to GitHub Pages',
  GITHUB_REPOSITORY: 'cortega26/noticiencias',
  GITHUB_SHA: 'a'.repeat(40),
  GITHUB_RUN_ID: '123456',
  GITHUB_RUN_ATTEMPT: '1',
};

describe('buildProvenance', () => {
  it('returns null outside the Deploy to GitHub Pages workflow', () => {
    expect(buildProvenance({})).toBeNull();
    expect(buildProvenance({ ...DEPLOY_ENV, GITHUB_WORKFLOW: 'CI' })).toBeNull();
  });

  it('returns the provenance object when every field is well-formed', () => {
    expect(buildProvenance(DEPLOY_ENV)).toEqual({
      repository: 'cortega26/noticiencias',
      commit: 'a'.repeat(40),
      run_id: '123456',
      build_attempt: 1,
      workflow: 'Deploy to GitHub Pages',
    });
  });

  it.each([
    ['repository', { GITHUB_REPOSITORY: 'not-a-repo' }],
    ['commit', { GITHUB_SHA: 'zzz' }],
    ['run_id', { GITHUB_RUN_ID: 'abc' }],
    ['build_attempt', { GITHUB_RUN_ATTEMPT: '0' }],
    ['build_attempt', { GITHUB_RUN_ATTEMPT: '' }],
  ])('returns null when %s is malformed', (_label, override) => {
    expect(buildProvenance({ ...DEPLOY_ENV, ...override })).toBeNull();
  });
});

describe('buildSocialManifest', () => {
  it('normalizes social: absent → {publish:false}, keeps a valid opt-in', async () => {
    const manifest = await buildSocialManifest(
      [
        entry('no-social'),
        entry('opt-in', { social: { publish: true, id: 'b'.repeat(64) } }),
        entry('disabled', { social: { publish: false } }),
      ] as never,
      {}
    );
    function socialOf(id: string): SocialManifestArticle['social'] {
      const article = manifest.articles.find((a) => a.collection_id === id);
      expect(article, `article ${id} in manifest`).toBeDefined();
      return (article as SocialManifestArticle).social;
    }
    expect(socialOf('no-social')).toEqual({ publish: false });
    expect(socialOf('opt-in')).toEqual({ publish: true, id: 'b'.repeat(64) });
    expect(socialOf('disabled')).toEqual({ publish: false });
  });

  it('carries schema_version 1, provenance, canonical URL and description', async () => {
    const manifest = await buildSocialManifest(
      [entry('a', { excerpt: 'An excerpt' }), entry('b')] as never,
      DEPLOY_ENV
    );
    expect(manifest.schema_version).toBe(1);
    expect(manifest.provenance).not.toBeNull();
    const [a, b] = manifest.articles;
    expect(a.collection_id).toBe('a');
    expect(a.canonical_url).toBe('https://noticiencias.com/a/');
    expect(a.description).toBe('An excerpt');
    expect(b.collection_id).toBe('b');
    expect(b.description).toBeUndefined();
  });

  it('orders by social.id then collection id, deterministically', async () => {
    const manifest = await buildSocialManifest(
      [
        entry('z', { social: { publish: true, id: '1'.repeat(64) } }),
        entry('a'),
        entry('m', { social: { publish: true, id: '0'.repeat(64) } }),
        entry('b'),
      ] as never,
      {}
    );
    // Articles with no id sort first (key ''), then by ascending hex id.
    expect(manifest.articles.map((a) => a.collection_id)).toEqual(['a', 'b', 'm', 'z']);
  });

  it('fails closed on a duplicate social.id, even between disabled articles', async () => {
    await expect(
      buildSocialManifest(
        [
          entry('one', { social: { publish: true, id: 'c'.repeat(64) } }),
          entry('two', { social: { publish: false, id: 'c'.repeat(64) } }),
        ] as never,
        {}
      )
    ).rejects.toThrow(/duplicate social\.id/);
  });

  it('rejects an off-domain or non-https canonical URL', async () => {
    const { getCanonical } = await import('~/utils/permalinks');
    vi.mocked(getCanonical).mockReturnValueOnce('https://evil.example/x/');
    await expect(buildSocialManifest([entry('x')] as never, {})).rejects.toThrow(/off-domain/);
  });

  it('rejects a canonical URL carrying a query string or fragment', async () => {
    const { getCanonical } = await import('~/utils/permalinks');
    vi.mocked(getCanonical).mockReturnValueOnce('https://noticiencias.com/x/?utm=1');
    await expect(buildSocialManifest([entry('x')] as never, {})).rejects.toThrow(
      /query string or a fragment/
    );
  });
});
