import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  SEND_HALT_CONTRACT,
  STATE_MAX_BYTES,
  STATUS,
  StateError,
  allocateBlueskyMicros,
  compareAndSwap,
  createContentsStore,
  evaluateOwnerLiveness,
  initializeState,
  loadState,
  recordIntent,
  recordProvenDeploy,
  recordReconciliation,
  recordResult,
  releaseUnsentReservation,
  serializeState,
  validateState,
} from '../../scripts/social/state.js';
import { ERROR_CLASS, HttpError } from '../../scripts/social/http.js';
import { getRunStatus } from '../../scripts/social/github.js';

/**
 * Plan social-distribution §2/§3/§15: the durable ledger. Every test drives a
 * fake GitHub with mutable state that can apply a write and then lose its
 * response. No network, no real clock. Assertions check the durable state and
 * the authorization outcome, never just call counts.
 */

// --- fake GitHub store --------------------------------------------------

const sha = (text: string) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');

type PlatformEntry = Record<string, unknown>;
type ArticleEntry = {
  collection_ids: string[];
  canonical_urls: string[];
  first_seen_at: string;
  platforms: Record<string, PlatformEntry>;
};
type LedgerDoc = {
  schema_version: number;
  initialized_at: string;
  revision: number;
  last_transition_nonce: string | null;
  last_allocated_bluesky_micros: number;
  proven_deploys: Record<string, Record<string, unknown>>;
  articles: Record<string, ArticleEntry>;
};

type Ctrl = {
  /** Apply the next putFile server-side, then throw as if the response was lost. */
  loseNextPut: boolean;
  /** Throw on the next putFile *without* applying it (rejected, response lost). */
  dropNextPut: boolean;
  /** Countdown: when it reaches 0 on a readBranchHead call, that call throws. */
  failReadHeadIn: number;
  /** Make the next createOrphanBranch apply, then throw (lost response). */
  loseNextRefCreate: boolean;
  /** Run once, right after readBranchHead resolves, before readFileAtCommit. */
  afterReadBranchHead: (() => void) | null;
  /** Run once, right before a putFile is evaluated (to simulate a competing writer). */
  beforePut: (() => void) | null;
  /** Run once, after a lost putFile applied server-side but before it throws. */
  afterLostPut: (() => void) | null;
  /** Countdown: this many putFile calls throw CAS_CONFLICT without applying. */
  conflictNextPuts: number;
};

function makeStore(initialContent?: string) {
  const commits = new Map<string, string>();
  let counter = 0;
  let head: string | null = null;
  let branchExists = false;

  if (initialContent !== undefined) {
    head = `c${++counter}`;
    commits.set(head, initialContent);
    branchExists = true;
  }

  const ctrl: Ctrl = {
    loseNextPut: false,
    dropNextPut: false,
    failReadHeadIn: Infinity,
    loseNextRefCreate: false,
    afterReadBranchHead: null,
    beforePut: null,
    afterLostPut: null,
    conflictNextPuts: 0,
  };

  /** Simulate a competing transition writing the ledger out-of-band. */
  function applyExternal(mutate: (state: LedgerDoc) => void, nonce = `ext:${++counter}`) {
    const current = JSON.parse(commits.get(head as string) as string) as LedgerDoc;
    mutate(current);
    current.revision += 1;
    current.last_transition_nonce = nonce;
    head = `c${++counter}`;
    commits.set(head, `${JSON.stringify(current)}\n`);
  }

  const store = {
    async readBranchHead() {
      ctrl.failReadHeadIn -= 1;
      if (ctrl.failReadHeadIn < 0) {
        ctrl.failReadHeadIn = Infinity;
        const err = new Error('socket hang up');
        err.name = 'TimeoutError';
        throw err;
      }
      if (!branchExists) throw new StateError('BRANCH_MISSING', 'no branch');
      const result = { commitSha: head as string };
      if (ctrl.afterReadBranchHead) {
        const fn = ctrl.afterReadBranchHead;
        ctrl.afterReadBranchHead = null;
        fn();
      }
      return result;
    },
    async readFileAtCommit(commitSha: string) {
      const text = commits.get(commitSha);
      if (text === undefined) throw new StateError('FILE_MISSING', 'no file at commit');
      return { contentText: text, blobSha: sha(text) };
    },
    async putFile({
      expectedBlobSha,
      contentText,
    }: {
      expectedBlobSha: string;
      contentText: string;
      message: string;
    }) {
      if (ctrl.beforePut) {
        const fn = ctrl.beforePut;
        ctrl.beforePut = null;
        fn();
      }
      if (ctrl.conflictNextPuts > 0) {
        ctrl.conflictNextPuts -= 1;
        throw new StateError('CAS_CONFLICT', 'forced conflict', { status: 409 });
      }
      const currentBlob = sha(commits.get(head as string) as string);
      if (expectedBlobSha !== currentBlob) {
        throw new StateError('CAS_CONFLICT', 'blob sha changed', { status: 409 });
      }
      if (ctrl.dropNextPut) {
        ctrl.dropNextPut = false;
        throw new Error('ECONNRESET');
      }
      const commitSha = `c${++counter}`;
      commits.set(commitSha, contentText);
      head = commitSha;
      if (ctrl.loseNextPut) {
        ctrl.loseNextPut = false;
        if (ctrl.afterLostPut) {
          const fn = ctrl.afterLostPut;
          ctrl.afterLostPut = null;
          fn();
        }
        throw new Error('socket hang up');
      }
      return { commitSha, blobSha: sha(contentText) };
    },
    async createOrphanBranch({ contentText }: { contentText: string; message: string }) {
      if (branchExists) throw new StateError('BRANCH_EXISTS', 'exists');
      branchExists = true;
      head = `c${++counter}`;
      commits.set(head, contentText);
      if (ctrl.loseNextRefCreate) {
        ctrl.loseNextRefCreate = false;
        throw new Error('socket hang up');
      }
      return { commitSha: head };
    },
  };

  return {
    store,
    ctrl,
    applyExternal,
    current: () => JSON.parse(commits.get(head as string) as string) as LedgerDoc,
    exists: () => branchExists,
    /** Branch exists, but state.json is absent at its head commit. */
    dropFile: () => commits.delete(head as string),
  };
}

// --- fake fetch (real HTTP shapes, no network) -------------------------

type FetchCall = {
  url: string;
  init: { method?: string; headers?: Record<string, string>; body?: string };
};

/**
 * A `fetch` double that answers from a routing table keyed by
 * `"<METHOD> <path>"`. Handlers return real `Response` objects so the transport
 * in `http.js` (status classification, byte cap, redirect refusal, redaction)
 * is exercised for real.
 */
function routedFetch(routes: Record<string, (call: FetchCall) => Response | Promise<Response>>) {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: string, init: FetchCall['init'] = {}) => {
    const parsed = new URL(url);
    const call = { url, init };
    calls.push(call);
    const key = `${(init.method ?? 'GET').toUpperCase()} ${parsed.pathname}`;
    const handler = routes[key] ?? routes[`${(init.method ?? 'GET').toUpperCase()} *`];
    if (!handler) throw new Error(`routedFetch: no route for ${key}`);
    return handler(call);
  });
  return Object.assign(fn, { calls });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** GitHub Actions run/attempt/jobs responses for `getRunStatus`. */
function actionsFetch(spec: {
  notFound?: boolean;
  run?: Record<string, unknown>;
  attempt?: Record<string, unknown>;
  jobs?: Array<Record<string, unknown>>;
}) {
  return routedFetch({
    'GET *': ({ url }) => {
      if (spec.notFound) return json({ message: 'Not Found' }, 404);
      const path = new URL(url).pathname;
      if (path.endsWith('/jobs'))
        return json({ total_count: (spec.jobs ?? []).length, jobs: spec.jobs ?? [] });
      if (path.includes('/attempts/')) {
        return spec.attempt ? json(spec.attempt) : json({ message: 'Not Found' }, 404);
      }
      return json(spec.run ?? {});
    },
  });
}

// --- fixtures ---------------------------------------------------------

const ID_A = 'a'.repeat(64);
const ID_B = 'b'.repeat(64);
const RUN = { runId: '1000', attempt: 1 };
const now = () => Date.parse('2026-09-06T12:00:00Z');

function seedState(over: Partial<Record<string, unknown>> = {}): string {
  const base = {
    schema_version: 1,
    initialized_at: '2026-09-01T00:00:00.000Z',
    revision: 0,
    last_transition_nonce: null,
    last_allocated_bluesky_micros: 0,
    proven_deploys: {},
    articles: {},
    ...over,
  };
  return `${JSON.stringify(base)}\n`;
}

const freshPayload = (over: Record<string, unknown> = {}) => ({
  frozenPayload: {
    platform: 'facebook',
    text: 'Titular\n\nhttps://noticiencias.com/x/',
    account_key: 'fb-1',
  },
  payloadHash: 'p'.repeat(64),
  generatorVersion: 1,
  ...over,
});

const article = (over: Record<string, unknown> = {}) => ({
  social_id: ID_A,
  collection_id: '2026-09-06-x.md',
  canonical_url: 'https://noticiencias.com/ciencia/2026-09-06-x/',
  ...over,
});

async function reserve(
  h: ReturnType<typeof makeStore>,
  over: {
    platform?: string;
    session?: typeof RUN;
    payload?: Record<string, unknown>;
    resume?: { safeBlueskyRetry?: boolean };
    stateLimits?: { maxBytes?: number };
  } = {}
) {
  const platform = over.platform ?? 'facebook';
  const blueskyDefaults =
    platform === 'bluesky' && !over.resume?.safeBlueskyRetry
      ? {
          rkey: '3ktid',
          createdAt: '2026-09-06T12:00:00.000Z',
          blueskyMicros: Math.floor(now()) * 1000,
        }
      : {};
  return recordIntent({
    store: h.store,
    session: over.session ?? RUN,
    article: article(),
    platform,
    destination: { account_key: platform === 'bluesky' ? 'did:plc:x' : 'fb-1' },
    payload: freshPayload({ ...blueskyDefaults, ...over.payload }),
    resume: over.resume,
    stateLimits: over.stateLimits,
    now,
  });
}

