import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: vi.fn(async () => []),
  render: vi.fn(),
}));

vi.mock('astrowind:config', () => ({
  SITE: {
    name: 'Noticiencias',
    site: 'https://noticiencias.com',
    base: '/',
    trailingSlash: true,
  },
  I18N: { language: 'es', textDirection: 'ltr' },
  METADATA: {},
  APP_BLOG: {
    isEnabled: true,
    isRelatedPostsEnabled: true,
    postsPerPage: 6,
    list: { isEnabled: true, robots: {}, pathname: 'blog' },
    post: { isEnabled: true, robots: {}, permalink: '/%category%/%slug%' },
    category: { isEnabled: true, robots: {}, pathname: 'categorias' },
    tag: { isEnabled: true, robots: {}, pathname: 'temas' },
  },
}));

import { buildSocialManifest, buildProvenance } from '../../src/pages/social-manifest.json';

type Entry = {
  id: string;
  data: {
    title: string;
    excerpt?: string;
    date: Date;
    permalink?: string;
    categories?: string[];
    social?: { publish: boolean; id?: string };
  };
};

const HEX_A = 'a'.repeat(64);
const HEX_B = 'b'.repeat(64);

const entry = (over: Partial<Entry['data']> & { id?: string } = {}): Entry => {
  const { id = '2026-05-07-un-hallazgo.md', ...data } = over;
  return {
    id,
    data: {
      title: 'Un hallazgo científico',
      excerpt: 'Un resumen del hallazgo.',
      date: new Date('2026-05-07T00:00:00Z'),
      categories: ['Tecnología'],
      ...data,
    },
  };
};

const EMPTY_ENV: Record<string, string | undefined> = {};

