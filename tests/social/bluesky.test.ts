import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';

import {
  BlueskyError,
  PUBLISH_OUTCOME,
  RECONCILE_DECISION,
  THUMB_MAX_BYTES,
  canonicalJson,
  createBlueskyClient,
  diffRecords,
  encodeTid,
  isBlobRef,
  mintClockId,
  prepareRecord,
  reconciliationParams,
  toRecordResult,
} from '../../scripts/social/providers/bluesky.js';
import { makeSocialPost } from '../../scripts/social/content.js';
import {
  StateError,
  allocateBlueskyMicros,
  loadState,
  recordIntent,
  recordReconciliation,
  recordResult,
  serializeState,
  validateState,
} from '../../scripts/social/state.js';

/**
 * Plan social-distribution §6 / §10 / §12 / §14 / §15 / §17: the direct Bluesky
 * adapter.
 *
 * The master plan was recovered from the session transcripts and is kept at
 * `../SOCIAL_DISTRIBUTION_IMPLEMENTATION_PLAN.md` (the `noticiencias/` product
 * root, alongside both repos). These tests follow it and the real `http.js` /
 * `content.js` / `state.js` contracts. Every `fetch` is a fake router — no
 * network, no clock, no waiting. Fakes are deterministic; the `integration`
 * block wires the adapter to the real `content.js` and `state.js` (including
 * `recordReconciliation`) so the tests are not just invented shapes.
 *
 * The `describe` blocks mirror the brief's ten mandatory-test bullets.
 */

// --- fakes ------------------------------------------------------------

type Init = { method?: string; headers?: Record<string, string>; body?: unknown };
type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
type Handler = (call: Call) => Response | Promise<Response>;

const sha = (text: string) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');

function lower(headers?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers ?? {})) out[k.toLowerCase()] = String(v);
  return out;
}

/** Route a fake `fetch` by XRPC nsid (URL substring). Records every call. */
function router(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init: Init = {}) => {
    const call: Call = {
      url,
      method: init.method ?? 'GET',
      headers: lower(init.headers),
      body: init.body,
    };
    calls.push(call);
    for (const [needle, handler] of Object.entries(routes)) {
      if (url.includes(needle)) return handler(call);
    }
    throw new Error(`router: no route for ${url}`);
  });
  return Object.assign(fn, {
    calls,
    hit: (needle: string) => calls.filter((c) => c.url.includes(needle)),
  });
}

const jsonResponse = (obj: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

// --- constants ------------------------------------------------------

const SERVICE = 'https://pds.example.com';
const DID = `did:plc:${'a'.repeat(24)}`;
const OTHER_DID = `did:plc:${'b'.repeat(24)}`;
const APP_PASSWORD = 'test-pass-word-0000';
const CANONICAL = 'https://noticiencias.com/ciencia/eclipse/';
const FIXED_CREATED_AT = '2026-09-07T12:00:00.000Z';
const NOW_MS = 1_756_000_000_000;

const sessionOk: Handler = () =>
  jsonResponse({
    did: DID,
    handle: 'noticiencias.example',
    accessJwt: 'access-aaaa',
    refreshJwt: 'refresh-aaaa',
  });

function baseClient(routes: Record<string, Handler>, over: Record<string, unknown> = {}) {
  const fetchImpl = router(routes);
  const client = createBlueskyClient({
    fetchImpl,
    service: SERVICE,
    did: DID,
    appPassword: APP_PASSWORD,
    ...over,
  });
  return { client, fetchImpl };
}

function blueskyPost(over: Record<string, unknown> = {}) {
  return makeSocialPost(
    {
      title: 'Los físicos miden la duración del eclipse solar total',
      description: 'Un estudio internacional describe el fenómeno en detalle.',
      canonical_url: CANONICAL,
      ...over,
    },
    { platform: 'bluesky', account_key: 'bsky-main' }
  );
}

function freshState(over: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    initialized_at: '2026-01-01T00:00:00.000Z',
    revision: 0,
    last_transition_nonce: null,
    last_allocated_bluesky_micros: 0,
    proven_deploys: {},
    articles: {},
    ...over,
  };
}

function fakeLedger(initial: Record<string, unknown>) {
  let text = serializeState(initial as never).text;
  let blob = sha(text);
  let n = 1;
  let commit = 'c1';

  const store = {
    async readBranchHead() {
      return { commitSha: commit };
    },
    async readFileAtCommit(_commitSha: string) {
      return { contentText: text, blobSha: blob };
    },
    async putFile({
      expectedBlobSha,
      contentText,
    }: {
      expectedBlobSha: string;
      contentText: string;
      message: string;
    }) {
      if (expectedBlobSha !== blob) throw new StateError('CAS_CONFLICT', 'blob moved');
      text = contentText;
      blob = sha(text);
      commit = `c${++n}`;
      return { commitSha: commit, blobSha: blob };
    },
    async createOrphanBranch() {
      throw new StateError('BRANCH_EXISTS', 'branch exists');
    },
  };

  return {
    store,
    peek: () => JSON.parse(text) as Record<string, unknown>,
    external(mutate: (s: Record<string, unknown>) => void) {
      const s = JSON.parse(text);
      mutate(s);
      text = `${JSON.stringify(s)}\n`;
      blob = sha(text);
      commit = `c${++n}`;
    },
  };
}

// =====================================================================
// 1. Session reuse, wrong DID, bounded refresh, errors without secrets
// =====================================================================