// --- validation ------------------------------------------------------

describe('validateState', () => {
  it('rejects a non-object, an unknown schema version and a corrupt shape', () => {
    expect(() => validateState(null)).toThrow(StateError);
    expect(() => validateState({ schema_version: 2 })).toThrow(/schema_version/);
    expect(() => validateState({ schema_version: 1, articles: {} })).toThrow(/corrupt/);
  });

  it('rejects invalid status combinations', () => {
    const withEntry = (entry: Record<string, unknown>) =>
      validateState(
        JSON.parse(
          seedState({
            articles: {
              [ID_A]: {
                collection_ids: ['x.md'],
                canonical_urls: ['https://noticiencias.com/x/'],
                first_seen_at: '2026-09-01T00:00:00.000Z',
                platforms: { facebook: entry },
              },
            },
          })
        )
      );
    expect(() => withEntry({ status: 'NONSENSE', intent_id: 'i', account_key: 'a' })).toThrow(
      /unknown status/
    );
    expect(() => withEntry({ status: STATUS.PUBLISHING, account_key: 'a' })).toThrow(/intent_id/);
    expect(() =>
      withEntry({
        status: STATUS.ACCEPTED,
        intent_id: 'i',
        account_key: 'a',
        owner_run_id: 'r',
        owner_attempt: 1,
      })
    ).toThrow(/provider_id/);
    expect(() => withEntry({ status: STATUS.AMBIGUOUS, intent_id: 'i', account_key: 'a' })).toThrow(
      /frozen_payload/
    );
  });
});

describe('serializeState', () => {
  it('enforces the size ceiling instead of compacting', () => {
    const big = validateState(JSON.parse(seedState()));
    expect(() => serializeState(big, { maxBytes: 10 })).toThrow(/SIZE_LIMIT|ceiling/);
  });
});

// --- loadState -----------------------------------------------------

describe('loadState', () => {
  it('fails closed when the branch is absent (never a fresh install)', async () => {
    const h = makeStore();
    await expect(loadState({ store: h.store })).rejects.toMatchObject({
      code: 'STATE_NOT_INITIALIZED',
    });
  });

  it('fails closed when the branch exists but state.json is absent at its commit', async () => {
    const h = makeStore(seedState());
    h.dropFile();
    await expect(loadState({ store: h.store })).rejects.toMatchObject({
      code: 'STATE_NOT_INITIALIZED',
    });
  });

  it('reads consistently at one commit while the branch moves underneath', async () => {
    const h = makeStore(seedState());
    h.ctrl.afterReadBranchHead = () => {
      // A competing writer advances the branch between head-resolve and file-read.
      h.applyExternal((s) => {
        (s as { revision: number }).revision = 5;
      });
    };
    const { state } = await loadState({ store: h.store });
    // We must have read the *original* commit's content, not the moved one.
    expect(state.revision).toBe(0);
  });

  it('rejects corrupt JSON', async () => {
    const h = makeStore('{not json');
    await expect(loadState({ store: h.store })).rejects.toMatchObject({ code: 'CORRUPT_STATE' });
  });
});

// --- recordProvenDeploy -----------------------------------------

describe('recordProvenDeploy', () => {
  const proof = {
    repository: 'cortega26/noticiencias',
    commit: 'a'.repeat(40),
    run_id: '77',
    build_attempt: 1,
    workflow_path: '.github/workflows/deploy.yml',
    manifest_digest: 'd'.repeat(64),
  };

  it('persists a proof and is idempotent for the same digest', async () => {
    const h = makeStore(seedState());
    const first = await recordProvenDeploy({ store: h.store, session: RUN, proof, now });
    expect(first.outcome).toBe('applied');
    expect(h.current().proven_deploys['77/1/' + 'a'.repeat(40)].manifest_digest).toBe(
      'd'.repeat(64)
    );

    const again = await recordProvenDeploy({ store: h.store, session: RUN, proof, now });
    expect(again.outcome).toBe('noop');
  });
});

// --- reservations --------------------------------------------------

describe('recordIntent', () => {
  it('confirms a fresh reservation as PUBLISHING owned by the run+attempt', async () => {
    const h = makeStore(seedState());
    const res = await reserve(h);
    expect(res.outcome).toBe('applied');
    const entry = h.current().articles[ID_A].platforms.facebook;
    expect(entry.status).toBe(STATUS.PUBLISHING);
    expect(entry.owner_run_id).toBe('1000');
    expect(entry.owner_attempt).toBe(1);
    expect(entry.intent_id).toBe(res.intentId);
    expect(h.current().articles[ID_A].collection_ids).toEqual(['2026-09-06-x.md']);
  });

  it('lets only one of two contenders on the same blob SHA win; the loser sees the live owner', async () => {
    const h = makeStore(seedState());
    // While our reservation is mid-flight, a competing run reserves the same pair.
    h.ctrl.beforePut = () => {
      h.applyExternal((s) => {
        s.articles[ID_A] = {
          collection_ids: ['2026-09-06-x.md'],
          canonical_urls: ['https://noticiencias.com/ciencia/2026-09-06-x/'],
          first_seen_at: '2026-09-06T00:00:00.000Z',
          platforms: {
            facebook: {
              status: STATUS.PUBLISHING,
              account_key: 'fb-1',
              attempt_count: 1,
              owner_run_id: '2000',
              owner_attempt: 1,
              intent_id: 'other-intent',
              payload_hash: 'q'.repeat(64),
              generator_version: 1,
              frozen_payload: { text: 'other' },
              attempted_at: '2026-09-06T11:59:00.000Z',
            },
          },
        };
      });
    };
    const res = await reserve(h);
    expect(res.outcome).toBe('conflict');
    expect(res.reservedByOther).toBe(true);
    // The competitor's reservation is untouched.
    expect(h.current().articles[ID_A].platforms.facebook.intent_id).toBe('other-intent');
  });

  it('a lost PUT response that actually applied is proven via the intent id, not the global nonce', async () => {
    const h = makeStore(seedState());
    h.ctrl.loseNextPut = true;
    const res = await reserve(h);
    expect(res.outcome).toBe('applied');
    expect(h.current().articles[ID_A].platforms.facebook.intent_id).toBe(res.intentId);
  });

  it('a later transition replacing the global nonce does not hide our applied reservation', async () => {
    const h = makeStore(seedState());
    h.ctrl.loseNextPut = true;
    // Our write applies server-side; before we read back, a competing writer
    // transitions a different pair and replaces the global nonce.
    h.ctrl.afterLostPut = () => {
      h.applyExternal((s) => {
        s.articles[ID_B] = {
          collection_ids: [],
          canonical_urls: [],
          first_seen_at: '2026-09-06T00:00:00.000Z',
          platforms: {},
        };
      }, 'someone-elses-nonce');
    };
    const res = await reserve(h);
    expect(res.outcome).toBe('applied');
    expect(h.current().last_transition_nonce).toBe('someone-elses-nonce');
    expect(h.current().articles[ID_A].platforms.facebook.status).toBe(STATUS.PUBLISHING);
  });

  it('retries after a rejected (not applied) lost response and then succeeds', async () => {
    const h = makeStore(seedState());
    h.ctrl.dropNextPut = true;
    const res = await reserve(h);
    expect(res.outcome).toBe('applied');
  });

  it('returns indeterminate when the write is lost and the read-back also fails', async () => {
    const h = makeStore(seedState());
    h.ctrl.loseNextPut = true;
    h.ctrl.failReadHeadIn = 1; // the initial read succeeds; the read-back throws
    const res = await reserve(h);
    expect(res.outcome).toBe('indeterminate');
  });

  it('refuses to reserve over a changed destination', async () => {
    const h = makeStore(seedState());
    await reserve(h);
    await expect(
      recordIntent({
        store: h.store,
        session: RUN,
        article: article(),
        platform: 'facebook',
        destination: { account_key: 'fb-DIFFERENT' },
        payload: freshPayload(),
        now,
      })
    ).rejects.toMatchObject({ code: 'DESTINATION_CHANGED' });
  });

  it('refuses an automatic re-reservation of an AMBIGUOUS Buffer pair', async () => {
    const h = makeStore(seedState());
    const r = await reserve(h);
    await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId: r.intentId as string,
      result: { status: STATUS.AMBIGUOUS },
      now,
    });
    await expect(reserve(h)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('allocates a monotonic Bluesky micros value and persists it', async () => {
    const h = makeStore(seedState({ last_allocated_bluesky_micros: 999 }));
    const res = await reserve(h, { platform: 'bluesky', payload: { rkey: '3ktid' } });
    expect(res.outcome).toBe('applied');
    expect(res.blueskyMicros).toBe(Math.floor(now()) * 1000);
    expect(h.current().last_allocated_bluesky_micros).toBe(Math.floor(now()) * 1000);
    expect(h.current().articles[ID_A].platforms.bluesky.rkey).toBe('3ktid');
  });

  it('allocateBlueskyMicros is strictly increasing against the stored counter', () => {
    expect(allocateBlueskyMicros({ last_allocated_bluesky_micros: 10 } as never, 0).micros).toBe(
      11
    );
    expect(allocateBlueskyMicros({ last_allocated_bluesky_micros: 0 } as never, 5).micros).toBe(
      5000
    );
  });

  it('a fresh bluesky reservation must carry a frozen rkey, createdAt and micros', async () => {
    const h = makeStore(seedState());
    await expect(
      recordIntent({
        store: h.store,
        session: RUN,
        article: article(),
        platform: 'bluesky',
        destination: { account_key: 'did:plc:x' },
        payload: freshPayload(), // no rkey / createdAt / micros
        now,
      })
    ).rejects.toMatchObject({ code: 'CONFIG' });
    expect(h.current().articles[ID_A]).toBeUndefined();
  });

  it('a safe Bluesky retry re-reserves over AMBIGUOUS and never rewrites the frozen record', async () => {
    const h = makeStore(seedState());
    const first = await reserve(h, {
      platform: 'bluesky',
      payload: {
        rkey: 'ORIGINAL-rkey',
        createdAt: '2026-09-06T12:00:00.000Z',
        payloadHash: 'a'.repeat(64),
      },
    });
    await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'bluesky',
      intentId: first.intentId as string,
      result: { status: STATUS.AMBIGUOUS },
      now,
    });

    const retry = await recordIntent({
      store: h.store,
      session: { runId: '1001', attempt: 1 },
      article: article(),
      platform: 'bluesky',
      destination: { account_key: 'did:plc:x' },
      // Deliberately different copy/hash/rkey — must all be ignored.
      payload: freshPayload({ rkey: 'NEW-rkey', payloadHash: 'z'.repeat(64), generatorVersion: 2 }),
      resume: { safeBlueskyRetry: true },
      now,
    });
    expect(retry.outcome).toBe('applied');
    const entry = h.current().articles[ID_A].platforms.bluesky;
    expect(entry.status).toBe(STATUS.PUBLISHING);
    expect(entry.rkey).toBe('ORIGINAL-rkey');
    expect(entry.payload_hash).toBe('a'.repeat(64));
    expect(entry.generator_version).toBe(1);
    expect(entry.created_at).toBe('2026-09-06T12:00:00.000Z');
    expect(entry.attempt_count).toBe(2);
  });

  it('refuses to reserve when the projected ledger would exceed the size ceiling (no write)', async () => {
    const h = makeStore(seedState());
    const before = h.current();
    await expect(reserve(h, { stateLimits: { maxBytes: 50 } })).rejects.toMatchObject({
      code: 'SIZE_LIMIT',
    });
    expect(h.current()).toEqual(before);
  });
});