describe('buildSocialManifest', () => {
  it('emits the §8 contract shape with a normalized social block', async () => {
    const manifest = await buildSocialManifest(
      [entry({ social: { publish: true, id: HEX_A } })] as never,
      EMPTY_ENV
    );

    expect(manifest.schema_version).toBe(1);
    expect(manifest.provenance).toBeNull();
    expect(manifest.articles).toHaveLength(1);
    expect(manifest.articles[0]).toEqual({
      collection_id: '2026-05-07-un-hallazgo.md',
      date: '2026-05-07T00:00:00.000Z',
      title: 'Un hallazgo científico',
      description: 'Un resumen del hallazgo.',
      canonical_url: 'https://noticiencias.com/tecnologia/2026-05-07-un-hallazgo/',
      social: { publish: true, id: HEX_A },
    });
  });

  it('normalizes an absent social object to { publish: false } (distribution disabled)', async () => {
    const manifest = await buildSocialManifest([entry()] as never, EMPTY_ENV);
    expect(manifest.articles[0].social).toEqual({ publish: false });
  });

  it('keeps a social.id even when publish is false', async () => {
    const manifest = await buildSocialManifest(
      [entry({ social: { publish: false, id: HEX_A } })] as never,
      EMPTY_ENV
    );
    expect(manifest.articles[0].social).toEqual({ publish: false, id: HEX_A });
  });

  it('reuses a custom permalink instead of re-deriving the slug', async () => {
    const manifest = await buildSocialManifest(
      [entry({ permalink: 'ciencia/2026-05-07-un-hallazgo' })] as never,
      EMPTY_ENV
    );
    expect(manifest.articles[0].canonical_url).toBe(
      'https://noticiencias.com/ciencia/2026-05-07-un-hallazgo/'
    );
  });

  it('includes future-dated articles (the workflow, not the manifest, holds them back)', async () => {
    const manifest = await buildSocialManifest(
      [entry({ id: 'future.md', date: new Date('2099-01-01T00:00:00Z') })] as never,
      EMPTY_ENV
    );
    expect(manifest.articles).toHaveLength(1);
    expect(manifest.articles[0].date).toBe('2099-01-01T00:00:00.000Z');
  });

  it('rejects a duplicate social.id even between disabled articles', async () => {
    await expect(
      buildSocialManifest(
        [
          entry({ id: 'a.md', social: { publish: true, id: HEX_A } }),
          entry({ id: 'b.md', permalink: 'ciencia/b', social: { publish: false, id: HEX_A } }),
        ] as never,
        EMPTY_ENV
      )
    ).rejects.toThrow(/duplicate social\.id/);
  });

  it('rejects a duplicate canonical URL', async () => {
    await expect(
      buildSocialManifest(
        [
          entry({ id: 'a.md', permalink: 'ciencia/same' }),
          entry({ id: 'b.md', permalink: 'ciencia/same' }),
        ] as never,
        EMPTY_ENV
      )
    ).rejects.toThrow(/duplicate canonical URL/);
  });

  it('rejects an off-domain / invalid canonical URL', async () => {
    await expect(
      buildSocialManifest([entry({ permalink: 'https://evil.example/x' })] as never, EMPTY_ENV)
    ).rejects.toThrow(/off-domain canonical/);
  });

  it('rejects an on-domain canonical carrying a query string, fragment or credentials', async () => {
    // A prefix check ("starts with https://noticiencias.com/") would accept
    // all three — the manifest is the publisher's canonical source (plan
    // §11 / §20.3), so it must reject anything but a bare URL.
    await expect(
      buildSocialManifest([entry({ permalink: 'ciencia/x?utm_source=a' })] as never, EMPTY_ENV)
    ).rejects.toThrow(/query string or a fragment/);
    await expect(
      buildSocialManifest([entry({ permalink: 'ciencia/x#seccion' })] as never, EMPTY_ENV)
    ).rejects.toThrow(/query string or a fragment/);
    await expect(
      buildSocialManifest(
        [entry({ permalink: 'https://user:pass@noticiencias.com/ciencia/x' })] as never,
        EMPTY_ENV
      )
    ).rejects.toThrow(/credentials/);
  });

  it('orders articles deterministically by social.id then collection_id', async () => {
    const manifest = await buildSocialManifest(
      [
        entry({ id: 'z-no-id.md', permalink: 'ciencia/z' }),
        entry({ id: 'm-with-b.md', permalink: 'ciencia/m', social: { publish: true, id: HEX_B } }),
        entry({ id: 'a-with-a.md', permalink: 'ciencia/a', social: { publish: true, id: HEX_A } }),
      ] as never,
      EMPTY_ENV
    );
    expect(manifest.articles.map((a) => a.collection_id)).toEqual([
      'z-no-id.md',
      'a-with-a.md',
      'm-with-b.md',
    ]);
  });

  it('omits description when excerpt is absent', async () => {
    const manifest = await buildSocialManifest([entry({ excerpt: undefined })] as never, EMPTY_ENV);
    expect(manifest.articles[0]).not.toHaveProperty('description');
  });
});

describe('buildProvenance', () => {
  const goodEnv = {
    GITHUB_WORKFLOW: 'Deploy to GitHub Pages',
    GITHUB_REPOSITORY: 'cortega26/noticiencias',
    GITHUB_SHA: 'a'.repeat(40),
    GITHUB_RUN_ID: '123456789',
    GITHUB_RUN_ATTEMPT: '1',
  };

  it('returns the provenance object inside the Deploy to GitHub Pages workflow', () => {
    expect(buildProvenance(goodEnv)).toEqual({
      repository: 'cortega26/noticiencias',
      commit: 'a'.repeat(40),
      run_id: '123456789',
      build_attempt: 1,
      workflow: 'Deploy to GitHub Pages',
    });
  });

  it('returns null outside that workflow', () => {
    expect(buildProvenance({ ...goodEnv, GITHUB_WORKFLOW: 'Some Other Workflow' })).toBeNull();
    expect(buildProvenance({})).toBeNull();
  });

  it('returns null when the repository is not "owner/repo"', () => {
    expect(buildProvenance({ ...goodEnv, GITHUB_REPOSITORY: 'noslash' })).toBeNull();
    expect(buildProvenance({ ...goodEnv, GITHUB_REPOSITORY: 'a/b/c' })).toBeNull();
    expect(buildProvenance({ ...goodEnv, GITHUB_REPOSITORY: '' })).toBeNull();
  });

  it('returns null on a malformed commit SHA, run id or attempt', () => {
    expect(buildProvenance({ ...goodEnv, GITHUB_SHA: 'short' })).toBeNull();
    expect(buildProvenance({ ...goodEnv, GITHUB_RUN_ID: 'abc' })).toBeNull();
    expect(buildProvenance({ ...goodEnv, GITHUB_RUN_ATTEMPT: '0' })).toBeNull();
    expect(buildProvenance({ ...goodEnv, GITHUB_RUN_ATTEMPT: 'x' })).toBeNull();
  });

  it('preserves build_attempt values above 1 (rerun of the deploy job)', () => {
    expect(buildProvenance({ ...goodEnv, GITHUB_RUN_ATTEMPT: '3' })?.build_attempt).toBe(3);
  });
});