describe('1. authentication', () => {
  it('reuses one session across operations (a single createSession call)', async () => {
    const { client, fetchImpl } = baseClient({
      'com.atproto.server.createSession': sessionOk,
    });

    await client.ensureSession();
    await client.ensureSession();
    await client.ensureSession();

    expect(fetchImpl.hit('com.atproto.server.createSession')).toHaveLength(1);
  });

  it('rejects a createSession response whose DID is not the configured one, and stores nothing', async () => {
    const { client, fetchImpl } = baseClient({
      'com.atproto.server.createSession': () =>
        jsonResponse({ did: OTHER_DID, accessJwt: 'access-x', refreshJwt: 'refresh-x' }),
    });

    await expect(client.ensureSession()).rejects.toMatchObject({
      name: 'BlueskyError',
      code: PUBLISH_OUTCOME.AUTH_INVALID,
    });

    // No session was stored → a second attempt hits the network again.
    await expect(client.ensureSession()).rejects.toBeInstanceOf(BlueskyError);
    expect(fetchImpl.hit('com.atproto.server.createSession')).toHaveLength(2);
  });

  it('renews a carried session but only within the bounded refresh budget', async () => {
    const { client, fetchImpl } = baseClient(
      {
        'com.atproto.server.refreshSession': () =>
          jsonResponse({ did: DID, accessJwt: 'access-r1', refreshJwt: 'refresh-r1' }),
      },
      { session: { refreshJwt: 'refresh-carried' }, maxRefreshes: 1 }
    );

    // First use: no live token + a carried refresh token → one refresh.
    await client.ensureSession();
    expect(fetchImpl.hit('com.atproto.server.refreshSession')).toHaveLength(1);

    // A second forced refresh is over budget → session-expired, no extra call.
    await expect(client.ensureSession({ refresh: true })).rejects.toMatchObject({
      code: PUBLISH_OUTCOME.SESSION_EXPIRED,
    });
    expect(fetchImpl.hit('com.atproto.server.refreshSession')).toHaveLength(1);
  });

  it('scrubs the app password out of a transport failure message', async () => {
    const { client } = baseClient({
      'com.atproto.server.createSession': () => {
        const err = new Error(`upstream refused password ${APP_PASSWORD}`);
        err.name = 'TimeoutError';
        return Promise.reject(err);
      },
    });

    const error = (await client.ensureSession().catch((e) => e)) as BlueskyError;
    expect(error).toBeInstanceOf(BlueskyError);
    expect(error.message).not.toContain(APP_PASSWORD);
    expect(error.message).toContain('[REDACTED]');
  });

  it('never opens a session at import / construction time', async () => {
    const { fetchImpl } = baseClient({ 'com.atproto.server.createSession': sessionOk });
    expect(fetchImpl.calls).toHaveLength(0);
  });
});

// =====================================================================
// 2. TID encoding + stale-micros proposal before a reservation
// =====================================================================

describe('2. TID encoding', () => {
  it('encodes independent hand-derived vectors', () => {
    // n = 0 → all-zero groups.
    expect(encodeTid(0, 0)).toBe('2222222222222');
    // n = 1 (clock id in the low bit) → last base32 digit is index 1.
    expect(encodeTid(0, 1)).toBe('2222222222223');
    // micros = 1 sets bit 10 (just above the 10-bit clock field):
    //   n = 1 << 10 = 0b100_00000000
    //   groups of 5 bits from the LSB: [0, 0, 1, 0, …] → third-from-last digit is 1.
    expect(encodeTid(1, 0)).toBe('2222222222322');
    // clock id all-ones → two trailing 'z' (index 31 of the 32-char alphabet).
    expect(encodeTid(0, 1023)).toBe('22222222222zz');
  });

  it('is length-13 and base32-sortable (monotone in micros)', () => {
    const a = encodeTid(1_756_000_000_000_000, 42);
    const b = encodeTid(1_756_000_000_000_001, 42);
    const c = encodeTid(1_756_000_000_000_001, 7);
    expect(a).toHaveLength(13);
    expect(a < b).toBe(true);
    // same micros, different clock id → still ordered, never equal.
    expect(c === b).toBe(false);
    // top bit is always 0 → first digit lands in the first half of the alphabet.
    // eslint-disable-next-line no-secrets/no-secrets -- first 16 base32-sortable symbols
    expect('234567abcdefghij'.includes(a[0])).toBe(true);
  });

  it('refuses a micros value that does not fit the 53-bit timestamp field', () => {
    expect(() => encodeTid(2n ** 53n, 0)).toThrow(/53-bit/);
    expect(() => encodeTid(0, 1024)).toThrow(/10-bit/);
  });

  it('mintClockId stays inside the 10-bit range', () => {
    expect(mintClockId({ rng: () => 0 })).toBe(0);
    expect(mintClockId({ rng: () => 0.9999999 })).toBe(1023);
    for (let i = 0; i < 50; i += 1) {
      const c = mintClockId();
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(1024);
    }
  });

  it('prepareRecord is strictly pure: a missing clockId or createdAt is a CONFIG error, never a clock/RNG fallback', () => {
    const post = blueskyPost();
    expect(() =>
      // @ts-expect-error — deliberately omitting the now-required clockId
      prepareRecord({ post, blueskyMicros: 1_756_000_000_000_123, createdAt: FIXED_CREATED_AT })
    ).toThrow(/clockId is required/);
    expect(() =>
      // @ts-expect-error — deliberately omitting the now-required createdAt
      prepareRecord({ post, blueskyMicros: 1_756_000_000_000_123, clockId: 3 })
    ).toThrow(/createdAt is required/);
    // both present → deterministic, and identical inputs give byte-identical records
    const a = prepareRecord({
      post,
      blueskyMicros: 1_756_000_000_000_123,
      clockId: 3,
      createdAt: FIXED_CREATED_AT,
    });
    const b = prepareRecord({
      post,
      blueskyMicros: 1_756_000_000_000_123,
      clockId: 3,
      createdAt: FIXED_CREATED_AT,
    });
    expect(a.rkey).toMatch(/^[234567a-z]{13}$/);
    expect(a.rkey).toBe(b.rkey);
    expect(canonicalJson(a.record)).toBe(canonicalJson(b.record));
  });

  it('mintClockId is the only place randomness enters TID minting', () => {
    // The value generator is separate from the deterministic transform.
    expect(mintClockId({ rng: () => 0.5 })).toBe(512);
    const prep = prepareRecord({
      post: blueskyPost(),
      blueskyMicros: 1_756_000_000_000_123,
      clockId: mintClockId({ rng: () => 0.5 }),
      createdAt: FIXED_CREATED_AT,
    });
    expect(prep.rkey).toBe(encodeTid(1_756_000_000_000_123, 512));
  });

  it('a stale-micros result before reserving lets a fresh proposal be prepared with the same payload_hash', async () => {
    const ledger = fakeLedger(freshState({ last_allocated_bluesky_micros: 5_000_000_000_000_000 }));
    const post = blueskyPost();

    const loaded = await loadState({ store: ledger.store });
    const micros = allocateBlueskyMicros(loaded.state, NOW_MS).micros;
    const prep1 = prepareRecord({
      post,
      blueskyMicros: micros,
      clockId: 7,
      createdAt: FIXED_CREATED_AT,
    });

    // Another reservation consumed that micros value out-of-band.
    ledger.external((s) => {
      s.last_allocated_bluesky_micros = micros + 100;
      s.revision = Number(s.revision) + 1;
    });

    const res = await recordIntent({
      store: ledger.store,
      session: { runId: 'run-1', attempt: 1 },
      article: { social_id: 'a'.repeat(64), collection_id: 'col-1', canonical_url: CANONICAL },
      platform: 'bluesky',
      destination: { account_key: 'bsky-main' },
      payload: {
        frozenPayload: prep1.record,
        payloadHash: post.payload_hash,
        generatorVersion: post.generator_version,
        rkey: prep1.rkey,
        createdAt: prep1.created_at,
        blueskyMicros: micros,
      },
      now: () => NOW_MS,
    });

    expect(res.outcome).toBe('stale-micros');
    expect(res.nextMicros).toBeGreaterThan(micros);

    const prep2 = prepareRecord({
      post,
      blueskyMicros: res.nextMicros as number,
      clockId: 7,
      createdAt: FIXED_CREATED_AT,
    });

    // New rkey; byte-identical record (rkey is a sibling field, not in the
    // record) and an unchanged content-level payload hash.
    expect(prep2.rkey).not.toBe(prep1.rkey);
    expect(canonicalJson(prep2.record)).toBe(canonicalJson(prep1.record));
    expect(post.payload_hash).toBe(blueskyPost().payload_hash);
  });
});