// --- results and immutability ---------------------------------

describe('recordResult', () => {
  async function reserved() {
    const h = makeStore(seedState());
    const r = await reserve(h);
    return { h, intentId: r.intentId as string };
  }

  it('PUBLISHING → ACCEPTED keeps the provider id; ACCEPTED is terminal-ish (no AMBIGUOUS regress)', async () => {
    const { h, intentId } = await reserved();
    const acc = await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId,
      result: { status: STATUS.ACCEPTED, providerId: 'buf_123' },
      now,
    });
    expect(acc.outcome).toBe('applied');
    expect(h.current().articles[ID_A].platforms.facebook.provider_id).toBe('buf_123');

    await expect(
      recordResult({
        store: h.store,
        session: RUN,
        socialId: ID_A,
        platform: 'facebook',
        intentId,
        result: { status: STATUS.AMBIGUOUS },
        now,
      })
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('PUBLISHED is terminal and drops only the frozen payload (entry + ids kept)', async () => {
    const { h, intentId } = await reserved();
    await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId,
      result: { status: STATUS.PUBLISHED, providerId: 'buf_9', externalUrl: 'https://fb/9' },
      now,
    });
    const entry = h.current().articles[ID_A].platforms.facebook;
    expect(entry.status).toBe(STATUS.PUBLISHED);
    expect(entry.frozen_payload).toBeUndefined();
    expect(entry.provider_id).toBe('buf_9');
    expect(entry.intent_id).toBe(intentId);

    await expect(
      recordResult({
        store: h.store,
        session: RUN,
        socialId: ID_A,
        platform: 'facebook',
        intentId,
        result: { status: STATUS.PUBLISHED },
        now,
      })
    ).rejects.toMatchObject({ code: 'TERMINAL' });
  });

  it('PUBLISHED is not restarted by a payload/hash/generator change or a site rollback', async () => {
    const { h, intentId } = await reserved();
    await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId,
      result: { status: STATUS.PUBLISHED, providerId: 'buf_9' },
      now,
    });
    // A new deploy changes copy → a fresh reservation attempt must be refused.
    await expect(
      recordIntent({
        store: h.store,
        session: { runId: '2000', attempt: 1 },
        article: article(),
        platform: 'facebook',
        destination: { account_key: 'fb-1' },
        payload: freshPayload({ payloadHash: 'z'.repeat(64), generatorVersion: 2 }),
        now,
      })
    ).resolves.toMatchObject({ outcome: 'noop' });
    expect(h.current().articles[ID_A].platforms.facebook.status).toBe(STATUS.PUBLISHED);
  });

  it('refuses a RETRYABLE result that cannot prove no effect (defaults to AMBIGUOUS territory)', async () => {
    const { h, intentId } = await reserved();
    await expect(
      recordResult({
        store: h.store,
        session: RUN,
        socialId: ID_A,
        platform: 'facebook',
        intentId,
        result: { status: STATUS.RETRYABLE, retryAt: '2026-09-06T13:00:00Z' },
        now,
      })
    ).rejects.toMatchObject({ code: 'UNSAFE_RETRYABLE' });
  });

  it('a superseded intent id is reported, not overwritten', async () => {
    const { h } = await reserved();
    const out = await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId: 'stale-intent',
      result: { status: STATUS.PUBLISHED },
      now,
    });
    expect(out.outcome).toBe('superseded');
  });

  it('a foreign confirmation survives a CAS conflict recompute', async () => {
    const { h, intentId } = await reserved();
    // Reserve a second platform in the same run.
    const bsky = await reserve(h, { platform: 'bluesky', payload: { rkey: 'rk' } });
    // While we persist facebook=PUBLISHED, a competing writer confirms bluesky.
    h.ctrl.beforePut = () => {
      h.applyExternal((s) => {
        s.articles[ID_A].platforms.bluesky!.status = STATUS.PUBLISHED;
      });
    };
    const res = await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId,
      result: { status: STATUS.PUBLISHED, providerId: 'buf_1' },
      now,
    });
    expect(res.outcome).toBe('applied');
    expect(h.current().articles[ID_A].platforms.bluesky.status).toBe(STATUS.PUBLISHED);
    expect(h.current().articles[ID_A].platforms.facebook.status).toBe(STATUS.PUBLISHED);
    void bsky;
  });

  it('a lost result PUT that applied is confirmed via the entry, not a retry', async () => {
    const { h, intentId } = await reserved();
    h.ctrl.loseNextPut = true;
    const res = await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId,
      result: { status: STATUS.ACCEPTED, providerId: 'buf_1' },
      now,
    });
    expect(res.outcome).toBe('applied');
    expect(h.current().articles[ID_A].platforms.facebook.status).toBe(STATUS.ACCEPTED);
  });

  it('an exhausted CAS conflict after a send is indeterminate (stop), not a skippable conflict', async () => {
    const { h, intentId } = await reserved();
    h.ctrl.conflictNextPuts = 3;
    const res = await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId,
      result: { status: STATUS.PUBLISHED, providerId: 'buf_1' },
      now,
    });
    expect(res.outcome).toBe('indeterminate');
    // The reservation is still durable and unadvanced — nothing was lost.
    expect(h.current().articles[ID_A].platforms.facebook.status).toBe(STATUS.PUBLISHING);
  });
});

// --- owner liveness -------------------------------------------

describe('evaluateOwnerLiveness', () => {
  const entry = { owner_run_id: '900', owner_attempt: 1 };

  it('is alive when this run+attempt is the owner', () => {
    expect(
      evaluateOwnerLiveness({
        entry: { owner_run_id: '1000', owner_attempt: 1 },
        runStatus: null,
        session: RUN,
      }).liveness
    ).toBe('alive');
  });

  it('keeps the lock when run status cannot be read', () => {
    expect(evaluateOwnerLiveness({ entry, runStatus: null, session: RUN }).liveness).toBe(
      'unknown'
    );
    expect(
      evaluateOwnerLiveness({ entry, runStatus: { found: false } as never, session: RUN }).liveness
    ).toBe('unknown');
  });

  it('is alive while the owner attempt is still in progress', () => {
    const runStatus = {
      found: true,
      run: { id: '900', run_attempt: 1, status: 'in_progress' },
      latestRun: { id: '900', run_attempt: 1, status: 'in_progress' },
    };
    expect(
      evaluateOwnerLiveness({ entry, runStatus: runStatus as never, session: RUN }).liveness
    ).toBe('alive');
  });

  it('is finished once the owner attempt completed, even with a rerun in progress', () => {
    const runStatus = {
      found: true,
      run: { id: '900', run_attempt: 1, status: 'completed' },
      latestRun: { id: '900', run_attempt: 2, status: 'in_progress' },
    };
    expect(
      evaluateOwnerLiveness({ entry, runStatus: runStatus as never, session: RUN }).liveness
    ).toBe('finished');
  });

  it('is finished when a later attempt superseded a purged owner-attempt view', () => {
    const runStatus = {
      found: true,
      run: null,
      latestRun: { id: '900', run_attempt: 3, status: 'in_progress' },
    };
    expect(
      evaluateOwnerLiveness({ entry, runStatus: runStatus as never, session: RUN }).liveness
    ).toBe('finished');
  });
});

// --- reconciliation ------------------------------------------