// ===========================================================================
// Package 3: scripts/social/article.js — manifest validation, candidate
// selection, and public-publication verification (plan §8 / §11 / §15).
// The manifest-endpoint tests above are unchanged.
// ===========================================================================

import {
  ManifestError,
  PLATFORM_ORDER,
  SKIP_REASON,
  selectCandidates,
  validateManifest,
  verifyPublicArticle,
} from '../../scripts/social/article.js';

const ID_A = 'a'.repeat(64);
const ID_B = 'b'.repeat(64);
const ID_C = 'c'.repeat(64);

const manifestArticle = (over: Record<string, unknown> = {}) => ({
  collection_id: '2026-05-07-x.md',
  date: '2026-05-07T00:00:00.000Z',
  title: 'Un hallazgo',
  description: 'Un resumen.',
  canonical_url: 'https://noticiencias.com/ciencia/2026-05-07-x/',
  social: { publish: true, id: ID_A },
  ...over,
});

const manifestJson = (articles: Array<Record<string, unknown>>, provenance: unknown = null) =>
  JSON.stringify({ schema_version: 1, provenance, articles });

describe('validateManifest', () => {
  it('accepts the §8 contract and binds a digest over the received bytes', () => {
    const raw = manifestJson([manifestArticle()]);
    const out = validateManifest(raw);
    expect(out.schema_version).toBe(1);
    expect(out.articles).toHaveLength(1);
    expect(out.digest).toMatch(/^[0-9a-f]{64}$/);
    // digest is of the raw string, not of a re-serialization
    expect(validateManifest(raw + ' ').digest).not.toBe(out.digest);
  });

  it('rejects an unknown schema_version', () => {
    expect(() =>
      validateManifest(JSON.stringify({ schema_version: 2, provenance: null, articles: [] }))
    ).toThrow(ManifestError);
  });

  it('rejects invalid JSON and oversized bodies', () => {
    expect(() => validateManifest('{not json')).toThrow(/valid JSON/);
    expect(() => validateManifest(manifestJson([manifestArticle()]), { maxBytes: 10 })).toThrow(
      /read limit/
    );
  });

  it('rejects a duplicate social.id even across a disabled article', () => {
    const raw = manifestJson([
      manifestArticle({ collection_id: 'a.md' }),
      manifestArticle({
        collection_id: 'b.md',
        canonical_url: 'https://noticiencias.com/ciencia/b/',
        social: { publish: false, id: ID_A },
      }),
    ]);
    expect(() => validateManifest(raw)).toThrow(/duplicate social\.id/);
  });

  it('rejects a duplicate canonical_url and off-domain canonicals', () => {
    expect(() =>
      validateManifest(
        manifestJson([
          manifestArticle({ collection_id: 'a.md', social: { publish: true, id: ID_A } }),
          manifestArticle({ collection_id: 'b.md', social: { publish: true, id: ID_B } }),
        ])
      )
    ).toThrow(/duplicate canonical_url/);
    expect(() =>
      validateManifest(
        manifestJson([manifestArticle({ canonical_url: 'https://evil.example/x/' })])
      )
    ).toThrow(/canonical_url must be a bare/);
    expect(() =>
      validateManifest(
        manifestJson([
          manifestArticle({ canonical_url: 'https://noticiencias.com/ciencia/x/?utm=a' }),
        ])
      )
    ).toThrow(/canonical_url must be a bare/);
  });

  it('rejects a non-boolean publish, a bad id, and a missing id when publish is true', () => {
    expect(() =>
      validateManifest(manifestJson([manifestArticle({ social: { publish: 'true', id: ID_A } })]))
    ).toThrow(/strict boolean/);
    expect(() =>
      validateManifest(manifestJson([manifestArticle({ social: { publish: true, id: 'abc' } })]))
    ).toThrow(/64 lowercase hex/);
    expect(() =>
      validateManifest(manifestJson([manifestArticle({ social: { publish: true } })]))
    ).toThrow(/social\.id is required/);
  });

  it('validates the provenance block when present', () => {
    const good = manifestJson([manifestArticle()], {
      repository: 'cortega26/noticiencias',
      commit: 'a'.repeat(40),
      run_id: '123',
      build_attempt: 1,
      workflow: 'Deploy to GitHub Pages',
    });
    expect(validateManifest(good).provenance).toMatchObject({ run_id: '123', build_attempt: 1 });
    const bad = manifestJson([manifestArticle()], {
      repository: 'nope',
      commit: 'x',
      run_id: 'x',
      build_attempt: 0,
      workflow: '',
    });
    expect(() => validateManifest(bad)).toThrow(ManifestError);
  });
});