// =====================================================================
// 3. Facets with Unicode and a label that also appears in the title
// =====================================================================

describe('3. facets', () => {
  it('points the link facet at the trailing label, not an earlier occurrence in the title', () => {
    const post = blueskyPost({
      title: '🔬 Cobertura en noticiencias.com del eclipse solar total de 2027',
      description: '',
    });
    const prep = prepareRecord({
      post,
      blueskyMicros: 1_000_000,
      clockId: 1,
      createdAt: FIXED_CREATED_AT,
    });

    const { byteStart, byteEnd } = prep.record.facets[0].index;
    const bytes = Buffer.from(post.text, 'utf8');
    expect(bytes.subarray(byteStart, byteEnd).toString('utf8')).toBe('noticiencias.com');

    // The title's own "noticiencias.com" starts earlier; the emoji makes the
    // byte offset strictly larger than the UTF-16 index, so this is a real
    // byte-offset check, not an indexOf in disguise.
    const firstOccurrenceBytes = Buffer.from(
      post.text.slice(0, post.text.indexOf('noticiencias.com')),
      'utf8'
    ).length;
    const lastOccurrenceBytes = Buffer.from(
      post.text.slice(0, post.text.lastIndexOf('noticiencias.com')),
      'utf8'
    ).length;
    expect(byteStart).toBe(lastOccurrenceBytes);
    expect(byteStart).toBeGreaterThan(firstOccurrenceBytes);
    expect(prep.record.facets[0].features[0]).toEqual({
      $type: 'app.bsky.richtext.facet#link',
      uri: CANONICAL,
    });
  });

  it('throws when the supplied byte offsets do not decode to the label', () => {
    const post = blueskyPost({ title: '🔬 Estudio del clima', description: '' });
    const broken = {
      ...post,
      link_card: { ...post.link_card, label_byte_start: 0, label_byte_end: 4 },
    } as typeof post;
    expect(() =>
      prepareRecord({ post: broken, blueskyMicros: 1, clockId: 1, createdAt: FIXED_CREATED_AT })
    ).toThrow(/do not land on link_card\.label/);
  });
});

// =====================================================================
// 4. Thumbnail: valid, too large, wrong format, upload failure (pre-freeze)
// =====================================================================

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const jpegBytes = (size: number) =>
  Buffer.concat([JPEG_MAGIC, Buffer.alloc(Math.max(0, size - 3))]);

const IMAGE_URL = 'https://noticiencias.com/images/eclipse.jpg';
const verifiedImage = { url: IMAGE_URL, content_type: 'image/jpeg', bytes: 40_000 };