describe('recordReconciliation', () => {
  async function publishing() {
    const h = makeStore(seedState());
    const r = await reserve(h, { session: { runId: '900', attempt: 1 } });
    return { h, intentId: r.intentId as string };
  }

  it('recover-abandoned needs a proven-finished owner and only reaches AMBIGUOUS', async () => {
    const { h, intentId } = await publishing();
    await expect(
      recordReconciliation({
        store: h.store,
        session: RUN,
        socialId: ID_A,
        platform: 'facebook',
        intentId,
        kind: 'recover-abandoned',
        ownerLiveness: 'unknown',
        resolution: { actor: 'auto', reason: 'ttl' },
        now,
      })
    ).rejects.toMatchObject({ code: 'OWNER_UNKNOWN' });

    const ok = await recordReconciliation({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId,
      kind: 'recover-abandoned',
      ownerLiveness: 'finished',
      resolution: {
        actor: 'auto-recovery',
        reason: 'owner attempt completed',
        evidence: 'run 900/1 completed',
      },
      now,
    });
    expect(ok.outcome).toBe('applied');
    const entry = h.current().articles[ID_A].platforms.facebook;
    expect(entry.status).toBe(STATUS.AMBIGUOUS);
    expect(entry.frozen_payload).toBeDefined();
    expect((entry.resolution as { actor: string }).actor).toBe('auto-recovery');
  });

  it('human resolve requires the expected revision and can authorize a retry from AMBIGUOUS', async () => {
    const { h, intentId } = await publishing();
    await recordReconciliation({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId,
      kind: 'recover-abandoned',
      ownerLiveness: 'finished',
      resolution: { actor: 'auto', reason: 'x' },
      now,
    });
    const rev = (await loadState({ store: h.store })).state.revision;

    await expect(
      recordReconciliation({
        store: h.store,
        session: RUN,
        socialId: ID_A,
        platform: 'facebook',
        intentId,
        kind: 'resolve',
        action: 'authorize-retry',
        retryAt: '2026-09-06T14:00:00Z',
        expectedRevision: rev - 1,
        resolution: {
          actor: 'carlos',
          reason: 'checked buffer, nothing sent',
          evidence: 'https://buffer/...',
        },
        now,
      })
    ).rejects.toMatchObject({ code: 'REVISION_STALE' });

    const ok = await recordReconciliation({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId,
      kind: 'resolve',
      action: 'authorize-retry',
      retryAt: '2026-09-06T14:00:00Z',
      expectedRevision: rev,
      resolution: {
        actor: 'carlos',
        reason: 'checked buffer, nothing sent',
        evidence: 'https://buffer/...',
      },
      now,
    });
    expect(ok.outcome).toBe('applied');
    expect(h.current().articles[ID_A].platforms.facebook.status).toBe(STATUS.RETRYABLE);
  });

  it('never touches a PUBLISHED entry', async () => {
    const { h, intentId } = await publishing();
    await recordResult({
      store: h.store,
      session: { runId: '900', attempt: 1 },
      socialId: ID_A,
      platform: 'facebook',
      intentId,
      result: { status: STATUS.PUBLISHED, providerId: 'b' },
      now,
    });
    await expect(
      recordReconciliation({
        store: h.store,
        session: RUN,
        socialId: ID_A,
        platform: 'facebook',
        intentId,
        kind: 'block',
        resolution: { actor: 'a', reason: 'b' },
        now,
      })
    ).rejects.toMatchObject({ code: 'TERMINAL' });
  });
});

// --- releaseUnsentReservation --------------------------------

describe('releaseUnsentReservation', () => {
  it('only the exact owning run+attempt may release, and only with sendInvoked === false', async () => {
    const h = makeStore(seedState());
    const r = await reserve(h, { session: { runId: '900', attempt: 1 } });

    await expect(
      releaseUnsentReservation({
        store: h.store,
        session: { runId: '900', attempt: 1 },
        socialId: ID_A,
        platform: 'facebook',
        intentId: r.intentId as string,
        sendInvoked: true as never,
      })
    ).rejects.toMatchObject({ code: 'CONFIG' });

    await expect(
      releaseUnsentReservation({
        store: h.store,
        session: { runId: '901', attempt: 1 },
        socialId: ID_A,
        platform: 'facebook',
        intentId: r.intentId as string,
        sendInvoked: false,
      })
    ).rejects.toMatchObject({ code: 'NOT_OWNER' });

    const ok = await releaseUnsentReservation({
      store: h.store,
      session: { runId: '900', attempt: 1 },
      socialId: ID_A,
      platform: 'facebook',
      intentId: r.intentId as string,
      sendInvoked: false,
    });
    expect(ok.outcome).toBe('applied');
    // Platform sub-entry gone; the article entry and its identity index remain.
    expect(h.current().articles[ID_A].platforms.facebook).toBeUndefined();
    expect(h.current().articles[ID_A].collection_ids).toEqual(['2026-09-06-x.md']);
  });

  it('a different attempt (rerun) of the same run cannot release', async () => {
    const h = makeStore(seedState());
    const r = await reserve(h, { session: { runId: '900', attempt: 1 } });
    await expect(
      releaseUnsentReservation({
        store: h.store,
        session: { runId: '900', attempt: 2 },
        socialId: ID_A,
        platform: 'facebook',
        intentId: r.intentId as string,
        sendInvoked: false,
      })
    ).rejects.toMatchObject({ code: 'NOT_OWNER' });
  });
});

// --- crash windows -----------------------------------------

describe('crash windows (plan §15)', () => {
  it('crash after reserving, before send: next run sees PUBLISHING and treats it as unresolved', async () => {
    const h = makeStore(seedState());
    await reserve(h, { session: { runId: '900', attempt: 1 } });
    // "process died" — a new run loads and must not send blindly.
    const { state } = await loadState({ store: h.store });
    expect(state.articles[ID_A].platforms.facebook.status).toBe(STATUS.PUBLISHING);
    // A new run cannot re-reserve it while the (dead) owner still holds it.
    await expect(reserve(h, { session: { runId: '901', attempt: 1 } })).resolves.toMatchObject({
      outcome: 'conflict',
      reservedByOther: true,
    });
  });

  it('crash after send, before result: recovery marks it AMBIGUOUS once the owner is proven finished', async () => {
    const h = makeStore(seedState());
    const r = await reserve(h, { session: { runId: '900', attempt: 1 } });
    const recovered = await recordReconciliation({
      store: h.store,
      session: { runId: '901', attempt: 1 },
      socialId: ID_A,
      platform: 'facebook',
      intentId: r.intentId as string,
      kind: 'recover-abandoned',
      ownerLiveness: evaluateOwnerLiveness({
        entry: { owner_run_id: '900', owner_attempt: 1 },
        runStatus: {
          found: true,
          run: { id: '900', run_attempt: 1, status: 'completed' },
          latestRun: { id: '900', run_attempt: 1, status: 'completed' },
        } as never,
        session: { runId: '901', attempt: 1 },
      }).liveness,
      resolution: { actor: 'auto-recovery', reason: 'owner finished', evidence: 'x' },
      now,
    });
    expect(recovered.outcome).toBe('applied');
    expect(h.current().articles[ID_A].platforms.facebook.status).toBe(STATUS.AMBIGUOUS);
  });
});

// --- compareAndSwap primitive --------------------------------

describe('compareAndSwap', () => {
  it('rejects a next-state whose revision does not advance by exactly one', async () => {
    const h = makeStore(seedState());
    const { state, blobSha } = await loadState({ store: h.store });
    await expect(
      compareAndSwap({
        store: h.store,
        base: state,
        blobSha,
        nextState: { ...state, revision: state.revision + 2, last_transition_nonce: 'n' },
        nonce: 'n',
        message: 'x',
      })
    ).rejects.toMatchObject({ code: 'REVISION_NOT_ADVANCED' });
  });

  it('surfaces a conflict with the reloaded state', async () => {
    const h = makeStore(seedState());
    const { state, blobSha } = await loadState({ store: h.store });
    h.applyExternal((s) => {
      s.articles[ID_B] = {
        collection_ids: [],
        canonical_urls: [],
        first_seen_at: '2026-09-06T00:00:00.000Z',
        platforms: {},
      };
    });
    const res = await compareAndSwap({
      store: h.store,
      base: state,
      blobSha,
      nextState: { ...state, revision: state.revision + 1, last_transition_nonce: 'n' },
      nonce: 'n',
      message: 'x',
    });
    expect(res.outcome).toBe('conflict');
    expect(res.state?.articles[ID_B]).toBeDefined();
  });
});

// --- initialization ---------------------------------------

describe('initializeState', () => {
  it('creates the orphan branch once and is idempotent afterwards', async () => {
    const h = makeStore();
    const created = await initializeState({ store: h.store, now });
    expect(created.outcome).toBe('created');
    expect(created.state.revision).toBe(0);
    expect(h.exists()).toBe(true);

    const again = await initializeState({ store: h.store, now });
    expect(again.outcome).toBe('exists');
  });

  it('verifies (does not replace) a branch that already exists', async () => {
    const h = makeStore(seedState({ revision: 7 }));
    const out = await initializeState({ store: h.store, now });
    expect(out.outcome).toBe('exists');
    expect(out.state.revision).toBe(7);
  });

  it('resolves a lost ref-create response through the same read-back path', async () => {
    const h = makeStore();
    h.ctrl.loseNextRefCreate = true;
    const out = await initializeState({ store: h.store, now });
    expect(out.outcome).toBe('exists');
    expect(h.exists()).toBe(true);
  });
});

// --- persistence applied vs. authorization to send -------------------

/**
 * Plan §15/§16: "esta transición quedó persistida" and "este llamador puede
 * enviar ahora" are different questions. Every case below asserts the
 * authorization the caller received *and* the resulting durable state — never
 * the number of PUTs.
 */
