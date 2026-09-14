import { createHash } from 'node:crypto';
import { Buffer as NodeBuffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';

import {
  BUFFER_API_URL,
  BUFFER_OUTCOME,
  BufferError,
  MAX_POST_IDS_PER_REQUEST,
  RECONCILE_DECISION,
  createBufferClient,
  reconciliationParams,
  toRecordResult,
} from '../../scripts/social/providers/buffer.js';
import { makeSocialPost } from '../../scripts/social/content.js';
import { StateError, recordIntent, recordResult } from '../../scripts/social/state.js';

/**
 * Plan social-distribution §6 / §10 / §12 / §13 / §15 / §17: the Buffer
 * GraphQL adapter for Facebook Page / X / LinkedIn Page.
 *
 * Every `fetch` is a fake that inspects the GraphQL request body (operation
 * name) and returns a canned response — Buffer is a single POST endpoint, so
 * routing by URL alone (as `bluesky.test.ts` does for distinct XRPC paths)
 * does not apply here. No network, no clock, no waiting.
 */

// --- fakes --------------------------------------------------------------

type Init = { method?: string; headers?: Record<string, string>; body?: string };
type Call = { body: { query: string; variables: unknown }; headers: Record<string, string> };
type Handler = (call: Call) => Response | Promise<Response>;

function lower(headers?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers ?? {})) out[k.toLowerCase()] = String(v);
  return out;
}

function operationName(query: string): string {
  const match = /(?:query|mutation)\s+(\w+)/.exec(query);
  return match ? match[1] : 'unknown';
}

/** Route a fake `fetch` by GraphQL operation name. Records every call. */
function router(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init: Init = {}) => {
    expect(new URL(url).host).toBe(new URL(BUFFER_API_URL).host);
    const parsedBody = JSON.parse(init.body ?? '{}');
    const call: Call = { body: parsedBody, headers: lower(init.headers) };
    calls.push(call);
    const op = operationName(parsedBody.query ?? '');
    const handler = routes[op];
    if (!handler) throw new Error(`router: no route for operation ${op}`);
    return handler(call);
  });
  return Object.assign(fn, { calls });
}