describe('4. thumbnail (before the record is frozen)', () => {
  it('uploads a valid JPEG and returns a blob ref', async () => {
    const okBytes = jpegBytes(40_000);
    const { client, fetchImpl } = baseClient({
      'com.atproto.server.createSession': sessionOk,
      '/images/eclipse.jpg': () =>
        new Response(okBytes, { status: 200, headers: { 'content-type': 'image/jpeg' } }),
      'com.atproto.repo.uploadBlob': () =>
        jsonResponse({
          blob: {
            $type: 'blob',
            ref: { $link: `bafy${'k'.repeat(20)}` },
            mimeType: 'image/jpeg',
            size: okBytes.length,
          },
        }),
    });

    const res = await client.resolveThumbnail({ verifiedImage });
    expect(res.warning).toBeNull();
    expect(isBlobRef(res.thumb)).toBe(true);
    expect(fetchImpl.hit('com.atproto.repo.uploadBlob')).toHaveLength(1);
  });

  it('rejects an image host outside the allowlist before any fetch', async () => {
    const { client, fetchImpl } = baseClient({
      'com.atproto.server.createSession': sessionOk,
    });
    const res = await client.resolveThumbnail({
      verifiedImage: {
        url: 'https://cdn.evil.example/eclipse.jpg',
        content_type: 'image/jpeg',
        bytes: 1000,
      },
    });
    expect(res).toMatchObject({ thumb: null, warning: 'IMAGE_OFFDOMAIN' });
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('drops the thumb (warning IMAGE_TOO_LARGE) just over the cap, or IMAGE_FETCH_FAILED once the transport aborts the stream', async () => {
    // The size warning is only reachable in the ~4 KiB slack window between
    // THUMB_MAX_BYTES and the transport's `maxBytes`; a larger image trips
    // RESPONSE_TOO_LARGE mid-stream and surfaces as IMAGE_FETCH_FAILED. Both
    // outcomes drop the thumb and leave the (still-unfrozen) record intact.
    const justOver = baseClient({
      'com.atproto.server.createSession': sessionOk,
      '/images/eclipse.jpg': () =>
        new Response(jpegBytes(THUMB_MAX_BYTES + 1), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
      'com.atproto.repo.uploadBlob': () => jsonResponse({}, 500),
    });
    const overRes = await justOver.client.resolveThumbnail({ verifiedImage });
    expect(overRes).toMatchObject({ thumb: null, warning: 'IMAGE_TOO_LARGE' });
    expect(justOver.fetchImpl.hit('com.atproto.repo.uploadBlob')).toHaveLength(0);

    const wayOver = baseClient({
      'com.atproto.server.createSession': sessionOk,
      '/images/eclipse.jpg': () =>
        new Response(jpegBytes(THUMB_MAX_BYTES + 8192), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
    });
    const bigRes = await wayOver.client.resolveThumbnail({ verifiedImage });
    expect(bigRes).toMatchObject({ thumb: null, warning: 'IMAGE_FETCH_FAILED' });
  });

  it('drops the thumb (warning IMAGE_FORMAT) when the bytes are not JPEG/PNG', async () => {
    const { client } = baseClient({
      'com.atproto.server.createSession': sessionOk,
      '/images/eclipse.jpg': () =>
        new Response(Buffer.from('<html>not an image</html>'), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
    });

    const res = await client.resolveThumbnail({ verifiedImage });
    expect(res).toMatchObject({ thumb: null, warning: 'IMAGE_FORMAT' });
  });

  it('drops the thumb (warning BLOB_UPLOAD_FAILED) when uploadBlob fails', async () => {
    const okBytes = jpegBytes(20_000);
    const { client } = baseClient({
      'com.atproto.server.createSession': sessionOk,
      '/images/eclipse.jpg': () =>
        new Response(okBytes, { status: 200, headers: { 'content-type': 'image/jpeg' } }),
      'com.atproto.repo.uploadBlob': () => jsonResponse({ error: 'InternalServerError' }, 500),
    });

    const res = await client.resolveThumbnail({ verifiedImage });
    expect(res).toMatchObject({ thumb: null, warning: 'BLOB_UPLOAD_FAILED' });
  });

  it('an auth failure during uploadBlob is thrown, not hidden as a BLOB_UPLOAD_FAILED warning', async () => {
    const okBytes = jpegBytes(20_000);
    const { client } = baseClient({
      'com.atproto.server.createSession': sessionOk,
      '/images/eclipse.jpg': () =>
        new Response(okBytes, { status: 200, headers: { 'content-type': 'image/jpeg' } }),
      // A 401 on the blob upload: the session is broken, the putRecord that
      // follows would fail identically — this must not degrade to "card with no
      // thumb" (task §5).
      'com.atproto.repo.uploadBlob': () => jsonResponse({ error: 'ExpiredToken' }, 401),
    });

    await expect(client.resolveThumbnail({ verifiedImage })).rejects.toMatchObject({
      name: 'BlueskyError',
      code: PUBLISH_OUTCOME.SESSION_EXPIRED,
    });
  });

  it('a null thumb yields an external card with no thumb and no alt key', () => {
    const post = blueskyPost();
    const prep = prepareRecord({
      post,
      blueskyMicros: 1_000,
      clockId: 1,
      createdAt: FIXED_CREATED_AT,
      thumb: null,
    });
    expect('thumb' in prep.record.embed.external).toBe(false);
    expect('alt' in prep.record.embed.external).toBe(false);
  });

  it('a resolved thumb is embedded verbatim, still with no alt key', () => {
    const post = blueskyPost();
    const thumb = {
      $type: 'blob',
      ref: { $link: `bafy${'m'.repeat(20)}` },
      mimeType: 'image/png',
      size: 1234,
    };
    const prep = prepareRecord({
      post,
      blueskyMicros: 1_000,
      clockId: 1,
      createdAt: FIXED_CREATED_AT,
      thumb,
    });
    expect(prep.record.embed.external.thumb).toEqual(thumb);
    expect('alt' in prep.record.embed.external).toBe(false);
  });
});

// =====================================================================
// 5. Exact put payload, including swapRecord: null
// =====================================================================

describe('5. putRecord payload', () => {
  it('sends repo/collection/rkey/validate + an explicit swapRecord:null and the frozen record', async () => {
    const post = blueskyPost();
    const prep = prepareRecord({
      post,
      blueskyMicros: 1_000_000,
      clockId: 3,
      createdAt: FIXED_CREATED_AT,
    });

    const { client, fetchImpl } = baseClient({
      'com.atproto.server.createSession': sessionOk,
      'com.atproto.repo.putRecord': () =>
        jsonResponse({
          uri: `at://${DID}/app.bsky.feed.post/${prep.rkey}`,
          cid: `bafy${'c'.repeat(20)}`,
        }),
    });

    const result = await client.putRecord({ rkey: prep.rkey, record: prep.record });
    expect(result.outcome).toBe(PUBLISH_OUTCOME.CONFIRMED);

    const call = fetchImpl.hit('com.atproto.repo.putRecord')[0];
    const body = JSON.parse(call.body as string);
    expect(body).toEqual({
      repo: DID,
      collection: 'app.bsky.feed.post',
      rkey: prep.rkey,
      validate: true,
      swapRecord: null,
      record: prep.record,
    });
    // `swapRecord: null` must survive as a present key, not vanish like `undefined`.
    expect(Object.prototype.hasOwnProperty.call(body, 'swapRecord')).toBe(true);
    expect(body.swapRecord).toBeNull();
  });
});

// =====================================================================
// 6. Lost write response → getRecord finds the same record, no second put
// =====================================================================

describe('6. applied write with a lost response', () => {
  it('confirms via reconcile without issuing a second put', async () => {
    const post = blueskyPost();
    const prep = prepareRecord({
      post,
      blueskyMicros: 2_000_000,
      clockId: 9,
      createdAt: FIXED_CREATED_AT,
    });

    const { client, fetchImpl } = baseClient({
      'com.atproto.server.createSession': sessionOk,
      'com.atproto.repo.putRecord': () => {
        const err = new Error('socket hang up');
        err.name = 'TimeoutError';
        return Promise.reject(err);
      },
      'com.atproto.repo.getRecord': () =>
        jsonResponse({
          uri: `at://${DID}/app.bsky.feed.post/${prep.rkey}`,
          cid: `bafy${'g'.repeat(20)}`,
          value: prep.record,
        }),
    });

    const put = await client.putRecord({ rkey: prep.rkey, record: prep.record });
    expect(put.outcome).toBe(PUBLISH_OUTCOME.AMBIGUOUS);
    expect(put.safeToRetry).toBe(false);

    const recon = await client.reconcile({ rkey: prep.rkey, frozenRecord: prep.record });
    expect(recon.decision).toBe(RECONCILE_DECISION.CONFIRMED);
    expect(recon.uri).toContain(prep.rkey);

    expect(fetchImpl.hit('com.atproto.repo.putRecord')).toHaveLength(1);
  });
});

// =====================================================================
// 7. Record absent, different, unreadable, and InvalidSwap
// =====================================================================

describe('7. reconciliation states', () => {
  const post = blueskyPost();
  const prep = () =>
    prepareRecord({ post, blueskyMicros: 3_000_000, clockId: 2, createdAt: FIXED_CREATED_AT });

  it('authoritative absence → a safe-retry proposal of the same record and key', async () => {
    const p = prep();
    const { client } = baseClient({
      'com.atproto.repo.getRecord': () =>
        jsonResponse({ error: 'RecordNotFound', message: 'Could not locate record' }, 400),
    });
    const recon = await client.reconcile({ rkey: p.rkey, frozenRecord: p.record });
    expect(recon.decision).toBe(RECONCILE_DECISION.RETRY_SAFE);
    expect(recon.proposal).toEqual({
      action: 'reissue-same-record',
      rkey: p.rkey,
      record: p.record,
    });
  });

  it('a different record at the key → conflict, never overwritten', async () => {
    const p = prep();
    const { client, fetchImpl } = baseClient({
      'com.atproto.repo.getRecord': () =>
        jsonResponse({
          uri: `at://${DID}/app.bsky.feed.post/${p.rkey}`,
          cid: 'bafyother',
          value: { ...p.record, text: 'a completely different post' },
        }),
    });
    const recon = await client.reconcile({ rkey: p.rkey, frozenRecord: p.record });
    expect(recon.decision).toBe(RECONCILE_DECISION.CONFLICT);
    expect(recon.evidence.diff?.fields.text).toBeDefined();
    expect(fetchImpl.hit('com.atproto.repo.putRecord')).toHaveLength(0);
  });

  it('a read error or a bare 404 → uncertain (not absence)', async () => {
    const p = prep();
    const uncertain = baseClient({
      'com.atproto.repo.getRecord': () => jsonResponse({ message: 'nope' }, 404),
    });
    expect(
      (await uncertain.client.reconcile({ rkey: p.rkey, frozenRecord: p.record })).decision
    ).toBe(RECONCILE_DECISION.UNCERTAIN);

    const repoMissing = baseClient({
      'com.atproto.repo.getRecord': () => jsonResponse({ error: 'RepoNotFound' }, 400),
    });
    expect(
      (await repoMissing.client.reconcile({ rkey: p.rkey, frozenRecord: p.record })).decision
    ).toBe(RECONCILE_DECISION.UNCERTAIN);

    const thrown = baseClient({
      'com.atproto.repo.getRecord': () =>
        Promise.reject(Object.assign(new Error('reset'), { code: 'ECONNRESET' })),
    });
    expect((await thrown.client.reconcile({ rkey: p.rkey, frozenRecord: p.record })).decision).toBe(
      RECONCILE_DECISION.UNCERTAIN
    );
  });

  it('a 200 getRecord body whose uri is for a different repo/rkey → uncertain, never a match', async () => {
    const p = prep();
    // Byte-identical record value, but the uri belongs to someone else.
    const foreign = baseClient({
      'com.atproto.repo.getRecord': () =>
        jsonResponse({
          uri: `at://${OTHER_DID}/app.bsky.feed.post/somethingelse`,
          cid: 'bafyforeign',
          value: p.record,
        }),
    });
    const recon = await foreign.client.reconcile({ rkey: p.rkey, frozenRecord: p.record });
    expect(recon.decision).toBe(RECONCILE_DECISION.UNCERTAIN);

    // And directly: the read is `unknown`, not `present`.
    const read = await foreign.client.getRecord({ rkey: p.rkey });
    expect(read.state).toBe('unknown');
    expect((read.evidence as Record<string, unknown>).reason).toMatch(
      /different repo\/collection\/rkey/
    );
  });

  it('InvalidSwap on the put is ambiguous and never mints a new key', async () => {
    const p = prep();
    const { client, fetchImpl } = baseClient({
      'com.atproto.server.createSession': sessionOk,
      'com.atproto.repo.putRecord': () =>
        jsonResponse({ error: 'InvalidSwap', message: 'record exists' }, 400),
    });
    const put = await client.putRecord({ rkey: p.rkey, record: p.record });
    expect(put.outcome).toBe(PUBLISH_OUTCOME.AMBIGUOUS);
    expect(put.errorCode).toBe('InvalidSwap');
    expect(put.safeToRetry).toBe(false);
    const body = JSON.parse(fetchImpl.hit('com.atproto.repo.putRecord')[0].body as string);
    expect(body.rkey).toBe(p.rkey);
  });
});

// =====================================================================
// 8. Missing URI/CID, or a response for a different key
// =====================================================================

describe('8. malformed / mismatched put responses', () => {
  const post = blueskyPost();
  const p = () =>
    prepareRecord({ post, blueskyMicros: 4_000_000, clockId: 4, createdAt: FIXED_CREATED_AT });

  it('a 2xx without uri/cid is ambiguous', async () => {
    const prep = p();
    const { client } = baseClient({
      'com.atproto.server.createSession': sessionOk,
      'com.atproto.repo.putRecord': () => jsonResponse({ cid: 'bafyonly' }),
    });
    const put = await client.putRecord({ rkey: prep.rkey, record: prep.record });
    expect(put.outcome).toBe(PUBLISH_OUTCOME.AMBIGUOUS);
    expect(put.evidence.reason).toMatch(/without uri\/cid/);
  });

  it('a uri for a different repo/collection/rkey is ambiguous, not confirmed', async () => {
    const prep = p();
    const { client } = baseClient({
      'com.atproto.server.createSession': sessionOk,
      'com.atproto.repo.putRecord': () =>
        jsonResponse({ uri: `at://${OTHER_DID}/app.bsky.feed.post/somethingelse`, cid: 'bafyx' }),
    });
    const put = await client.putRecord({ rkey: prep.rkey, record: prep.record });
    expect(put.outcome).toBe(PUBLISH_OUTCOME.AMBIGUOUS);
    expect(put.evidence.reason).toMatch(/different repo\/collection\/rkey/);
  });
});

// =====================================================================
// 9. A retry keeps record, rkey and createdAt intact
// =====================================================================

describe('9. safe retry immutability', () => {
  it('re-reserving over AMBIGUOUS carries the frozen rkey/createdAt/record, and the adapter sends exactly those', async () => {
    const post = blueskyPost();
    const socialId = 'c'.repeat(64);
    const frozen = prepareRecord({
      post,
      blueskyMicros: 6_000_000,
      clockId: 5,
      createdAt: FIXED_CREATED_AT,
    });

    const ambiguousState = freshState({
      revision: 4,
      last_allocated_bluesky_micros: 6_000_000,
      articles: {
        [socialId]: {
          collection_ids: ['col-9'],
          canonical_urls: [CANONICAL],
          first_seen_at: '2026-09-01T00:00:00.000Z',
          platforms: {
            bluesky: {
              status: 'AMBIGUOUS',
              account_key: 'bsky-main',
              attempt_count: 1,
              intent_id: 'intent-old',
              payload_hash: post.payload_hash,
              generator_version: post.generator_version,
              frozen_payload: frozen.record,
              rkey: frozen.rkey,
              created_at: frozen.created_at,
            },
          },
        },
      },
    });
    // Sanity: the constructed ledger doc is a valid §15 state.
    expect(() => validateState(ambiguousState)).not.toThrow();

    const ledger = fakeLedger(ambiguousState);
    const res = await recordIntent({
      store: ledger.store,
      session: { runId: 'run-2', attempt: 1 },
      article: { social_id: socialId, collection_id: 'col-9', canonical_url: CANONICAL },
      platform: 'bluesky',
      destination: { account_key: 'bsky-main' },
      payload: {
        // Deliberately hand a DIFFERENT payload — the safe retry must ignore it.
        frozenPayload: {
          $type: 'app.bsky.feed.post',
          text: 'REBUILT',
          createdAt: '2000-01-01T00:00:00.000Z',
        },
        payloadHash: post.payload_hash,
        generatorVersion: post.generator_version,
      },
      resume: { safeBlueskyRetry: true },
      now: () => NOW_MS,
    });
    expect(res.outcome).toBe('applied');

    const entry = (
      ledger.peek().articles as Record<
        string,
        { platforms: Record<string, Record<string, unknown>> }
      >
    )[socialId].platforms.bluesky;
    expect(entry.rkey).toBe(frozen.rkey);
    expect(entry.created_at).toBe(frozen.created_at);
    expect(canonicalJson(entry.frozen_payload)).toBe(canonicalJson(frozen.record));

    // The adapter sends the record from the entry, never a rebuild.
    const { client, fetchImpl } = baseClient({
      'com.atproto.server.createSession': sessionOk,
      'com.atproto.repo.putRecord': () =>
        jsonResponse({ uri: `at://${DID}/app.bsky.feed.post/${entry.rkey}`, cid: 'bafyretry' }),
    });
    await client.putRecord({ rkey: entry.rkey as string, record: entry.frozen_payload as never });
    const body = JSON.parse(fetchImpl.hit('com.atproto.repo.putRecord')[0].body as string);
    expect(canonicalJson(body.record)).toBe(canonicalJson(frozen.record));
    expect(body.rkey).toBe(frozen.rkey);
  });
});

// =====================================================================
// 10. Reads / reconciliation trigger no implicit login, upload or put
// =====================================================================

describe('10. read paths have no write side effects', () => {
  it('getRecord and reconcile never call createSession / refreshSession / uploadBlob / putRecord', async () => {
    const post = blueskyPost();
    const prep = prepareRecord({
      post,
      blueskyMicros: 7_000_000,
      clockId: 6,
      createdAt: FIXED_CREATED_AT,
    });

    const { client, fetchImpl } = baseClient({
      'com.atproto.repo.getRecord': () =>
        jsonResponse({
          uri: `at://${DID}/app.bsky.feed.post/${prep.rkey}`,
          cid: 'bafyr',
          value: prep.record,
        }),
    });

    await client.getRecord({ rkey: prep.rkey });
    await client.reconcile({ rkey: prep.rkey, frozenRecord: prep.record });

    expect(fetchImpl.hit('com.atproto.server.createSession')).toHaveLength(0);
    expect(fetchImpl.hit('com.atproto.server.refreshSession')).toHaveLength(0);
    expect(fetchImpl.hit('com.atproto.repo.uploadBlob')).toHaveLength(0);
    expect(fetchImpl.hit('com.atproto.repo.putRecord')).toHaveLength(0);
    // No Authorization header on any of the read calls.
    expect(fetchImpl.calls.every((c) => !('authorization' in c.headers))).toBe(true);
  });
});

// =====================================================================
// Result translation (documented mapping to the ledger's input contracts)
// =====================================================================

describe('toRecordResult / reconciliationParams mapping', () => {
  it('maps confirmed → PUBLISHED with uri/cid/providerId', () => {
    const out = toRecordResult({
      outcome: PUBLISH_OUTCOME.CONFIRMED,
      uri: 'at://x/app.bsky.feed.post/y',
      cid: 'bafy',
      evidence: {},
    });
    expect(out.recordResult).toMatchObject({
      status: 'PUBLISHED',
      uri: 'at://x/app.bsky.feed.post/y',
      cid: 'bafy',
      providerId: 'at://x/app.bsky.feed.post/y',
    });
  });

  it('maps ambiguous → AMBIGUOUS and rejected → FAILED_PERMANENT', () => {
    expect(
      toRecordResult({ outcome: PUBLISH_OUTCOME.AMBIGUOUS, evidence: {} }).recordResult?.status
    ).toBe('AMBIGUOUS');
    expect(
      toRecordResult({ outcome: PUBLISH_OUTCOME.REJECTED, evidence: {} }).recordResult?.status
    ).toBe('FAILED_PERMANENT');
  });

  it('maps rate-limited → a RETRYABLE result that satisfies state.recordResult (safeToRetry + ISO retryAt)', () => {
    const out = toRecordResult(
      { outcome: PUBLISH_OUTCOME.RATE_LIMITED, retryAfterMs: 30_000, evidence: {} },
      { now: () => NOW_MS }
    );
    expect(out.recordResult?.safeToRetry).toBe(true);
    expect(Number.isNaN(Date.parse(out.recordResult?.retryAt as string))).toBe(false);
  });

  it('maps auth-invalid / session-expired to a halt signal, never a per-pair result', () => {
    expect(toRecordResult({ outcome: PUBLISH_OUTCOME.AUTH_INVALID, evidence: {} })).toMatchObject({
      halt: 'auth-invalid',
    });
    expect(
      toRecordResult({ outcome: PUBLISH_OUTCOME.SESSION_EXPIRED, evidence: {} })
    ).toMatchObject({
      halt: 'session-expired',
    });
  });

  it('reconciliationParams: conflict → block, retry-safe → a proposal that calls nothing', () => {
    expect(
      reconciliationParams({ decision: RECONCILE_DECISION.CONFLICT, evidence: {} })
    ).toMatchObject({
      call: 'recordReconciliation',
      kind: 'block',
    });
    expect(
      reconciliationParams({
        decision: RECONCILE_DECISION.RETRY_SAFE,
        proposal: { action: 'reissue-same-record', rkey: 'r', record: {} },
      })
    ).toMatchObject({ call: null, proposal: 'authorize-retry' });
  });
});

// =====================================================================
// Integration: the adapter against the real content.js + state.js contracts
// =====================================================================

describe('integration with the real content + state contracts', () => {
  it('a prepared record is accepted by the real state.recordIntent and frozen verbatim', async () => {
    const ledger = fakeLedger(freshState());
    const post = blueskyPost();

    const loaded = await loadState({ store: ledger.store });
    const micros = allocateBlueskyMicros(loaded.state, NOW_MS).micros;
    const prep = prepareRecord({
      post,
      blueskyMicros: micros,
      clockId: 11,
      createdAt: FIXED_CREATED_AT,
    });

    const res = await recordIntent({
      store: ledger.store,
      session: { runId: 'run-3', attempt: 2 },
      article: { social_id: 'd'.repeat(64), collection_id: 'col-int', canonical_url: CANONICAL },
      platform: 'bluesky',
      destination: { account_key: 'bsky-main' },
      payload: {
        frozenPayload: prep.record,
        payloadHash: post.payload_hash,
        generatorVersion: post.generator_version,
        rkey: prep.rkey,
        createdAt: prep.created_at,
        blueskyMicros: micros,
      },
      now: () => NOW_MS,
    });
    expect(res.outcome).toBe('applied');

    const state = ledger.peek();
    expect(() => validateState(state)).not.toThrow();
    const entry = (
      state.articles as Record<string, { platforms: Record<string, Record<string, unknown>> }>
    )['d'.repeat(64)].platforms.bluesky;
    expect(entry.status).toBe('PUBLISHING');
    expect(entry.rkey).toBe(prep.rkey);
    expect(entry.created_at).toBe(prep.created_at);
    expect(canonicalJson(entry.frozen_payload)).toBe(canonicalJson(prep.record));

    // Confirmed send → translated result → real state.recordResult accepts it.
    const publish = await (async () => {
      const { client } = baseClient({
        'com.atproto.server.createSession': sessionOk,
        'com.atproto.repo.putRecord': () =>
          jsonResponse({ uri: `at://${DID}/app.bsky.feed.post/${prep.rkey}`, cid: 'bafyfinal' }),
      });
      return client.putRecord({ rkey: prep.rkey, record: prep.record });
    })();
    const mapped = toRecordResult(publish);
    const recorded = await recordResult({
      store: ledger.store,
      session: { runId: 'run-3', attempt: 2 },
      socialId: 'd'.repeat(64),
      platform: 'bluesky',
      intentId: res.intentId as string,
      result: mapped.recordResult as never,
      now: () => NOW_MS,
    });
    expect(recorded.outcome).toBe('applied');
    const after = ledger.peek();
    const finalEntry = (
      after.articles as Record<string, { platforms: Record<string, Record<string, unknown>> }>
    )['d'.repeat(64)].platforms.bluesky;
    expect(finalEntry.status).toBe('PUBLISHED');
    expect(finalEntry.uri).toBe(`at://${DID}/app.bsky.feed.post/${prep.rkey}`);
  });

  it('AMBIGUOUS → reconcile finds the frozen record → reconciliationParams → real recordReconciliation adopts PUBLISHED', async () => {
    const ledger = fakeLedger(freshState());
    const post = blueskyPost();
    const loaded = await loadState({ store: ledger.store });
    const micros = allocateBlueskyMicros(loaded.state, NOW_MS).micros;
    const prep = prepareRecord({
      post,
      blueskyMicros: micros,
      clockId: 12,
      createdAt: FIXED_CREATED_AT,
    });
    const socialId = 'e'.repeat(64);

    const reserved = await recordIntent({
      store: ledger.store,
      session: { runId: 'run-r', attempt: 1 },
      article: { social_id: socialId, collection_id: 'col-r', canonical_url: CANONICAL },
      platform: 'bluesky',
      destination: { account_key: 'bsky-main' },
      payload: {
        frozenPayload: prep.record,
        payloadHash: post.payload_hash,
        generatorVersion: post.generator_version,
        rkey: prep.rkey,
        createdAt: prep.created_at,
        blueskyMicros: micros,
      },
      now: () => NOW_MS,
    });

    // The put's response was lost.
    const lost = baseClient({
      'com.atproto.server.createSession': sessionOk,
      'com.atproto.repo.putRecord': () => {
        const err = new Error('socket hang up');
        err.name = 'TimeoutError';
        return Promise.reject(err);
      },
    });
    const put = await lost.client.putRecord({ rkey: prep.rkey, record: prep.record });
    expect(put.outcome).toBe(PUBLISH_OUTCOME.AMBIGUOUS);
    await recordResult({
      store: ledger.store,
      session: { runId: 'run-r', attempt: 1 },
      socialId,
      platform: 'bluesky',
      intentId: reserved.intentId as string,
      result: toRecordResult(put).recordResult as never,
      now: () => NOW_MS,
    });

    // Phase 4: a fresh run reads the PDS (no session) and finds our record.
    const reader = baseClient({
      'com.atproto.repo.getRecord': () =>
        jsonResponse({
          uri: `at://${DID}/app.bsky.feed.post/${prep.rkey}`,
          cid: 'bafyrecon',
          value: prep.record,
        }),
    });
    const recon = await reader.client.reconcile({ rkey: prep.rkey, frozenRecord: prep.record });
    expect(recon.decision).toBe(RECONCILE_DECISION.CONFIRMED);
    expect(reader.fetchImpl.hit('com.atproto.repo.putRecord')).toHaveLength(0);

    const descriptor = reconciliationParams(recon, {
      actor: 'social-orchestrator',
    }) as Record<string, unknown>;
    expect(descriptor.call).toBe('recordReconciliation');
    const applied = await recordReconciliation({
      store: ledger.store,
      session: { runId: 'run-r2', attempt: 1 },
      socialId,
      platform: 'bluesky',
      intentId: reserved.intentId as string,
      kind: descriptor.kind as never,
      target: descriptor.target as never,
      uri: descriptor.uri as string,
      cid: descriptor.cid as string,
      resolution: descriptor.resolution as never,
      now: () => NOW_MS,
    });
    expect(applied.outcome).toBe('applied');

    const finalEntry = (
      ledger.peek().articles as Record<
        string,
        { platforms: Record<string, Record<string, unknown>> }
      >
    )[socialId].platforms.bluesky;
    expect(finalEntry.status).toBe('PUBLISHED');
    expect(finalEntry.uri).toBe(`at://${DID}/app.bsky.feed.post/${prep.rkey}`);
    expect(finalEntry.cid).toBe('bafyrecon');
  });

  it('AMBIGUOUS → a different record at the key → reconciliationParams block → real recordReconciliation BLOCKED', async () => {
    const ledger = fakeLedger(freshState());
    const post = blueskyPost();
    const loaded = await loadState({ store: ledger.store });
    const micros = allocateBlueskyMicros(loaded.state, NOW_MS).micros;
    const prep = prepareRecord({
      post,
      blueskyMicros: micros,
      clockId: 13,
      createdAt: FIXED_CREATED_AT,
    });
    const socialId = 'f'.repeat(64);

    const reserved = await recordIntent({
      store: ledger.store,
      session: { runId: 'run-c', attempt: 1 },
      article: { social_id: socialId, collection_id: 'col-c', canonical_url: CANONICAL },
      platform: 'bluesky',
      destination: { account_key: 'bsky-main' },
      payload: {
        frozenPayload: prep.record,
        payloadHash: post.payload_hash,
        generatorVersion: post.generator_version,
        rkey: prep.rkey,
        createdAt: prep.created_at,
        blueskyMicros: micros,
      },
      now: () => NOW_MS,
    });
    await recordResult({
      store: ledger.store,
      session: { runId: 'run-c', attempt: 1 },
      socialId,
      platform: 'bluesky',
      intentId: reserved.intentId as string,
      result: { status: 'AMBIGUOUS', evidence: {} } as never,
      now: () => NOW_MS,
    });

    const reader = baseClient({
      'com.atproto.repo.getRecord': () =>
        jsonResponse({
          uri: `at://${DID}/app.bsky.feed.post/${prep.rkey}`,
          cid: 'bafyother',
          value: { ...prep.record, text: 'someone else got this key' },
        }),
    });
    const recon = await reader.client.reconcile({ rkey: prep.rkey, frozenRecord: prep.record });
    expect(recon.decision).toBe(RECONCILE_DECISION.CONFLICT);
    expect(reader.fetchImpl.hit('com.atproto.repo.putRecord')).toHaveLength(0);

    const descriptor = reconciliationParams(recon, {
      reason: 'foreign record at frozen rkey',
    }) as Record<string, unknown>;
    const applied = await recordReconciliation({
      store: ledger.store,
      session: { runId: 'run-c2', attempt: 1 },
      socialId,
      platform: 'bluesky',
      intentId: reserved.intentId as string,
      kind: descriptor.kind as never,
      resolution: descriptor.resolution as never,
      now: () => NOW_MS,
    });
    expect(applied.outcome).toBe('applied');
    const entry = (
      ledger.peek().articles as Record<
        string,
        { platforms: Record<string, Record<string, unknown>> }
      >
    )[socialId].platforms.bluesky;
    expect(entry.status).toBe('BLOCKED');
    // frozen payload is retained for the human review.
    expect(canonicalJson(entry.frozen_payload)).toBe(canonicalJson(prep.record));
  });

  it('diffRecords agrees with canonicalJson equality on a real prepared record', () => {
    const post = blueskyPost();
    const a = prepareRecord({
      post,
      blueskyMicros: 9_000,
      clockId: 1,
      createdAt: FIXED_CREATED_AT,
    }).record;
    const b = prepareRecord({
      post,
      blueskyMicros: 9_999,
      clockId: 2,
      createdAt: FIXED_CREATED_AT,
    }).record;
    expect(diffRecords(a, b)).toBeNull();
    expect(diffRecords(a, { ...b, langs: ['en'] })).not.toBeNull();
  });
});