describe('persistence applied is not authorization to send', () => {
  it('two concurrent reservations from the same session: exactly one may send', async () => {
    const h = makeStore(seedState());
    const [a, b] = await Promise.all([reserve(h), reserve(h)]);

    const authorized = [a, b].filter((r) => r.outcome === 'applied');
    const refused = [a, b].filter((r) => r.outcome !== 'applied');
    expect(authorized).toHaveLength(1);
    expect(refused[0]).toMatchObject({ outcome: 'conflict', reservedByOther: true });

    const entry = h.current().articles[ID_A].platforms.facebook;
    expect(entry.status).toBe(STATUS.PUBLISHING);
    expect(entry.intent_id).toBe(authorized[0].intentId);
    // The loser's rejected attempt left no trace and did not inflate the count.
    expect(entry.attempt_count).toBe(1);
  });

  it('a reservation another process already advanced to ACCEPTED is not re-authorized', async () => {
    const h = makeStore(seedState());
    h.ctrl.loseNextPut = true;
    // Our reservation applies server-side; before the read-back, the pair is
    // carried forward to ACCEPTED under a *different* intent id.
    h.ctrl.afterLostPut = () => {
      h.applyExternal((st) => {
        const e = st.articles[ID_A].platforms.facebook;
        e.status = STATUS.ACCEPTED;
        e.intent_id = 'foreign-intent';
        e.provider_id = 'buffer-99';
      }, 'foreign-nonce');
    };
    const res = await reserve(h);

    expect(res.outcome).toBe('conflict');
    expect(res.reservedByOther).toBe(true);
    expect(res.intentId).toBeUndefined();
    const entry = h.current().articles[ID_A].platforms.facebook;
    expect(entry.status).toBe(STATUS.ACCEPTED);
    expect(entry.intent_id).toBe('foreign-intent');
    expect(entry.provider_id).toBe('buffer-99');
  });

  it('a reservation another process already advanced to PUBLISHED is a no-op, never a send', async () => {
    const h = makeStore(seedState());
    h.ctrl.loseNextPut = true;
    h.ctrl.afterLostPut = () => {
      h.applyExternal((st) => {
        const e = st.articles[ID_A].platforms.facebook;
        e.status = STATUS.PUBLISHED;
        e.provider_id = 'buffer-1';
        delete e.frozen_payload;
      }, 'foreign-nonce');
    };
    const res = await reserve(h);

    expect(res.outcome).toBe('noop');
    expect(res.intentId).toBeUndefined();
    expect(h.current().articles[ID_A].platforms.facebook.status).toBe(STATUS.PUBLISHED);
  });

  it('a reservation another process already advanced to AMBIGUOUS is never auto-re-reserved', async () => {
    const h = makeStore(seedState());
    h.ctrl.loseNextPut = true;
    h.ctrl.afterLostPut = () => {
      h.applyExternal((st) => {
        st.articles[ID_A].platforms.facebook.status = STATUS.AMBIGUOUS;
      }, 'foreign-nonce');
    };
    await expect(reserve(h)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(h.current().articles[ID_A].platforms.facebook.status).toBe(STATUS.AMBIGUOUS);
  });

  it('a repeating nonce label cannot authorize a send the ledger does not back', async () => {
    const h = makeStore(seedState());
    // A pathological session whose injected nonce generator always returns the
    // same label. `last_transition_nonce` is the plan's positive proof that a
    // write landed, so it must stay unique regardless: otherwise the *previous*
    // transition's nonce would prove a rejected write "applied".
    const session = { runId: '1000', attempt: 1, newNonce: () => 'fixed-label' };
    const first = await reserve(h, { session });
    expect(first.outcome).toBe('applied');
    const firstNonce = h.current().last_transition_nonce as string;
    expect(firstNonce.startsWith('1000:1:fixed-label:')).toBe(true);
    expect(firstNonce).not.toBe('1000:1:fixed-label');

    // The next write is rejected server-side and its response is lost.
    h.ctrl.dropNextPut = true;
    const second = await reserve(h, { session, platform: 'x' });

    // Whatever the outcome, an "applied" answer must be backed by a durable
    // entry carrying that exact intent id — never by the earlier nonce alone.
    expect(h.current().last_transition_nonce).not.toBe(firstNonce);
    if (second.outcome === 'applied') {
      expect(h.current().articles[ID_A].platforms.x.intent_id).toBe(second.intentId);
      expect(h.current().articles[ID_A].platforms.x.status).toBe(STATUS.PUBLISHING);
    }
  });
});

// --- terminal states and alternative paths ---------------------------

describe('terminal states cannot be reopened by any writer', () => {
  async function accepted() {
    const h = makeStore(seedState());
    const r = await reserve(h);
    await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId: r.intentId as string,
      result: { status: STATUS.ACCEPTED, providerId: 'buffer-1' },
      now,
    });
    return { h, intentId: r.intentId as string };
  }

  it('block on an ACCEPTED entry keeps the external id and never allows a new send', async () => {
    const { h, intentId } = await accepted();
    const blocked = await recordReconciliation({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId,
      kind: 'block',
      resolution: { actor: 'operator', reason: 'channel disconnected', evidence: 'ticket-4' },
      now,
    });
    expect(blocked.outcome).toBe('applied');

    const entry = h.current().articles[ID_A].platforms.facebook;
    expect(entry.status).toBe(STATUS.BLOCKED);
    expect(entry.provider_id).toBe('buffer-1');
    // BLOCKED is not a reservable source status: no republication path.
    await expect(reserve(h)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(h.current().articles[ID_A].platforms.facebook.status).toBe(STATUS.BLOCKED);
  });

  it('block on a PUBLISHED entry is refused, leaving the confirmation intact', async () => {
    const h = makeStore(seedState());
    const r = await reserve(h);
    await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId: r.intentId as string,
      result: { status: STATUS.PUBLISHED, providerId: 'buffer-1', externalUrl: 'https://x/1' },
      now,
    });
    const revisionBefore = h.current().revision;

    for (const call of [
      { kind: 'block' as const },
      { kind: 'resolve' as const, action: 'block' as const, expectedRevision: revisionBefore },
      {
        kind: 'resolve' as const,
        action: 'authorize-retry' as const,
        expectedRevision: revisionBefore,
        retryAt: '2026-09-06T13:00:00.000Z',
      },
    ]) {
      await expect(
        recordReconciliation({
          store: h.store,
          session: RUN,
          socialId: ID_A,
          platform: 'facebook',
          intentId: r.intentId as string,
          resolution: { actor: 'operator', reason: 'r', evidence: 'e' },
          now,
          ...call,
        })
      ).rejects.toMatchObject({ code: 'TERMINAL' });
    }

    const entry = h.current().articles[ID_A].platforms.facebook;
    expect(entry.status).toBe(STATUS.PUBLISHED);
    expect(entry.external_url).toBe('https://x/1');
    expect(h.current().revision).toBe(revisionBefore);
    // And no reservation can be minted over it either.
    await expect(reserve(h)).resolves.toMatchObject({ outcome: 'noop' });
  });

  it('a late result from a superseded attempt never overwrites the current one', async () => {
    const { h, intentId } = await accepted();
    const late = await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId: 'an-older-intent',
      result: { status: STATUS.PUBLISHED, providerId: 'buffer-ghost' },
      now,
    });
    expect(late.outcome).toBe('superseded');
    const entry = h.current().articles[ID_A].platforms.facebook;
    expect(entry.status).toBe(STATUS.ACCEPTED);
    expect(entry.intent_id).toBe(intentId);
    expect(entry.provider_id).toBe('buffer-1');
  });

  it('an ACCEPTED entry refuses a second, conflicting external id', async () => {
    const { h, intentId } = await accepted();
    await expect(
      recordResult({
        store: h.store,
        session: RUN,
        socialId: ID_A,
        platform: 'facebook',
        intentId,
        result: { status: STATUS.PUBLISHED, providerId: 'buffer-2' },
        now,
      })
    ).rejects.toMatchObject({ code: 'CONFLICTING_PROVIDER_ID' });
    expect(h.current().articles[ID_A].platforms.facebook.provider_id).toBe('buffer-1');
  });
});

// --- releasing an unsent reservation ---------------------------------

