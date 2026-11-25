import { describe, expect, it, vi } from 'vitest';
import { DEPLOY_WORKFLOW_PATH, REQUIRED_DEPLOY_JOBS } from '../../scripts/social/github.js';
import { BUFFER_OUTCOME } from '../../scripts/social/providers/buffer.js';
import { runDistribution } from '../../scripts/social/publish.js';

const repo = 'example/noticiencias';
const commit = 'a'.repeat(40);
const now = () => Date.parse('2026-11-23T12:00:00Z');
const platforms = ['facebook', 'x', 'linkedin'];
const articles = ['a', 'b'].map((slug, index) => ({
  collection_id: `ciencia/articulo-${slug}`,
  canonical_url: `https://noticiencias.com/ciencia/articulo-${slug}/`,
  title: `Artículo de prueba ${slug.toUpperCase()}`,
  description: 'Un resumen de prueba.',
  date: `2026-11-${20 + index}T12:00:00Z`,
  social: { id: slug.repeat(64), publish: true },
}));
const [first, second] = articles;
const rawManifest = JSON.stringify({
  schema_version: 1,
  provenance: {
    repository: repo,
    commit,
    run_id: '123',
    build_attempt: 1,
    workflow: 'Deploy to GitHub Pages',
  },
  articles,
});

function memoryLedger() {
  let snapshot = JSON.stringify({
    schema_version: 1,
    initialized_at: new Date(now()).toISOString(),
    revision: 0,
    last_transition_nonce: null,
    last_allocated_bluesky_micros: 0,
    proven_deploys: {},
    articles: {},
  });
  let revision = 0;
  return {
    async createOrphanBranch() {
      throw new Error('The fixture ledger is already initialized');
    },
    async readBranchHead() {
      return { commitSha: String(revision) };
    },
    async readFileAtCommit(commitSha: string) {
      expect(commitSha).toBe(String(revision));
      return { contentText: snapshot, blobSha: String(revision) };
    },
    async putFile({
      expectedBlobSha,
      contentText,
    }: {
      expectedBlobSha: string;
      contentText: string;
    }) {
      expect(expectedBlobSha).toBe(String(revision));
      snapshot = contentText;
      revision += 1;
      return { commitSha: String(revision), blobSha: String(revision) };
    },
  };
}

function actionsResponse(url: string) {
  const completed = {
    run_attempt: 1,
    status: 'completed',
    conclusion: 'success',
    head_sha: commit,
  };
  if (new URL(url).pathname.endsWith('/jobs')) {
    const jobs = REQUIRED_DEPLOY_JOBS.map((name: string) => ({ ...completed, name }));
    return Response.json({ total_count: jobs.length, jobs });
  }
  return Response.json({
    ...completed,
    id: 123,
    head_branch: 'main',
    path: DEPLOY_WORKFLOW_PATH,
    event: 'push',
    repository: { full_name: repo },
    head_repository: { full_name: repo },
  });
}

const imageUrl = 'https://noticiencias.com/image.jpg';

function publicArticleResponse(url: string) {
  if (url === imageUrl) {
    return new Response(
      Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1),
      {
        headers: { 'content-type': 'image/jpeg' },
      }
    );
  }
  const article = articles.find((item) => item.canonical_url === url);
  if (!article) throw new Error(`Unexpected article URL ${url}`);
  return new Response(
    `<link rel="canonical" href="${article.canonical_url}">
     <meta property="og:url" content="${article.canonical_url}">
     <meta property="og:title" content="${article.title}">
     <meta property="og:description" content="${article.description}">
     <meta property="og:image" content="${imageUrl}">`,
    { headers: { 'content-type': 'text/html' } }
  );
}

type PublishResult = import('../../scripts/social/providers/buffer.js').PublishResult;
type PublishInput = {
  channelId: string;
  post: { canonical_url: string };
};
type Scenario = {
  firstOutcome?: PublishResult['outcome'];
  selectors?: { articleId?: string; platform?: string };
  cap?: number;
  manifestChanged?: boolean;
};

function bufferFixture(create: (input: PublishInput) => Promise<PublishResult>) {
  const unexpectedCall = async () => {
    throw new Error('Unexpected Buffer call in the candidate fixture');
  };
  return {
    create,
    get: unexpectedCall,
    list: unexpectedCall,
    reconcile: unexpectedCall,
    discoverOrganizations: unexpectedCall,
    discoverChannels: unexpectedCall,
    inspectChannels: unexpectedCall,
  };
}