describe('selectCandidates', () => {
  const config = {
    publishEnabled: true,
    enabledPlatforms: ['facebook', 'x', 'linkedin', 'bluesky'],
  };
  const now = () => Date.parse('2026-06-01T00:00:00Z');
  const PROVENANCE = {
    repository: 'cortega26/noticiencias',
    commit: 'a'.repeat(40),
    run_id: '77',
    build_attempt: 1,
    workflow: 'Deploy to GitHub Pages',
  };
  const build = (articles: Array<Record<string, unknown>>, provenance: unknown = PROVENANCE) =>
    validateManifest(manifestJson(articles, provenance));

  // A proof as `verifyDeployProof` returns it (result.proof) for a verified
  // run: bound to the manifest by digest AND by provenance identity.
  const proofFor = (m: ReturnType<typeof validateManifest>) => ({
    repository: PROVENANCE.repository,
    commit: PROVENANCE.commit,
    run_id: PROVENANCE.run_id,
    build_attempt: PROVENANCE.build_attempt,
    workflow_path: '.github/workflows/deploy.yml',
    manifest_digest: m.digest,
  });

  // Every eligible-path test runs under a verified proof bound to its manifest;
  // the DEPLOY_UNVERIFIED cases below exercise the missing/mismatched proof.
  type Proof = Parameters<typeof selectCandidates>[0]['deployProof'];
  const select = (p: {
    manifest: ReturnType<typeof validateManifest>;
    config?: Parameters<typeof selectCandidates>[0]['config'];
    now?: () => number;
    state?: Record<string, unknown>;
    deployProof?: Proof;
  }) =>
    selectCandidates({
      config,
      now,
      state: {},
      ...p,
      deployProof: p.deployProof === undefined ? (proofFor(p.manifest) as Proof) : p.deployProof,
    });

  it('skips every article when no verified deploy proof is supplied or the digest mismatches', () => {
    const manifest = build([manifestArticle()]);
    const none = selectCandidates({ manifest, config, now, state: {}, deployProof: null });
    expect(none.candidates).toHaveLength(0);
    expect(none.skipped[0].reason).toBe(SKIP_REASON.DEPLOY_UNVERIFIED);

    const mismatched = selectCandidates({
      manifest,
      config,
      now,
      state: {},
      deployProof: { ...proofFor(manifest), manifest_digest: 'f'.repeat(64) },
    });
    expect(mismatched.candidates).toHaveLength(0);
    expect(mismatched.skipped[0].reason).toBe(SKIP_REASON.DEPLOY_UNVERIFIED);
  });

  it('rejects a bare { manifest_digest } object that is not a full verified proof', () => {
    const manifest = build([manifestArticle()]);
    const out = selectCandidates({
      manifest,
      config,
      now,
      state: {},
      // digest matches, but this is not a verifyDeployProof result.
      deployProof: { manifest_digest: manifest.digest } as never,
    });
    expect(out.candidates).toHaveLength(0);
    expect(out.skipped.every((s) => s.reason === SKIP_REASON.DEPLOY_UNVERIFIED)).toBe(true);
  });

  it('rejects a proof whose provenance identity disagrees with the manifest', () => {
    const manifest = build([manifestArticle()]);
    for (const override of [
      { commit: 'b'.repeat(40) },
      { run_id: '999' },
      { repository: 'attacker/noticiencias' },
      { build_attempt: 2 },
    ]) {
      const out = selectCandidates({
        manifest,
        config,
        now,
        state: {},
        deployProof: { ...proofFor(manifest), ...override } as never,
      });
      expect(out.candidates).toHaveLength(0);
      expect(out.skipped[0].reason).toBe(SKIP_REASON.DEPLOY_UNVERIFIED);
    }
  });

  it('rejects any proof when the manifest carries no provenance (local build)', () => {
    const manifest = build([manifestArticle()], null);
    const out = selectCandidates({
      manifest,
      config,
      now,
      state: {},
      deployProof: { ...proofFor(manifest), commit: 'a'.repeat(40), run_id: '77' } as never,
    });
    expect(out.candidates).toHaveLength(0);
    expect(out.skipped[0].reason).toBe(SKIP_REASON.DEPLOY_UNVERIFIED);
  });

  it('emits one candidate per enabled platform for a fresh eligible article, each carrying the proof', () => {
    const manifest = build([manifestArticle()]);
    const out = select({ manifest });
    expect(out.candidates.map((c) => c.platform)).toEqual(PLATFORM_ORDER);
    expect(out.candidates.every((c) => c.resume === false)).toBe(true);
    expect(out.candidates.every((c) => c.deploy_proof.manifest_digest === manifest.digest)).toBe(
      true
    );
  });

  it('processes several articles from one manifest', () => {
    const manifest = build([
      manifestArticle({ collection_id: 'a.md', social: { publish: true, id: ID_A } }),
      manifestArticle({
        collection_id: 'b.md',
        canonical_url: 'https://noticiencias.com/ciencia/b/',
        social: { publish: true, id: ID_B },
      }),
      manifestArticle({
        collection_id: 'c.md',
        canonical_url: 'https://noticiencias.com/ciencia/c/',
        social: { publish: true, id: ID_C },
      }),
    ]);
    const out = select({ manifest });
    expect(out.candidates).toHaveLength(12);
  });

  it('disables distribution when social.publish is false / absent / globally off', () => {
    const off = select({
      manifest: build([manifestArticle({ social: { publish: false, id: ID_A } })]),
    });
    expect(off.candidates).toHaveLength(0);
    expect(off.skipped[0].reason).toBe(SKIP_REASON.PUBLISH_FALSE);

    const globalOff = select({
      manifest: build([manifestArticle()]),
      config: { ...config, publishEnabled: false },
    });
    expect(globalOff.candidates).toHaveLength(0);
    expect(globalOff.skipped[0].reason).toBe(SKIP_REASON.GLOBAL_DISABLED);
  });

  it('holds a future-dated article without publishing it', () => {
    const out = select({
      manifest: build([manifestArticle({ date: '2099-01-01T00:00:00.000Z' })]),
    });
    expect(out.candidates).toHaveLength(0);
    expect(out.waiting[0].reason).toBe(SKIP_REASON.FUTURE_DATE);
  });

  it('rollback: an article no longer in the manifest yields no candidates', () => {
    const out = select({ manifest: build([]) });
    expect(out.candidates).toHaveLength(0);
  });

  it('omits confirmed pairs and never re-sends them (partial success)', () => {
    const state = {
      articles: {
        [ID_A]: {
          collection_ids: ['2026-05-07-x.md'],
          canonical_urls: ['https://noticiencias.com/ciencia/2026-05-07-x/'],
          platforms: {
            facebook: { status: 'PUBLISHED' },
            x: { status: 'PUBLISHED' },
            linkedin: { status: 'RETRYABLE', retry_at: '2026-01-01T00:00:00Z' },
          },
        },
      },
    };
    const out = select({ manifest: build([manifestArticle()]), state });
    const byPlatform = Object.fromEntries(out.candidates.map((c) => [c.platform, c]));
    expect(byPlatform.facebook).toBeUndefined();
    expect(byPlatform.x).toBeUndefined();
    expect(byPlatform.linkedin).toMatchObject({ resume: true }); // retry due
    expect(byPlatform.bluesky).toMatchObject({ resume: false });
    expect(out.skipped.filter((s) => s.reason === SKIP_REASON.ALREADY_PUBLISHED)).toHaveLength(2);
  });

  it('does not turn an unresolved (ambiguous/accepted) attempt into a new send', () => {
    const state = {
      articles: {
        [ID_A]: {
          collection_ids: [],
          canonical_urls: [],
          platforms: {
            facebook: { status: 'AMBIGUOUS' },
            x: { status: 'ACCEPTED' },
            linkedin: { status: 'RETRYABLE', retry_at: '2999-01-01T00:00:00Z' },
          },
        },
      },
    };
    const out = select({ manifest: build([manifestArticle()]), state });
    expect(out.candidates.map((c) => c.platform)).toEqual(['bluesky']);
    expect(out.skipped.map((s) => s.reason).sort()).toEqual(
      [
        SKIP_REASON.RETRY_NOT_DUE,
        SKIP_REASON.UNRESOLVED_ATTEMPT,
        SKIP_REASON.UNRESOLVED_ATTEMPT,
      ].sort()
    );
  });

  it('treats PUBLISHING, FAILED_PERMANENT and unknown statuses as non-sends', () => {
    const state = {
      articles: {
        [ID_A]: {
          collection_ids: [],
          canonical_urls: [],
          platforms: {
            facebook: { status: 'PUBLISHING' },
            x: { status: 'FAILED_PERMANENT' },
            linkedin: { status: 'SOMETHING_NEW' },
          },
        },
      },
    };
    const out = select({ manifest: build([manifestArticle()]), state });
    expect(out.candidates.map((c) => c.platform)).toEqual(['bluesky']);
    const byPlatform = Object.fromEntries(
      out.skipped.filter((s) => s.platform).map((s) => [s.platform, s.reason])
    );
    expect(byPlatform.facebook).toBe(SKIP_REASON.UNRESOLVED_ATTEMPT);
    expect(byPlatform.x).toBe(SKIP_REASON.BLOCKED);
    expect(byPlatform.linkedin).toBe(SKIP_REASON.UNRESOLVED_ATTEMPT);
  });

  it('flags an identity conflict (same canonical, different social.id) and zeroes the whole article', () => {
    const state = {
      articles: {
        [ID_B]: {
          collection_ids: [],
          canonical_urls: ['https://noticiencias.com/ciencia/2026-05-07-x/'],
          platforms: {},
        },
      },
    };
    const out = select({ manifest: build([manifestArticle()]), state });
    expect(out.candidates).toHaveLength(0);
    expect(out.conflicts[0]).toMatchObject({
      reason: SKIP_REASON.IDENTITY_CONFLICT,
      conflicting_social_id: ID_B,
    });
  });

  it('permalink change with the same social.id is not a conflict and is not duplicated', () => {
    const state = {
      articles: {
        [ID_A]: {
          collection_ids: ['2026-05-07-x.md'],
          canonical_urls: ['https://noticiencias.com/OLD/2026-05-07-x/'],
          platforms: { facebook: { status: 'PUBLISHED' } },
        },
      },
    };
    const out = select({
      manifest: build([
        manifestArticle({ canonical_url: 'https://noticiencias.com/NEW/2026-05-07-x/' }),
      ]),
      state,
    });
    expect(out.conflicts).toHaveLength(0);
    expect(out.candidates.map((c) => c.platform)).toEqual(['x', 'linkedin', 'bluesky']);
  });

  it('a same-id rename (file AND canonical both changed) is not a conflict', () => {
    const state = {
      articles: {
        [ID_A]: {
          collection_ids: ['OLD-file.md'],
          canonical_urls: ['https://noticiencias.com/OLD/x/'],
          platforms: {},
        },
      },
    };
    const out = select({
      manifest: build([
        manifestArticle({
          collection_id: 'NEW-file.md',
          canonical_url: 'https://noticiencias.com/NEW/x/',
        }),
      ]),
      state,
    });
    expect(out.conflicts).toHaveLength(0);
    expect(out.candidates).toHaveLength(4);
  });

  it('skips a RETRYABLE row with no parseable retry_at conservatively', () => {
    const state = {
      articles: {
        [ID_A]: {
          collection_ids: [],
          canonical_urls: [],
          platforms: { x: { status: 'RETRYABLE' } },
        },
      },
    };
    const out = select({ manifest: build([manifestArticle()]), state });
    expect(out.candidates.map((c) => c.platform)).not.toContain('x');
    expect(out.skipped.find((s) => s.platform === 'x')?.reason).toBe(
      SKIP_REASON.UNRESOLVED_ATTEMPT
    );
  });

  it('flags a destination change when the stored account_key differs from config', () => {
    const state = {
      articles: {
        [ID_A]: {
          collection_ids: [],
          canonical_urls: [],
          platforms: { bluesky: { status: 'RETRYABLE', account_key: 'did:plc:old' } },
        },
      },
    };
    const out = select({
      manifest: build([manifestArticle()]),
      config: { ...config, platformAccounts: { bluesky: 'did:plc:new' } },
      state,
    });
    expect(out.skipped.find((s) => s.platform === 'bluesky')?.reason).toBe(
      SKIP_REASON.DESTINATION_CHANGED
    );
  });
});