describe('releaseUnsentReservation is an exception, not a lock-breaker', () => {
  it('a lost release response that applied before a newer reservation halts instead of guessing', async () => {
    const h = makeStore(seedState());
    const r = await reserve(h);
    h.ctrl.loseNextPut = true;
    // The delete applies; a later run then reserves the pair afresh before we
    // can read back. We must neither claim success nor delete the new intent.
    h.ctrl.afterLostPut = () => {
      h.applyExternal((st) => {
        st.articles[ID_A].platforms.facebook = {
          status: STATUS.PUBLISHING,
          account_key: 'fb-1',
          attempt_count: 1,
          owner_run_id: '2000',
          owner_attempt: 1,
          intent_id: 'newer-intent',
          payload_hash: 'q'.repeat(64),
          generator_version: 1,
          frozen_payload: { text: 'newer' },
          attempted_at: '2026-09-06T12:05:00.000Z',
        };
      }, 'newer-nonce');
    };

    const res = await releaseUnsentReservation({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId: r.intentId as string,
      sendInvoked: false,
    });

    expect(res.outcome).toBe('indeterminate');
    const entry = h.current().articles[ID_A].platforms.facebook;
    expect(entry.intent_id).toBe('newer-intent');
    expect(entry.status).toBe(STATUS.PUBLISHING);
  });

  it('a released reservation is really gone: later references cannot resurrect it', async () => {
    const h = makeStore(seedState());
    const r = await reserve(h);
    const released = await releaseUnsentReservation({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'facebook',
      intentId: r.intentId as string,
      sendInvoked: false,
    });
    expect(released.outcome).toBe('applied');
    expect(h.current().articles[ID_A].platforms.facebook).toBeUndefined();
    // The article entry (and its identity index) survives the sub-entry delete.
    expect(h.current().articles[ID_A].canonical_urls).toEqual([
      'https://noticiencias.com/ciencia/2026-09-06-x/',
    ]);

    // A late result for the deleted intent finds nothing to write to.
    await expect(
      recordResult({
        store: h.store,
        session: RUN,
        socialId: ID_A,
        platform: 'facebook',
        intentId: r.intentId as string,
        result: { status: STATUS.PUBLISHED, providerId: 'buffer-1' },
        now,
      })
    ).rejects.toMatchObject({ code: 'NO_RESERVATION' });
    await expect(
      recordReconciliation({
        store: h.store,
        session: RUN,
        socialId: ID_A,
        platform: 'facebook',
        intentId: r.intentId as string,
        kind: 'adopt',
        target: 'PUBLISHED',
        resolution: { actor: 'operator', reason: 'found it', evidence: 'e' },
        now,
      })
    ).rejects.toMatchObject({ code: 'NO_RESERVATION' });
    expect(h.current().articles[ID_A].platforms.facebook).toBeUndefined();

    // A fresh reservation is a *new* intent, not a revival of the old one.
    const again = await reserve(h);
    expect(again.outcome).toBe('applied');
    expect(again.intentId).not.toBe(r.intentId);
  });

  it('refuses to release a reservation the caller no longer owns', async () => {
    const h = makeStore(seedState());
    const r = await reserve(h);
    // Someone recovered it to AMBIGUOUS meanwhile: releasing would erase
    // evidence of a send that may have happened.
    h.applyExternal((st) => {
      st.articles[ID_A].platforms.facebook.status = STATUS.AMBIGUOUS;
    });
    await expect(
      releaseUnsentReservation({
        store: h.store,
        session: RUN,
        socialId: ID_A,
        platform: 'facebook',
        intentId: r.intentId as string,
        sendInvoked: false,
      })
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(h.current().articles[ID_A].platforms.facebook.status).toBe(STATUS.AMBIGUOUS);
  });
});

// --- owner liveness against the real Actions reader -------------------

/**
 * Plan §15 "Dos procesos" / "Re-run manual": a reservation belongs to one
 * run+attempt. Only a snapshot that identifies *that* run can retire it, and a
 * later rerun being alive says nothing about the owner attempt.
 */
describe('evaluateOwnerLiveness identifies the run, not just the attempt', () => {
  const entry = { owner_run_id: '900', owner_attempt: 1 };

  it('keeps the lock when the snapshot belongs to a different run', () => {
    const runStatus = {
      found: true,
      run: { id: '901', run_attempt: 1, status: 'completed' },
      latestRun: { id: '901', run_attempt: 1, status: 'completed' },
    };
    expect(
      evaluateOwnerLiveness({ entry, runStatus: runStatus as never, session: RUN })
    ).toMatchObject({ liveness: 'unknown' });
  });

  it('keeps the lock when the snapshot carries no run id at all', () => {
    const runStatus = {
      found: true,
      run: { run_attempt: 1, status: 'completed' },
      latestRun: { run_attempt: 1, status: 'completed' },
    };
    expect(
      evaluateOwnerLiveness({ entry, runStatus: runStatus as never, session: RUN }).liveness
    ).toBe('unknown');
  });

  it('a wrong-run snapshot cannot retire a reservation through recover-abandoned', async () => {
    const h = makeStore(seedState());
    const r = await reserve(h, { session: { runId: '900', attempt: 1 } });
    const liveness = evaluateOwnerLiveness({
      entry: { owner_run_id: '900', owner_attempt: 1 },
      runStatus: {
        found: true,
        run: { id: '4242', run_attempt: 1, status: 'completed' },
        latestRun: { id: '4242', run_attempt: 1, status: 'completed' },
      } as never,
      session: { runId: '901', attempt: 1 },
    }).liveness;

    await expect(
      recordReconciliation({
        store: h.store,
        session: { runId: '901', attempt: 1 },
        socialId: ID_A,
        platform: 'facebook',
        intentId: r.intentId as string,
        kind: 'recover-abandoned',
        ownerLiveness: liveness,
        resolution: { actor: 'auto-recovery', reason: 'looked done', evidence: 'x' },
        now,
      })
    ).rejects.toMatchObject({ code: 'OWNER_UNKNOWN' });
    expect(h.current().articles[ID_A].platforms.facebook.status).toBe(STATUS.PUBLISHING);
  });

  it('reads a real getRunStatus response: owner attempt completed under a live rerun', async () => {
    const fetchImpl = actionsFetch({
      run: { id: 900, run_attempt: 2, status: 'in_progress' },
      attempt: { id: 900, run_attempt: 1, status: 'completed', conclusion: 'success' },
      jobs: [],
    });
    const runStatus = await getRunStatus({
      fetchImpl,
      token: 'ghs_' + 'a'.repeat(36),
      repository: 'cortega26/noticiencias',
      runId: '900',
      attempt: 1,
    });
    // The owner attempt is done even though attempt 2 is still running.
    expect(
      evaluateOwnerLiveness({
        entry: { owner_run_id: '900', owner_attempt: 1 },
        runStatus,
        session: { runId: '901', attempt: 1 },
      })
    ).toMatchObject({ liveness: 'finished' });
    // ...and the still-running rerun is not treated as the owner.
    expect(
      evaluateOwnerLiveness({
        entry: { owner_run_id: '900', owner_attempt: 2 },
        runStatus,
        session: { runId: '901', attempt: 1 },
      })
    ).toMatchObject({ liveness: 'alive' });
  });

  it('reads a real getRunStatus response: a purged run (404) proves nothing', async () => {
    const fetchImpl = actionsFetch({ notFound: true });
    const runStatus = await getRunStatus({
      fetchImpl,
      repository: 'cortega26/noticiencias',
      runId: '900',
      attempt: 1,
    });
    expect(runStatus.found).toBe(false);
    expect(
      evaluateOwnerLiveness({
        entry: { owner_run_id: '900', owner_attempt: 1 },
        runStatus,
        session: { runId: '901', attempt: 1 },
      }).liveness
    ).toBe('unknown');
  });

  it('reads a real getRunStatus response for another run: still unknown', async () => {
    const fetchImpl = actionsFetch({
      run: { id: 4242, run_attempt: 1, status: 'completed' },
      attempt: { id: 4242, run_attempt: 1, status: 'completed' },
      jobs: [],
    });
    const runStatus = await getRunStatus({
      fetchImpl,
      repository: 'cortega26/noticiencias',
      runId: '4242',
      attempt: 1,
    });
    expect(
      evaluateOwnerLiveness({
        entry: { owner_run_id: '900', owner_attempt: 1 },
        runStatus,
        session: { runId: '901', attempt: 1 },
      }).liveness
    ).toBe('unknown');
  });
});

// --- Bluesky TID allocation is CAS-coordinated ------------------------

/**
 * Plan §14/§15: `last_allocated_bluesky_micros` lives in the ledger so the TID
 * counter is allocated under the same compare-and-swap as the reservation.
 * Two reservations derived from one snapshot must not both freeze the same
 * record key.
 */
describe('bluesky micros are allocated under CAS', () => {
  const bskyReserve = (h: ReturnType<typeof makeStore>, socialId: string, micros: number) =>
    recordIntent({
      store: h.store,
      session: RUN,
      article: {
        social_id: socialId,
        collection_id: `${socialId.slice(0, 4)}.md`,
        canonical_url: `https://noticiencias.com/ciencia/${socialId.slice(0, 4)}/`,
      },
      platform: 'bluesky',
      destination: { account_key: 'did:plc:x' },
      payload: {
        frozenPayload: { platform: 'bluesky', text: 't' },
        payloadHash: 'p'.repeat(64),
        generatorVersion: 1,
        rkey: `rkey-${micros}`,
        createdAt: '2026-09-06T12:00:00.000Z',
        blueskyMicros: micros,
      },
      now,
    });

  it('refuses a micros value another reservation already consumed', async () => {
    const h = makeStore(seedState());
    const snapshot = JSON.parse(seedState());
    // The caller allocates twice from the *same* stale snapshot.
    const first = allocateBlueskyMicros(snapshot, now()).micros;
    const second = allocateBlueskyMicros(snapshot, now()).micros;
    expect(first).toBe(second);

    const a = await bskyReserve(h, ID_A, first);
    expect(a.outcome).toBe('applied');
    expect(h.current().last_allocated_bluesky_micros).toBe(first);

    const b = await bskyReserve(h, ID_B, second);
    expect(b.outcome).toBe('stale-micros');
    expect(b.intentId).toBeUndefined();
    expect(b.nextMicros).toBeGreaterThan(first);
    // No colliding record key was frozen.
    expect(h.current().articles[ID_B]).toBeUndefined();

    // Re-minted from the value the ledger handed back, it succeeds.
    const retry = await bskyReserve(h, ID_B, b.nextMicros as number);
    expect(retry.outcome).toBe('applied');
    const rkeyA = h.current().articles[ID_A].platforms.bluesky.rkey;
    const rkeyB = h.current().articles[ID_B].platforms.bluesky.rkey;
    expect(rkeyA).not.toBe(rkeyB);
    expect(h.current().last_allocated_bluesky_micros).toBe(b.nextMicros);
  });

  it('two concurrent bluesky reservations never freeze the same record key', async () => {
    const h = makeStore(seedState());
    const snapshot = JSON.parse(seedState());
    const micros = allocateBlueskyMicros(snapshot, now()).micros;
    const [a, b] = await Promise.all([bskyReserve(h, ID_A, micros), bskyReserve(h, ID_B, micros)]);

    const applied = [a, b].filter((r) => r.outcome === 'applied');
    expect(applied).toHaveLength(1);
    expect([a, b].find((r) => r.outcome !== 'applied')?.outcome).toBe('stale-micros');
    const frozen = Object.values(h.current().articles)
      .map((art) => art.platforms.bluesky?.rkey)
      .filter(Boolean);
    expect(new Set(frozen).size).toBe(frozen.length);
  });

  it('a safe retry reuses the frozen record and needs no new micros', async () => {
    const h = makeStore(seedState());
    const micros = allocateBlueskyMicros(JSON.parse(seedState()), now()).micros;
    const first = await bskyReserve(h, ID_A, micros);
    await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'bluesky',
      intentId: first.intentId as string,
      result: { status: STATUS.AMBIGUOUS, errorClass: 'TIMEOUT' },
      now,
    });
    const before = h.current();
    const retry = await recordIntent({
      store: h.store,
      session: RUN,
      article: {
        social_id: ID_A,
        collection_id: 'aaaa.md',
        canonical_url: 'https://noticiencias.com/ciencia/aaaa/',
      },
      platform: 'bluesky',
      destination: { account_key: 'did:plc:x' },
      // A changed payload must not replace the frozen record.
      payload: {
        frozenPayload: { platform: 'bluesky', text: 'REWRITTEN' },
        payloadHash: 'z'.repeat(64),
        generatorVersion: 2,
      },
      resume: { safeBlueskyRetry: true },
      now,
    });
    expect(retry.outcome).toBe('applied');
    const entry = h.current().articles[ID_A].platforms.bluesky;
    const prev = before.articles[ID_A].platforms.bluesky;
    expect(entry.rkey).toBe(prev.rkey);
    expect(entry.created_at).toBe(prev.created_at);
    expect(entry.payload_hash).toBe(prev.payload_hash);
    expect(entry.generator_version).toBe(prev.generator_version);
    expect(entry.frozen_payload).toEqual(prev.frozen_payload);
    expect(h.current().last_allocated_bluesky_micros).toBe(micros);
  });

  it('a due RETRYABLE bluesky pair keeps its frozen rkey/createdAt/record — no new TID, no flag needed', async () => {
    const h = makeStore(seedState());
    const micros = allocateBlueskyMicros(JSON.parse(seedState()), now()).micros;
    const first = await bskyReserve(h, ID_A, micros);

    // A 429 on the put → RETRYABLE (exactly what bluesky.toRecordResult emits).
    await recordResult({
      store: h.store,
      session: RUN,
      socialId: ID_A,
      platform: 'bluesky',
      intentId: first.intentId as string,
      result: {
        status: STATUS.RETRYABLE,
        safeToRetry: true,
        retryAt: new Date(now() - 60_000).toISOString(),
      },
      now,
    });
    const before = h.current().articles[ID_A].platforms.bluesky;
    expect(before.status).toBe(STATUS.RETRYABLE);

    // The retry does NOT pass safeBlueskyRetry and does NOT mint a fresh TID:
    // a plain re-reservation of a due RETRYABLE pair. A caller that *does* hand
    // over rebuilt values must see them ignored.
    const retry = await recordIntent({
      store: h.store,
      session: { runId: '1001', attempt: 1 },
      article: {
        social_id: ID_A,
        collection_id: 'aaaa.md',
        canonical_url: 'https://noticiencias.com/ciencia/aaaa/',
      },
      platform: 'bluesky',
      destination: { account_key: 'did:plc:x' },
      payload: {
        frozenPayload: { platform: 'bluesky', text: 'REBUILT COPY' },
        payloadHash: 'e'.repeat(64),
        generatorVersion: 9,
        rkey: 'FRESH-tid-should-be-ignored',
        createdAt: '2030-01-01T00:00:00.000Z',
        blueskyMicros: micros + 5_000,
      },
      now,
    });
    expect(retry.outcome).toBe('applied');

    const after = h.current().articles[ID_A].platforms.bluesky;
    expect(after.status).toBe(STATUS.PUBLISHING);
    expect(after.rkey).toBe(before.rkey);
    expect(after.created_at).toBe(before.created_at);
    expect(after.frozen_payload).toEqual(before.frozen_payload);
    expect(after.payload_hash).toBe(before.payload_hash);
    expect(after.generator_version).toBe(before.generator_version);
    // The reused rkey consumes no micros — the counter does not move.
    expect(h.current().last_allocated_bluesky_micros).toBe(micros);
  });

  it('the FIRST bluesky reservation still must carry a frozen rkey/createdAt/micros', async () => {
    const h = makeStore(seedState());
    await expect(
      recordIntent({
        store: h.store,
        session: RUN,
        article: {
          social_id: ID_A,
          collection_id: 'aaaa.md',
          canonical_url: 'https://noticiencias.com/ciencia/aaaa/',
        },
        platform: 'bluesky',
        destination: { account_key: 'did:plc:x' },
        payload: {
          frozenPayload: { platform: 'bluesky', text: 't' },
          payloadHash: 'p'.repeat(64),
          generatorVersion: 1,
        },
        now,
      })
    ).rejects.toMatchObject({ code: 'CONFIG' });
    expect(h.current().articles[ID_A]).toBeUndefined();
  });
});