async function runScenario({
  firstOutcome = BUFFER_OUTCOME.PUBLISHED,
  selectors,
  cap = 2,
  manifestChanged = false,
}: Scenario = {}) {
  const fetchManifest = vi.fn(async () => rawManifest).mockResolvedValueOnce(rawManifest);
  if (manifestChanged) fetchManifest.mockResolvedValueOnce(`${rawManifest}\n`);
  const fetchImpl = vi.fn(async (url: string) => publicArticleResponse(url));
  const create = vi
    .fn(
      async ({ channelId, post }: PublishInput): Promise<PublishResult> => ({
        outcome: BUFFER_OUTCOME.PUBLISHED,
        providerId: `${channelId}:${post.canonical_url}`,
        evidence: {},
      })
    )
    .mockImplementationOnce(async () => ({
      outcome: firstOutcome,
      providerId: 'first-id',
      evidence: {},
    }));

  const summary = await runDistribution({
    mode: 'publish',
    trustedContext: true,
    selectors,
    config: {
      publishEnabled: true,
      enabledPlatforms: platforms,
      platformAccounts: { facebook: 'channel-fb', x: 'channel-x', linkedin: 'channel-li' },
      repository: repo,
      defaultBranch: 'main',
      maxNewArticlesPerRun: cap,
      pollDelaysMs: [],
    },
    session: { runId: '456', attempt: 1 },
    now,
    rng: () => 0,
    sleep: async () => {},
    fetchManifest,
    fetchImpl,
    githubDeps: { fetchImpl: async (url: string) => actionsResponse(url) },
    stateStore: memoryLedger(),
    bufferClient: bufferFixture(create),
  });
  expect(summary.trust).toBe('verified');
  const sends = create.mock.calls.map(([{ channelId, post }]) => [post.canonical_url, channelId]);
  const verified = fetchImpl.mock.calls.map(([url]) => url).filter((url) => url !== imageUrl);
  return { summary, sends, verified };
}

describe('social publish candidate orchestration', () => {
  it('stops only the paused channel and sends the other candidates in order', async () => {
    const { sends, summary } = await runScenario({ firstOutcome: BUFFER_OUTCOME.CHANNEL_BLOCKED });
    expect(sends).toEqual([
      [first.canonical_url, 'channel-fb'],
      [first.canonical_url, 'channel-x'],
      [first.canonical_url, 'channel-li'],
      [second.canonical_url, 'channel-x'],
      [second.canonical_url, 'channel-li'],
    ]);
    expect(summary.sent).toMatchObject(
      ['ACCEPTED', 'PUBLISHED', 'PUBLISHED', 'PUBLISHED', 'PUBLISHED'].map((result) => ({ result }))
    );
  });

  it('charges the budget only for the selected article and counts it once across channels', async () => {
    const { sends, verified, summary } = await runScenario({
      cap: 1,
      selectors: { articleId: second.social.id, platform: 'all' },
    });
    expect(verified).toEqual(Array(3).fill(second.canonical_url));
    expect(sends).toEqual([
      [second.canonical_url, 'channel-fb'],
      [second.canonical_url, 'channel-x'],
      [second.canonical_url, 'channel-li'],
    ]);
    expect(summary.deferred_new_article_budget).toBe(0);
  });

  it('defers the next article once the eligible-article cap is reached', async () => {
    const { sends, verified, summary } = await runScenario({
      cap: 1,
      selectors: { platform: 'x' },
    });
    expect(sends).toEqual([[first.canonical_url, 'channel-x']]);
    expect(verified).toEqual([first.canonical_url]);
    expect(summary.deferred_new_article_budget).toBe(1);
  });

  it('stops the entire run on provider authentication failure', async () => {
    const { sends, verified, summary } = await runScenario({
      firstOutcome: BUFFER_OUTCOME.AUTH_INVALID,
    });
    expect(sends).toEqual([[first.canonical_url, 'channel-fb']]);
    expect(verified).toEqual([first.canonical_url]);
    expect(summary.warnings).toContain('auth-invalid');
    expect(summary).toHaveProperty('exit_code', 1);
  });

  it('stops before any send when the verified manifest changes', async () => {
    const { sends, verified, summary } = await runScenario({ manifestChanged: true });
    expect(sends).toEqual([]);
    expect(verified).toEqual([first.canonical_url]);
    expect(summary.sent).toEqual([
      { social_id: first.social.id, platform: 'facebook', result: 'MANIFEST_CHANGED' },
    ]);
  });
});