describe('verifyPublicArticle', () => {
  const CANON = 'https://noticiencias.com/ciencia/2026-05-07-x/';
  const IMG = 'https://noticiencias.com/_astro/hero.jpg';
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

  const pageHtml = (o: Record<string, string | undefined> = {}) => `<!doctype html><html><head>
    <link rel="canonical" href="${o.canonical ?? CANON}">
    <meta property="og:url" content="${o.ogUrl ?? CANON}">
    <meta property="og:title" content="${o.ogTitle ?? 'Un hallazgo'}">
    <meta property="og:description" content="${o.ogDesc ?? 'Un resumen.'}">
    ${o.robots ? `<meta name="robots" content="${o.robots}">` : ''}
    <meta property="og:image" content="${o.ogImage ?? IMG}">
    </head><body><h1>Un hallazgo</h1></body></html>`;

  function siteFetch(map: Record<string, Response | (() => Response)>) {
    return vi.fn(async (url: string) => {
      const key = Object.keys(map).find((k) => url === k || url.includes(k));
      if (!key) throw Object.assign(new Error('unexpected'), { cause: { code: 'ENOTFOUND' } });
      const v = map[key];
      return typeof v === 'function' ? v() : v;
    });
  }

  const article = { canonical_url: CANON, title: 'Un hallazgo', description: 'Un resumen.' };

  it('accepts a well-formed page and a real image', async () => {
    const fetchImpl = siteFetch({
      [CANON]: new Response(pageHtml(), { status: 200 }),
      [IMG]: new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    });
    const out = await verifyPublicArticle({ article, fetchImpl });
    expect(out.ok).toBe(true);
    expect(out.verified?.image_url).toBe(IMG);
  });

  it('rejects a 200 page whose canonical or og:url disagrees with the manifest', async () => {
    const fetchImpl = siteFetch({
      [CANON]: new Response(pageHtml({ canonical: 'https://noticiencias.com/ciencia/other/' }), {
        status: 200,
      }),
      [IMG]: new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    });
    const out = await verifyPublicArticle({ article, fetchImpl });
    expect(out.ok).toBe(false);
    expect(out.reasons.map((r) => r.code)).toContain('CANONICAL_MISMATCH');
  });

  it('rejects inconsistent og:title/og:description', async () => {
    const fetchImpl = siteFetch({
      [CANON]: new Response(pageHtml({ ogTitle: 'Otro titular', ogDesc: 'Otro resumen.' }), {
        status: 200,
      }),
      [IMG]: new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    });
    const out = await verifyPublicArticle({ article, fetchImpl });
    expect(out.ok).toBe(false);
    expect(out.reasons.map((r) => r.code)).toEqual(
      expect.arrayContaining(['OG_TITLE_MISMATCH', 'OG_DESCRIPTION_MISMATCH'])
    );
  });

  it('rejects a noindex page', async () => {
    const fetchImpl = siteFetch({
      [CANON]: new Response(pageHtml({ robots: 'noindex, nofollow' }), { status: 200 }),
      [IMG]: new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    });
    const out = await verifyPublicArticle({ article, fetchImpl });
    expect(out.reasons.map((r) => r.code)).toContain('NOINDEX');
  });

  it('rejects HTML disguised as an image', async () => {
    const fetchImpl = siteFetch({
      [CANON]: new Response(pageHtml(), { status: 200 }),
      [IMG]: new Response('<!doctype html><html></html>', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }),
    });
    const out = await verifyPublicArticle({ article, fetchImpl });
    expect(out.reasons.map((r) => r.code)).toContain('IMAGE_NOT_IMAGE');
  });

  it('rejects a page with more than one og:image tag', async () => {
    const html = `<!doctype html><html><head>
      <link rel="canonical" href="${CANON}">
      <meta property="og:url" content="${CANON}">
      <meta property="og:title" content="Un hallazgo">
      <meta property="og:description" content="Un resumen.">
      <meta property="og:image" content="${IMG}">
      <meta property="og:image" content="https://cdn.evil.example/x.jpg">
      </head><body></body></html>`;
    const fetchImpl = siteFetch({
      [CANON]: new Response(html, { status: 200 }),
      [IMG]: new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    });
    const out = await verifyPublicArticle({ article, fetchImpl });
    expect(out.ok).toBe(false);
    expect(out.reasons.map((r) => r.code)).toContain('MULTIPLE_OG_IMAGE');
  });

  it('rejects a page where a first matching og:url/og:title/og:description is contradicted by a second', async () => {
    // Each first value matches the manifest; the second contradicts it. A
    // "read the first tag" verifier would pass this — it must not.
    const html = `<!doctype html><html><head>
      <link rel="canonical" href="${CANON}">
      <meta property="og:url" content="${CANON}">
      <meta property="og:url" content="https://noticiencias.com/ciencia/otro/">
      <meta property="og:title" content="Un hallazgo">
      <meta property="og:title" content="Titular falso">
      <meta property="og:description" content="Un resumen.">
      <meta property="og:description" content="Resumen falso.">
      <meta property="og:image" content="${IMG}">
      </head><body></body></html>`;
    const fetchImpl = siteFetch({
      [CANON]: new Response(html, { status: 200 }),
      [IMG]: new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    });
    const out = await verifyPublicArticle({ article, fetchImpl });
    expect(out.ok).toBe(false);
    expect(out.reasons.map((r) => r.code)).toEqual(
      expect.arrayContaining(['MULTIPLE_OG_URL', 'MULTIPLE_OG_TITLE', 'MULTIPLE_OG_DESCRIPTION'])
    );
  });

  it('rejects an off-domain og:image', async () => {
    const fetchImpl = siteFetch({
      [CANON]: new Response(pageHtml({ ogImage: 'https://cdn.evil.example/x.jpg' }), {
        status: 200,
      }),
    });
    const out = await verifyPublicArticle({ article, fetchImpl });
    expect(out.reasons.map((r) => r.code)).toContain('OG_IMAGE_OFFDOMAIN');
  });

  it('rejects a soft-404 / non-200 status', async () => {
    const fetchImpl = siteFetch({ [CANON]: new Response('nope', { status: 404 }) });
    const out = await verifyPublicArticle({ article, fetchImpl });
    expect(out.ok).toBe(false);
    expect(out.reasons[0].code).toBe('STATUS');
  });

  it('rejects an oversized HTML response', async () => {
    const fetchImpl = siteFetch({ [CANON]: new Response('x'.repeat(5000), { status: 200 }) });
    const out = await verifyPublicArticle({ article, fetchImpl, maxHtmlBytes: 100 });
    expect(out.reasons[0].code).toBe('FETCH_FAILED');
    expect(out.reasons[0].detail).toContain('RESPONSE_TOO_LARGE');
  });

  it('rejects a canonical GET that redirects off the domain', async () => {
    const fetchImpl = siteFetch({
      [CANON]: new Response(null, { status: 302, headers: { location: 'https://evil.example/x' } }),
    });
    const out = await verifyPublicArticle({ article, fetchImpl });
    expect(out.reasons[0].code).toBe('FETCH_FAILED');
    expect(out.reasons[0].detail).toContain('REDIRECT_DISALLOWED');
  });
});