// --- the halt contract handed to the orchestrator ---------------------

describe('SEND_HALT_CONTRACT', () => {
  it('classifies every StateError code raised in state.js exactly once', () => {
    const source = readFileSync(new URL('../../scripts/social/state.js', import.meta.url), 'utf8');
    const raised = new Set(
      [...source.matchAll(/new StateError\(\s*'([A-Z_]+)'/g)].map((m) => m[1])
    );
    expect(raised.size).toBeGreaterThan(15);

    const lists = [
      SEND_HALT_CONTRACT.haltErrorCodes,
      SEND_HALT_CONTRACT.pairErrorCodes,
      SEND_HALT_CONTRACT.storeCodes,
      SEND_HALT_CONTRACT.programmingErrorCodes,
    ];
    for (const code of raised) {
      const matches = lists.filter((list) => (list as readonly string[]).includes(code));
      expect(matches, `${code} must be classified in exactly one list`).toHaveLength(1);
    }
    // And no list invents a code the module never raises.
    for (const list of lists) {
      for (const code of list) expect(raised.has(code), `${code} is not raised`).toBe(true);
    }
  });

  it('classifies every outcome and error code this module can produce', () => {
    const halt = new Set(SEND_HALT_CONTRACT.haltErrorCodes);
    const perPair = new Set(SEND_HALT_CONTRACT.pairErrorCodes);
    // A code may never be in both classes.
    for (const code of halt) expect(perPair.has(code)).toBe(false);
    // The outcomes the transitions can return are all classified.
    for (const outcome of [
      'applied',
      ...SEND_HALT_CONTRACT.haltOutcomes,
      ...SEND_HALT_CONTRACT.pairOutcomes,
    ]) {
      expect(typeof outcome).toBe('string');
    }
    expect(SEND_HALT_CONTRACT.haltOutcomes).toContain('indeterminate');
    // A TID collision is a re-mint, never a halt.
    expect(SEND_HALT_CONTRACT.pairOutcomes).toContain('stale-micros');
    expect(SEND_HALT_CONTRACT.haltOutcomes).not.toContain('stale-micros');
  });

  it('an unpersistable ledger halts, and the size ceiling cannot be lifted', async () => {
    const h = makeStore(seedState());
    // Ledger unreachable → indeterminate (halt), never a silent skip.
    h.ctrl.loseNextPut = true;
    h.ctrl.failReadHeadIn = 1;
    expect((await reserve(h)).outcome).toBe('indeterminate');

    // An injected limit may only tighten the ceiling, never raise it.
    const huge = JSON.parse(seedState());
    huge.articles[ID_A] = {
      collection_ids: ['x.md'],
      canonical_urls: ['https://noticiencias.com/x/'],
      first_seen_at: '2026-09-01T00:00:00.000Z',
      platforms: {},
      padding: 'p'.repeat(STATE_MAX_BYTES + 1),
    };
    expect(() => serializeState(huge, { maxBytes: Number.POSITIVE_INFINITY })).toThrow(StateError);
    expect(() => serializeState(huge, { maxBytes: Number.POSITIVE_INFINITY })).toThrow(
      /over the 10485760 ceiling/
    );
  });
});

// --- the real GitHub adapter, driven by a fake fetch -------------------

/**
 * Plan §15 "Lectura consistente" / "Escritura" and §18: the fake `StateStore`
 * used above proves the transition logic but never the adapter. These tests
 * drive {@link createContentsStore} through simulated HTTP — no credentials, no
 * network — and assert the exact requests it makes and how it classifies the
 * answers.
 */
describe('createContentsStore (real adapter, fake HTTP)', () => {
  const TOKEN = `ghs_${'a'.repeat(36)}`;
  const REPO = 'cortega26/noticiencias';
  const COMMIT = 'c'.repeat(40);
  const DOC = seedState();
  const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

  const store = (fetchImpl: ReturnType<typeof routedFetch>, over: Record<string, unknown> = {}) =>
    createContentsStore({ fetchImpl, token: TOKEN, repository: REPO, ...over });

  it('rejects a repository that is not owner/repo', () => {
    expect(() =>
      createContentsStore({ fetchImpl: routedFetch({}), token: TOKEN, repository: 'x' })
    ).toThrow(StateError);
  });

  it('resolves HEAD and reads the file pinned to that exact commit', async () => {
    const fetchImpl = routedFetch({
      'GET /repos/cortega26/noticiencias/git/ref/heads/social-state': () =>
        json({ object: { sha: COMMIT, type: 'commit' } }),
      'GET /repos/cortega26/noticiencias/contents/state.json': () =>
        json({ sha: 'blob-1', encoding: 'base64', content: b64(DOC), size: DOC.length }),
    });
    const s = store(fetchImpl);
    const head = await s.readBranchHead();
    expect(head.commitSha).toBe(COMMIT);

    const file = await s.readFileAtCommit(head.commitSha);
    expect(file).toEqual({ contentText: DOC, blobSha: 'blob-1' });
    // The read is pinned to the commit, not to the branch tip.
    expect(new URL(fetchImpl.calls[1].url).searchParams.get('ref')).toBe(COMMIT);
    expect(fetchImpl.calls[0].init.headers?.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(fetchImpl.calls[0].init.headers?.['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('falls back to the raw representation for a large file, keeping the blob sha', async () => {
    // > 1 MiB: the JSON form omits `content` but still carries the blob sha.
    const big = `${JSON.stringify({ ...JSON.parse(DOC), big: 'x'.repeat(64) })}\n`;
    const fetchImpl = routedFetch({
      'GET /repos/cortega26/noticiencias/contents/state.json': ({ init }) =>
        init.headers?.Accept === 'application/vnd.github.raw'
          ? new Response(big, { status: 200, headers: { 'Content-Type': 'text/plain' } })
          : json({ sha: 'blob-big', encoding: 'none', content: '', size: 2_000_000 }),
    });
    const file = await store(fetchImpl).readFileAtCommit(COMMIT);

    expect(file.contentText).toBe(big);
    expect(file.blobSha).toBe('blob-big');
    // Both reads target the same immutable commit — never a mixed body/sha pair.
    expect(fetchImpl.calls).toHaveLength(2);
    for (const call of fetchImpl.calls) {
      expect(new URL(call.url).searchParams.get('ref')).toBe(COMMIT);
    }
    expect(fetchImpl.calls[0].init.headers?.Accept).toBe('application/vnd.github+json');
    expect(fetchImpl.calls[1].init.headers?.Accept).toBe('application/vnd.github.raw');
  });

  it('reports a missing branch and a missing file distinctly', async () => {
    const missing = routedFetch({ 'GET *': () => json({ message: 'Not Found' }, 404) });
    const s = store(missing);
    await expect(s.readBranchHead()).rejects.toMatchObject({ code: 'BRANCH_MISSING' });
    await expect(s.readFileAtCommit(COMMIT)).rejects.toMatchObject({ code: 'FILE_MISSING' });
    // …and `loadState` turns both into the fail-closed code, never a fresh install.
    await expect(loadState({ store: s })).rejects.toMatchObject({ code: 'STATE_NOT_INITIALIZED' });
  });

  it('writes the file with the branch, path, expected blob sha and base64 content', async () => {
    const fetchImpl = routedFetch({
      'PUT /repos/cortega26/noticiencias/contents/state.json': () =>
        json({ commit: { sha: 'commit-2' }, content: { sha: 'blob-2' } }),
    });
    const written = await store(fetchImpl).putFile({
      expectedBlobSha: 'blob-1',
      contentText: DOC,
      message: 'social-state: reserve',
    });
    expect(written).toEqual({ commitSha: 'commit-2', blobSha: 'blob-2' });

    const call = fetchImpl.calls[0];
    expect(call.init.method).toBe('PUT');
    expect(new URL(call.url).pathname).toBe('/repos/cortega26/noticiencias/contents/state.json');
    const body = JSON.parse(call.init.body as string);
    expect(body).toMatchObject({
      branch: 'social-state',
      sha: 'blob-1',
      message: 'social-state: reserve',
    });
    expect(Buffer.from(body.content, 'base64').toString('utf8')).toBe(DOC);
  });

  it('maps 409 and 422 to a CAS conflict, and other failures to transport errors', async () => {
    for (const status of [409, 422]) {
      const f = routedFetch({ 'PUT *': () => json({ message: 'conflict' }, status) });
      await expect(
        store(f).putFile({ expectedBlobSha: 'b', contentText: DOC, message: 'm' })
      ).rejects.toMatchObject({ code: 'CAS_CONFLICT', detail: { status } });
    }
    // A permissions failure is NOT a conflict: it must not be retried as one.
    const forbidden = routedFetch({
      'PUT *': () => json({ message: 'Resource not accessible' }, 403),
    });
    await expect(
      store(forbidden).putFile({ expectedBlobSha: 'b', contentText: DOC, message: 'm' })
    ).rejects.toBeInstanceOf(HttpError);
    const server = routedFetch({ 'PUT *': () => json({ message: 'boom' }, 500) });
    await expect(
      store(server).putFile({ expectedBlobSha: 'b', contentText: DOC, message: 'm' })
    ).rejects.toMatchObject({ errorClass: ERROR_CLASS.SERVER_ERROR });
  });

  it('refuses malformed store responses instead of inventing shas', async () => {
    const noRefSha = routedFetch({ 'GET *': () => json({ object: {} }) });
    await expect(store(noRefSha).readBranchHead()).rejects.toMatchObject({
      code: 'MALFORMED_STORE_RESPONSE',
    });
    const noFileSha = routedFetch({
      'GET *': () => json({ encoding: 'base64', content: b64(DOC) }),
    });
    await expect(store(noFileSha).readFileAtCommit(COMMIT)).rejects.toMatchObject({
      code: 'MALFORMED_STORE_RESPONSE',
    });
    const noCommit = routedFetch({ 'PUT *': () => json({ content: { sha: 'blob-2' } }) });
    await expect(
      store(noCommit).putFile({ expectedBlobSha: 'b', contentText: DOC, message: 'm' })
    ).rejects.toMatchObject({ code: 'MALFORMED_STORE_RESPONSE' });
    // A 200 whose body is not JSON is a transport failure, not a silent success.
    const html = routedFetch({ 'PUT *': () => new Response('<html>502</html>', { status: 200 }) });
    await expect(
      store(html).putFile({ expectedBlobSha: 'b', contentText: DOC, message: 'm' })
    ).rejects.toMatchObject({ errorClass: ERROR_CLASS.MALFORMED_RESPONSE });
  });

  it('a write that applied but lost its response is proven through the read-back', async () => {
    let stored = DOC;
    let blob = 'blob-1';
    let commit = COMMIT;
    const fetchImpl = routedFetch({
      'GET /repos/cortega26/noticiencias/git/ref/heads/social-state': () =>
        json({ object: { sha: commit } }),
      'GET /repos/cortega26/noticiencias/contents/state.json': () =>
        json({ sha: blob, encoding: 'base64', content: b64(stored) }),
      'PUT /repos/cortega26/noticiencias/contents/state.json': ({ init }) => {
        // Apply server-side, then drop the response.
        stored = Buffer.from(JSON.parse(init.body as string).content, 'base64').toString('utf8');
        blob = 'blob-2';
        commit = 'd'.repeat(40);
        throw Object.assign(new Error('socket hang up'), { name: 'TimeoutError' });
      },
    });
    const s = store(fetchImpl);
    const loaded = await loadState({ store: s });
    const next = { ...loaded.state, revision: 1, last_transition_nonce: 'run:1:proof' };
    const res = await compareAndSwap({
      store: s,
      base: loaded.state,
      blobSha: loaded.blobSha,
      nextState: next,
      nonce: 'run:1:proof',
      message: 'm',
    });
    expect(res.outcome).toBe('applied');
    expect(res.state?.last_transition_nonce).toBe('run:1:proof');
    expect(JSON.parse(stored).revision).toBe(1);
  });

  it('creates the orphan branch through blob → tree → parentless commit → ref', async () => {
    const fetchImpl = routedFetch({
      'GET /repos/cortega26/noticiencias/git/ref/heads/social-state': () =>
        json({ message: 'Not Found' }, 404),
      'POST /repos/cortega26/noticiencias/git/blobs': () => json({ sha: 'blob-sha' }),
      'POST /repos/cortega26/noticiencias/git/trees': () => json({ sha: 'tree-sha' }),
      'POST /repos/cortega26/noticiencias/git/commits': () => json({ sha: 'commit-sha' }),
      'POST /repos/cortega26/noticiencias/git/refs': () =>
        json({ ref: 'refs/heads/social-state' }, 201),
    });
    const created = await store(fetchImpl).createOrphanBranch({
      contentText: DOC,
      message: 'init',
    });
    expect(created.commitSha).toBe('commit-sha');

    const bodies = fetchImpl.calls
      .filter((c) => c.init.method === 'POST')
      .map((c) => JSON.parse(c.init.body as string));
    expect(Buffer.from(bodies[0].content, 'base64').toString('utf8')).toBe(DOC);
    expect(bodies[1].tree).toEqual([
      { path: 'state.json', mode: '100644', type: 'blob', sha: 'blob-sha' },
    ]);
    expect(bodies[2]).toMatchObject({ tree: 'tree-sha', parents: [] });
    expect(bodies[3]).toEqual({ ref: 'refs/heads/social-state', sha: 'commit-sha' });
  });

  it('a ref-create race with an existing branch verifies instead of replacing', async () => {
    const fetchImpl = routedFetch({
      'GET /repos/cortega26/noticiencias/git/ref/heads/social-state': (() => {
        let first = true;
        return () => {
          if (first) {
            first = false;
            return json({ message: 'Not Found' }, 404); // absent when init starts
          }
          return json({ object: { sha: COMMIT } }); // the winner created it meanwhile
        };
      })(),
      'GET /repos/cortega26/noticiencias/contents/state.json': () =>
        json({ sha: 'blob-1', encoding: 'base64', content: b64(DOC) }),
      'POST /repos/cortega26/noticiencias/git/blobs': () => json({ sha: 'blob-sha' }),
      'POST /repos/cortega26/noticiencias/git/trees': () => json({ sha: 'tree-sha' }),
      'POST /repos/cortega26/noticiencias/git/commits': () => json({ sha: 'commit-sha' }),
      'POST /repos/cortega26/noticiencias/git/refs': () =>
        json({ message: 'Reference already exists' }, 422),
    });
    const res = await initializeState({ store: store(fetchImpl), now });
    expect(res.outcome).toBe('exists');
    expect(res.state.revision).toBe(0);
  });

  it('a lost ref-create response resolves through the same read-back path', async () => {
    let branchExists = false;
    const fetchImpl = routedFetch({
      'GET /repos/cortega26/noticiencias/git/ref/heads/social-state': () =>
        branchExists ? json({ object: { sha: COMMIT } }) : json({ message: 'Not Found' }, 404),
      'GET /repos/cortega26/noticiencias/contents/state.json': () =>
        json({ sha: 'blob-1', encoding: 'base64', content: b64(DOC) }),
      'POST /repos/cortega26/noticiencias/git/blobs': () => json({ sha: 'blob-sha' }),
      'POST /repos/cortega26/noticiencias/git/trees': () => json({ sha: 'tree-sha' }),
      'POST /repos/cortega26/noticiencias/git/commits': () => json({ sha: 'commit-sha' }),
      'POST /repos/cortega26/noticiencias/git/refs': () => {
        branchExists = true; // applied server-side…
        throw Object.assign(new Error('socket hang up'), { name: 'TimeoutError' }); // …response lost
      },
    });
    const res = await initializeState({ store: store(fetchImpl), now });
    expect(res.outcome).toBe('exists');
    expect(res.state.schema_version).toBe(1);
  });

  it('applies the request timeout and the response size cap', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    try {
      const ok = routedFetch({ 'GET *': () => json({ object: { sha: COMMIT } }) });
      await store(ok).readBranchHead();
      expect(spy).toHaveBeenLastCalledWith(15_000);
      await store(ok, { timeoutMs: 5_000 }).readBranchHead();
      expect(spy).toHaveBeenLastCalledWith(5_000);
    } finally {
      spy.mockRestore();
    }

    // A body past the adapter's 12 MiB cap is refused while streaming.
    const chunk = new Uint8Array(1024 * 1024);
    const oversized = routedFetch({
      'GET *': () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.enqueue(chunk);
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
    });
    await expect(store(oversized).readBranchHead()).rejects.toMatchObject({
      errorClass: ERROR_CLASS.RESPONSE_TOO_LARGE,
    });
  });

  it('never leaks the token into an error message', async () => {
    const leaky = routedFetch({
      'GET *': () => {
        throw new Error(`connect failed while sending Bearer ${TOKEN}`);
      },
    });
    const error = (await store(leaky)
      .readBranchHead()
      .then(
        () => null,
        (e: unknown) => e
      )) as HttpError;
    expect(error).toBeInstanceOf(HttpError);
    expect(error.message).not.toContain(TOKEN);
    expect(error.sanitizedMessage).not.toContain(TOKEN);
    expect(error.message).toContain('[REDACTED]');
  });

  it('refuses to follow a redirect away from the API host', async () => {
    const redirect = routedFetch({
      'GET *': () =>
        new Response(null, { status: 302, headers: { location: 'https://evil.test/' } }),
    });
    await expect(store(redirect).readBranchHead()).rejects.toMatchObject({
      errorClass: ERROR_CLASS.REDIRECT_DISALLOWED,
    });
  });
});