const jsonResponse = (obj: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

// --- constants -----------------------------------------------------------

const API_KEY = 'buffer-secret-key-0000';
const ORG_ID = 'org-1';
const CANONICAL = 'https://noticiencias.com/ciencia/eclipse/';

function baseClient(routes: Record<string, Handler>, over: Record<string, unknown> = {}) {
  const fetchImpl = router(routes);
  const client = createBufferClient({
    fetchImpl,
    apiKey: API_KEY,
    organizationId: ORG_ID,
    ...over,
  });
  return { client, fetchImpl };
}

function fbPost(over: Record<string, unknown> = {}) {
  return makeSocialPost(
    {
      title: 'Los físicos miden la duración del eclipse solar total',
      description: 'Un estudio internacional describe el fenómeno en detalle.',
      canonical_url: CANONICAL,
      ...over,
    },
    { platform: 'facebook', account_key: 'fb-channel-1' }
  );
}

function xPost(over: Record<string, unknown> = {}) {
  return makeSocialPost(
    {
      title: 'Los físicos miden la duración del eclipse solar total',
      canonical_url: CANONICAL,
      ...over,
    },
    { platform: 'x', account_key: 'x-channel-1' }
  );
}

function successPayload(post: Record<string, unknown>) {
  return jsonResponse({ data: { createPost: { __typename: 'PostActionSuccess', post } } });
}

// --- create() ------------------------------------------------------------

describe('createBufferClient().create', () => {
  it('sends assets + needsApproval explicitly and maps a scheduled post to ACCEPTED', async () => {
    const { client, fetchImpl } = baseClient({
      CreatePost: (call) =>
        successPayload({
          id: 'post-1',
          status: 'scheduled',
          channelId: 'fb-channel-1',
          text: (call.body.variables as { input: { text: string } }).input.text,
          externalLink: null,
          sentAt: null,
        }),
    });
    const post = fbPost();
    const result = await client.create({ channelId: 'fb-channel-1', post });
    expect(result.outcome).toBe(BUFFER_OUTCOME.ACCEPTED);
    expect(result.providerId).toBe('post-1');

    const input = (fetchImpl.calls[0].body.variables as { input: Record<string, unknown> }).input;
    expect(input.mode).toBe('shareNow');
    expect(input.schedulingType).toBe('automatic');
    expect(input.needsApproval).toBe(false);
    expect(input.saveToDraft).toBe(false);
    expect(input.assets).toEqual([{ link: { url: CANONICAL } }]);
  });

  it('sends assets: [] for X (no parallel link asset)', async () => {
    const { client, fetchImpl } = baseClient({
      CreatePost: () =>
        successPayload({ id: 'post-x', status: 'scheduled', channelId: 'x-channel-1' }),
    });
    await client.create({ channelId: 'x-channel-1', post: xPost() });
    const input = (fetchImpl.calls[0].body.variables as { input: Record<string, unknown> }).input;
    expect(input.assets).toEqual([]);
  });

  it('maps status=sent to PUBLISHED with providerId + externalUrl', async () => {
    const { client } = baseClient({
      CreatePost: () =>
        successPayload({
          id: 'post-2',
          status: 'sent',
          channelId: 'fb-channel-1',
          externalLink: 'https://facebook.com/x/posts/2',
        }),
    });
    const result = await client.create({ channelId: 'fb-channel-1', post: fbPost() });
    expect(result.outcome).toBe(BUFFER_OUTCOME.PUBLISHED);
    expect(result.providerId).toBe('post-2');
    expect(result.externalUrl).toBe('https://facebook.com/x/posts/2');
  });

  it('maps status=error to REJECTED but keeps the providerId (repair that object, never recreate)', async () => {
    const { client } = baseClient({
      CreatePost: () =>
        successPayload({ id: 'post-3', status: 'error', channelId: 'fb-channel-1' }),
    });
    const result = await client.create({ channelId: 'fb-channel-1', post: fbPost() });
    expect(result.outcome).toBe(BUFFER_OUTCOME.REJECTED);
    expect(result.providerId).toBe('post-3');
  });

  it('maps draft/needs_approval to CHANNEL_BLOCKED, keeping the id (§13 "detener canal")', async () => {
    const { client } = baseClient({
      CreatePost: () =>
        successPayload({ id: 'post-4', status: 'needs_approval', channelId: 'fb-channel-1' }),
    });
    const result = await client.create({ channelId: 'fb-channel-1', post: fbPost() });
    expect(result.outcome).toBe(BUFFER_OUTCOME.CHANNEL_BLOCKED);
    expect(result.providerId).toBe('post-4');
  });

  it('maps an unrecognized status to ACCEPTED ("guardar ID y reconciliar"), never a failure', async () => {
    const { client } = baseClient({
      CreatePost: () =>
        successPayload({ id: 'post-5', status: 'some-future-status', channelId: 'fb-channel-1' }),
    });
    const result = await client.create({ channelId: 'fb-channel-1', post: fbPost() });
    expect(result.outcome).toBe(BUFFER_OUTCOME.ACCEPTED);
    expect(result.providerId).toBe('post-5');
  });

  it('maps InvalidInputError to REJECTED (provably pre-write)', async () => {
    const { client } = baseClient({
      CreatePost: () =>
        jsonResponse({
          data: {
            createPost: { __typename: 'InvalidInputError', message: 'text too long' },
          },
        }),
    });
    const result = await client.create({ channelId: 'fb-channel-1', post: fbPost() });
    expect(result.outcome).toBe(BUFFER_OUTCOME.REJECTED);
    expect(result.safeToRetry).toBe(false);
  });

  it('maps a generic/unknown typed MutationError to AMBIGUOUS, never "not published"', async () => {
    const { client } = baseClient({
      CreatePost: () =>
        jsonResponse({
          data: { createPost: { __typename: 'MutationError', message: 'internal issue' } },
        }),
    });
    const result = await client.create({ channelId: 'fb-channel-1', post: fbPost() });
    expect(result.outcome).toBe(BUFFER_OUTCOME.AMBIGUOUS);
  });

  it('maps top-level GraphQL errors with no data to AMBIGUOUS', async () => {
    const { client } = baseClient({
      CreatePost: () => jsonResponse({ errors: [{ message: 'schema validation failed' }] }),
    });
    const result = await client.create({ channelId: 'fb-channel-1', post: fbPost() });
    expect(result.outcome).toBe(BUFFER_OUTCOME.AMBIGUOUS);
  });

  it('maps a lost response / timeout to AMBIGUOUS, safeToRetry=false — never a blind retry-create', async () => {
    const { client } = baseClient({
      CreatePost: () => {
        throw Object.assign(new Error('socket hang up'), { name: 'TimeoutError' });
      },
    });
    const result = await client.create({ channelId: 'fb-channel-1', post: fbPost() });
    expect(result.outcome).toBe(BUFFER_OUTCOME.AMBIGUOUS);
    expect(result.safeToRetry).toBe(false);
  });

  it('maps a 5xx on the mutation to AMBIGUOUS ("puede haber aceptado")', async () => {
    const { client } = baseClient({
      CreatePost: () => jsonResponse({ message: 'internal error' }, 500),
    });
    const result = await client.create({ channelId: 'fb-channel-1', post: fbPost() });
    expect(result.outcome).toBe(BUFFER_OUTCOME.AMBIGUOUS);
  });

  it('maps an HTTP 429 response to RATE_LIMITED, safeToRetry=true (rejected, never processed)', async () => {
    const { client } = baseClient({
      CreatePost: () => jsonResponse({ message: 'slow down' }, 429, { 'retry-after': '30' }),
    });
    const result = await client.create({ channelId: 'fb-channel-1', post: fbPost() });
    expect(result.outcome).toBe(BUFFER_OUTCOME.RATE_LIMITED);
    expect(result.safeToRetry).toBe(true);
    expect(result.retryAfterMs).toBe(30_000);
  });

  it('maps a thrown/transport-level 429 differently from a real 429 response (still AMBIGUOUS, not RETRYABLE)', async () => {
    const { client } = baseClient({
      CreatePost: () => {
        const err = new Error('socket hang up');
        (err as { name: string }).name = 'TimeoutError';
        throw err;
      },
    });
    const result = await client.create({ channelId: 'fb-channel-1', post: fbPost() });
    // A lost response can never be proven a 429; conservative AMBIGUOUS.
    expect(result.outcome).toBe(BUFFER_OUTCOME.AMBIGUOUS);
  });

  it('maps a 401 to AUTH_INVALID', async () => {
    const { client } = baseClient({
      CreatePost: () => jsonResponse({ message: 'bad key' }, 401),
    });
    const result = await client.create({ channelId: 'fb-channel-1', post: fbPost() });
    expect(result.outcome).toBe(BUFFER_OUTCOME.AUTH_INVALID);
  });

  it('never leaks the API key in evidence, even on a transport failure', async () => {
    const { client } = baseClient({
      CreatePost: () => {
        throw new Error(`request failed with key ${API_KEY} inline`);
      },
    });
    const result = await client.create({ channelId: 'fb-channel-1', post: fbPost() });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it('rejects a non-Buffer platform post (CONFIG)', async () => {
    const { client } = baseClient({});
    const bskyPost = makeSocialPost(
      { title: 'x', canonical_url: CANONICAL },
      { platform: 'bluesky', account_key: 'bsky-1' }
    );
    await expect(client.create({ channelId: 'c1', post: bskyPost as never })).rejects.toThrow(
      BufferError
    );
  });
});

// --- get() ----------------------------------------------------------------

describe('createBufferClient().get', () => {
  it('batches up to MAX_POST_IDS_PER_REQUEST ids via aliases in one request', async () => {
    const ids = Array.from({ length: MAX_POST_IDS_PER_REQUEST }, (_, i) => `id-${i}`);
    const { client, fetchImpl } = baseClient({
      GetPosts: (call) => {
        const vars = call.body.variables as Record<string, string>;
        const data: Record<string, unknown> = {};
        ids.forEach((id, i) => {
          expect(vars[`id${i}`]).toBe(id);
          data[`p${i}`] = { id, status: 'sent', channelId: 'c1', externalLink: `https://x/${id}` };
        });
        return jsonResponse({ data });
      },
    });
    const results = await client.get({ ids });
    expect(fetchImpl.calls).toHaveLength(1);
    expect(results).toHaveLength(MAX_POST_IDS_PER_REQUEST);
    for (const r of results) expect(r.outcome).toBe(BUFFER_OUTCOME.PUBLISHED);
  });

  it('throws CONFIG when asked for more than MAX_POST_IDS_PER_REQUEST ids (caller must chunk)', async () => {
    const { client } = baseClient({});
    const ids = Array.from({ length: MAX_POST_IDS_PER_REQUEST + 1 }, (_, i) => `id-${i}`);
    await expect(client.get({ ids })).rejects.toThrow(BufferError);
  });

  it('a lost response maps every requested id to AMBIGUOUS, found=false', async () => {
    const { client } = baseClient({
      GetPosts: () => {
        throw new Error('ECONNRESET');
      },
    });
    const results = await client.get({ ids: ['a', 'b'] });
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.found).toBe(false);
      expect(r.outcome).toBe(BUFFER_OUTCOME.AMBIGUOUS);
    }
  });
});

// --- reconcile() -----------------------------------------------------------

function listPage(nodes: object[], hasNextPage = false, endCursor: string | null = null) {
  return jsonResponse({
    data: {
      posts: {
        edges: nodes.map((node) => ({ node })),
        pageInfo: { hasNextPage, endCursor },
      },
    },
  });
}

describe('createBufferClient().reconcile', () => {
  const frozenText = 'Título congelado\n\nhttps://noticiencias.com/ciencia/eclipse/';

  it('adopts on exactly one unambiguous match (status sent -> target PUBLISHED)', async () => {
    const { client } = baseClient({
      ListPosts: () =>
        listPage([
          {
            id: 'match-1',
            status: 'sent',
            channelId: 'fb-channel-1',
            text: frozenText,
            externalLink: 'https://facebook.com/p/1',
            assets: [],
          },
        ]),
    });
    const recon = await client.reconcile({
      channelId: 'fb-channel-1',
      frozenText,
      canonicalUrl: CANONICAL,
    });
    expect(recon.decision).toBe(RECONCILE_DECISION.CONFIRMED);
    expect(recon.target).toBe('PUBLISHED');
    expect(recon.providerId).toBe('match-1');

    const params = reconciliationParams(recon);
    expect(params).toMatchObject({
      call: 'recordReconciliation',
      kind: 'adopt',
      target: 'PUBLISHED',
    });
  });

  it('adopts to ACCEPTED (not PUBLISHED) when the matched post is not yet sent', async () => {
    const { client } = baseClient({
      ListPosts: () =>
        listPage([
          {
            id: 'match-2',
            status: 'scheduled',
            channelId: 'fb-channel-1',
            text: frozenText,
            assets: [],
          },
        ]),
    });
    const recon = await client.reconcile({
      channelId: 'fb-channel-1',
      frozenText,
      canonicalUrl: CANONICAL,
    });
    expect(recon.decision).toBe(RECONCILE_DECISION.CONFIRMED);
    expect(recon.target).toBe('ACCEPTED');
  });

  it('blocks on more than one match, never guessing which is authoritative', async () => {
    const { client } = baseClient({
      ListPosts: () =>
        listPage([
          { id: 'dup-1', status: 'sent', channelId: 'c1', text: frozenText, assets: [] },
          { id: 'dup-2', status: 'sent', channelId: 'c1', text: frozenText, assets: [] },
        ]),
    });
    const recon = await client.reconcile({ channelId: 'c1', frozenText, canonicalUrl: CANONICAL });
    expect(recon.decision).toBe(RECONCILE_DECISION.CONFLICT);
    expect(reconciliationParams(recon)).toMatchObject({
      call: 'recordReconciliation',
      kind: 'block',
    });
  });

  it('is UNCERTAIN on zero matches even after a COMPLETE listing (never proof of absence)', async () => {
    const { client } = baseClient({
      ListPosts: () =>
        listPage([{ id: 'other', status: 'sent', channelId: 'c1', text: 'unrelated', assets: [] }]),
    });
    const recon = await client.reconcile({ channelId: 'c1', frozenText, canonicalUrl: CANONICAL });
    expect(recon.decision).toBe(RECONCILE_DECISION.UNCERTAIN);
    expect(reconciliationParams(recon)).toMatchObject({ call: null });
  });

  it('is UNCERTAIN when pagination is truncated at maxPages, never treated as absence', async () => {
    const { client } = baseClient(
      {
        ListPosts: () => listPage([], true, 'cursor-1'),
      },
      {}
    );
    const recon = await client.reconcile({
      channelId: 'c1',
      frozenText,
      canonicalUrl: CANONICAL,
      maxPages: 2,
    });
    expect(recon.decision).toBe(RECONCILE_DECISION.UNCERTAIN);
    expect((recon.evidence as { pages_truncated: unknown }).pages_truncated).toBe(true);
  });

  it('paginates across pages up to maxPages, following endCursor', async () => {
    let call = 0;
    const { client, fetchImpl } = baseClient({
      ListPosts: (c) => {
        call += 1;
        const after = (c.body.variables as { after: unknown }).after;
        if (call === 1) {
          expect(after).toBeNull();
          return listPage(
            [{ id: 'p1', status: 'sent', channelId: 'c1', text: 'x', assets: [] }],
            true,
            'cursor-a'
          );
        }
        expect(after).toBe('cursor-a');
        return listPage(
          [{ id: 'match-1', status: 'sent', channelId: 'c1', text: frozenText, assets: [] }],
          false,
          null
        );
      },
    });
    const recon = await client.reconcile({ channelId: 'c1', frozenText, canonicalUrl: CANONICAL });
    expect(fetchImpl.calls).toHaveLength(2);
    expect(recon.decision).toBe(RECONCILE_DECISION.CONFIRMED);
  });

  it('matches via a link asset URL even when the text differs only if the frozen text still matches exactly', async () => {
    const { client } = baseClient({
      ListPosts: () =>
        listPage([
          {
            id: 'asset-match',
            status: 'sent',
            channelId: 'c1',
            text: frozenText,
            assets: [{ link: { url: CANONICAL } }],
          },
        ]),
    });
    const recon = await client.reconcile({ channelId: 'c1', frozenText, canonicalUrl: CANONICAL });
    expect(recon.decision).toBe(RECONCILE_DECISION.CONFIRMED);
  });
});

// --- inspectChannels / discovery ------------------------------------------

describe('createBufferClient().inspectChannels', () => {
  it('maps the "twitter" service to the "x" platform, others to their own name', async () => {
    const { client } = baseClient({
      DiscoverChannels: () =>
        jsonResponse({
          data: {
            channels: [
              { id: 'c-fb', name: 'Page', service: 'facebook' },
              { id: 'c-x', name: 'Handle', service: 'twitter' },
              { id: 'c-li', name: 'Org', service: 'linkedin' },
              { id: 'c-other', name: 'Other', service: 'instagram' },
            ],
          },
        }),
    });
    const channels = await client.inspectChannels();
    expect(channels).toEqual([
      { id: 'c-fb', name: 'Page', service: 'facebook', platform: 'facebook' },
      { id: 'c-x', name: 'Handle', service: 'twitter', platform: 'x' },
      { id: 'c-li', name: 'Org', service: 'linkedin', platform: 'linkedin' },
      { id: 'c-other', name: 'Other', service: 'instagram', platform: null },
    ]);
  });

  it('discoverOrganizations reads account.organizations', async () => {
    const { client } = baseClient({
      DiscoverOrganizations: () =>
        jsonResponse({
          data: { account: { organizations: [{ id: 'org-1', name: 'Noticiencias' }] } },
        }),
    });
    const orgs = await client.discoverOrganizations();
    expect(orgs).toEqual([{ id: 'org-1', name: 'Noticiencias' }]);
  });

  it('a 401 on discovery throws AUTH_INVALID', async () => {
    const { client } = baseClient({
      DiscoverOrganizations: () => jsonResponse({ message: 'bad key' }, 401),
    });
    await expect(client.discoverOrganizations()).rejects.toMatchObject({
      code: BUFFER_OUTCOME.AUTH_INVALID,
    });
  });
});

// --- toRecordResult --------------------------------------------------------

describe('toRecordResult', () => {
  const now = () => Date.parse('2026-09-07T12:00:00Z');

  it('published -> PUBLISHED with providerId + externalUrl', () => {
    const out = toRecordResult({
      outcome: BUFFER_OUTCOME.PUBLISHED,
      providerId: 'p1',
      externalUrl: 'https://facebook.com/p/1',
      evidence: {},
    });
    expect(out.recordResult).toMatchObject({
      status: 'PUBLISHED',
      providerId: 'p1',
      externalUrl: 'https://facebook.com/p/1',
    });
  });

  it('accepted -> ACCEPTED with providerId (state.js requires provider_id for ACCEPTED)', () => {
    const out = toRecordResult({
      outcome: BUFFER_OUTCOME.ACCEPTED,
      providerId: 'p2',
      evidence: {},
    });
    expect(out.recordResult).toMatchObject({ status: 'ACCEPTED', providerId: 'p2' });
  });

  it('channel-blocked -> ACCEPTED + providerId AND a channel-level halt', () => {
    const out = toRecordResult({
      outcome: BUFFER_OUTCOME.CHANNEL_BLOCKED,
      providerId: 'p3',
      evidence: {},
    });
    expect(out.recordResult).toMatchObject({ status: 'ACCEPTED', providerId: 'p3' });
    expect(out.halt).toBe('channel-misconfigured');
  });

  it('ambiguous -> AMBIGUOUS, no providerId required', () => {
    const out = toRecordResult({ outcome: BUFFER_OUTCOME.AMBIGUOUS, evidence: {} });
    expect(out.recordResult).toMatchObject({ status: 'AMBIGUOUS' });
  });

  it('rejected -> FAILED_PERMANENT, preserving providerId when present', () => {
    const out = toRecordResult({
      outcome: BUFFER_OUTCOME.REJECTED,
      providerId: 'p4',
      evidence: {},
    });
    expect(out.recordResult).toMatchObject({ status: 'FAILED_PERMANENT', providerId: 'p4' });
  });

  it('rate-limited -> RETRYABLE with safeToRetry true and a computed retryAt', () => {
    const out = toRecordResult(
      { outcome: BUFFER_OUTCOME.RATE_LIMITED, retryAfterMs: 5000, evidence: {} },
      { now, retryDelayMs: 60_000 }
    );
    expect(out.recordResult).toMatchObject({ status: 'RETRYABLE', safeToRetry: true });
    expect((out.recordResult as { retryAt: string }).retryAt).toBe(
      new Date(now() + 60_000).toISOString()
    );
  });

  it('auth-invalid -> a halt, no recordResult', () => {
    const out = toRecordResult({ outcome: BUFFER_OUTCOME.AUTH_INVALID, evidence: {} });
    expect(out.halt).toBe('auth-invalid');
    expect(out.recordResult).toBeUndefined();
  });

  it('throws CONFIG on an unmappable outcome', () => {
    expect(() => toRecordResult({ outcome: 'not-a-real-outcome' } as never)).toThrow(BufferError);
  });
});

// --- reconciliationParams (shape only; reconcile() tests cover behavior) --

describe('reconciliationParams', () => {
  it('never emits authorize-retry — Buffer has no safe automatic retry path', () => {
    const out = reconciliationParams({ decision: RECONCILE_DECISION.UNCERTAIN, evidence: {} });
    expect(out).not.toHaveProperty('kind');
    expect(out.call).toBeNull();
  });

  it('throws CONFIG on an unknown decision', () => {
    expect(() => reconciliationParams({ decision: 'nonsense' } as never)).toThrow(BufferError);
  });
});

// --- integration with state.js: structural AMBIGUOUS lockout --------------

describe('integration: state.js structurally blocks a Buffer retry-create from AMBIGUOUS', () => {
  function freshState() {
    return {
      schema_version: 1,
      initialized_at: '2026-01-01T00:00:00.000Z',
      revision: 0,
      last_transition_nonce: null,
      last_allocated_bluesky_micros: 0,
      proven_deploys: {},
      articles: {},
    };
  }

  function memoryStore(initial: ReturnType<typeof freshState>) {
    let doc = initial;
    let blobSha = createHash('sha256')
      .update(NodeBuffer.from(JSON.stringify(doc)))
      .digest('hex');
    return {
      async readBranchHead() {
        return { commitSha: 'head' };
      },
      async readFileAtCommit() {
        return { contentText: `${JSON.stringify(doc)}\n`, blobSha };
      },
      async putFile({ contentText }: { contentText: string }) {
        doc = JSON.parse(contentText);
        blobSha = createHash('sha256').update(NodeBuffer.from(contentText)).digest('hex');
        return { commitSha: 'head2', blobSha };
      },
      async createOrphanBranch() {
        throw new Error('not used');
      },
      current: () => doc,
    };
  }

  it('recordIntent refuses to reserve a facebook pair currently AMBIGUOUS', async () => {
    const store = memoryStore(freshState());
    const article = {
      social_id: 'a'.repeat(64),
      collection_id: 'coll-1',
      canonical_url: CANONICAL,
    };
    const session = { runId: 'run-1', attempt: 1 };
    const post = fbPost();

    const reserved = await recordIntent({
      store,
      session,
      article,
      platform: 'facebook',
      destination: { account_key: 'fb-channel-1' },
      payload: { frozenPayload: post, payloadHash: post.payload_hash, generatorVersion: 1 },
    });
    expect(reserved.outcome).toBe('applied');

    // Buffer create() is lost -> AMBIGUOUS.
    await recordResult({
      store,
      session,
      socialId: article.social_id,
      platform: 'facebook',
      intentId: (reserved as { intentId: string }).intentId,
      result: toRecordResult({ outcome: BUFFER_OUTCOME.AMBIGUOUS, evidence: {} })
        .recordResult as never,
    });

    // A fresh reservation attempt over AMBIGUOUS must be structurally refused
    // for a non-bluesky platform — never a second create.
    await expect(
      recordIntent({
        store,
        session: { runId: 'run-2', attempt: 1 },
        article,
        platform: 'facebook',
        destination: { account_key: 'fb-channel-1' },
        payload: { frozenPayload: post, payloadHash: post.payload_hash, generatorVersion: 1 },
      })
    ).rejects.toThrow(StateError);
  });
});
