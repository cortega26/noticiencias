import { Buffer } from 'node:buffer';
import { randomInt } from 'node:crypto';

import { ERROR_CLASS, HttpError, classifyStatus, request, requestJson } from '../http.js';

/**
 * Direct Bluesky (ATProto) publishing adapter for the social publisher
 * (plan social-distribution §6 / §10 / §12 / §14 / §15 / §17).
 *
 * > Provenance note. `SOCIAL_DISTRIBUTION_IMPLEMENTATION_PLAN.md` was briefly
 * > lost from disk (it lived outside both repos and `/tmp` was cleared). A
 * > byte-for-byte copy was recovered from the Claude Code session transcripts
 * > and is kept alongside both repos at `../SOCIAL_DISTRIBUTION_IMPLEMENTATION_PLAN.md`
 * > (the `noticiencias/` product root). Section numbers below refer to it.
 * > The earlier `PENDING (plan §…)` markers are now resolved against that copy
 * > plus the package-6 task decisions:
 * > - `langs` — §14's record sketch is `langs: [es]`; MVP is Spanish-only.
 * > - thumbnail byte cap — §10 / §14 and the task both say ≤ 1_000_000 bytes.
 * > - clock-id policy — §14: "clock ID aleatorio de 10 bits"; random per record.
 * > - `PublishResult` shape / ledger translation — §12 sketches a snake_case
 * >   `status`-keyed form; this adapter deliberately keeps its own `outcome`-keyed
 * >   camelCase discriminated union and `toRecordResult` is the translation to
 * >   `state.recordResult`'s real `SendResult` fields (§15 transition table,
 * >   §17 retry matrix). The adapter's contract is what `state.js` accepts, not
 * >   §12's illustrative field list.
 *
 * ### What this adapter is
 *
 * It receives **frozen** content (`SocialPost` from `content.js`, §12) and
 * **frozen** operations (the `rkey` / `createdAt` / record already reserved in
 * the ledger, §14) and performs the Bluesky XRPC calls. It does NOT:
 * - decide editorial eligibility (`article.js` / the orchestrator do that),
 * - regenerate or re-truncate the copy (`content.js` already did, once),
 * - persist ledger state (`state.js` owns `state.json`; this module returns
 *   structured results the orchestrator feeds to `recordResult` /
 *   `recordReconciliation`).
 *
 * ### Boundaries
 *
 * - Transport is always `../http.js` (`request` / `requestJson`): injected
 *   `fetch`, hard timeout, byte cap, secret redaction, and — critically — the
 *   fixed XRPC endpoints never follow a redirect, so a bearer token can never
 *   be replayed to an attacker-chosen host.
 * - Imports `../http.js` only. Not `state.js` (the ledger owns the monotonic
 *   micros counter; this module owns only the base32 TID encoding — see the
 *   note at `state.allocateBlueskyMicros`). Not `content.js` (the `'bluesky'`
 *   platform guard is a local literal, mirroring how `content.js` avoids
 *   importing `article.js`). Tests wire all three together.
 * - No module-load side effects: importing this file opens no session, reads
 *   nothing, uploads nothing.
 *
 * ### The four phases (and where the frozen boundary is)
 *
 *   preparación → reserva → envío → reconciliación
 *
 * 1. **preparación** — the caller mints the raw values, then this module
 *    transforms them. In order:
 *      a. `state.allocateBlueskyMicros(state, nowMs)` → the TID micros,
 *      b. `mintClockId()` → a random 10-bit clock id,
 *      c. an explicit `createdAt` ISO string frozen for the intent,
 *      d. `client.resolveThumbnail()` (public GET + `uploadBlob`) → a blob ref
 *         or `null` + a warning,
 *      e. `prepareRecord({ post, blueskyMicros, clockId, createdAt, thumb })` —
 *         PURE: it consults no clock and no RNG, every value it needs is an
 *         argument. Produces `{ rkey, created_at, bluesky_micros, record }`.
 *    Thumbnail failures degrade to "card without thumb" + a warning HERE,
 *    because the record is not frozen yet — EXCEPT an auth-class failure during
 *    `uploadBlob`, which propagates (it means the whole run is broken, not that
 *    this one image is unusable).
 * 2. **reserva** — the caller passes `{ rkey, createdAt, blueskyMicros,
 *    frozenPayload: record, payloadHash: post.payload_hash }` to
 *    `state.recordIntent`. On `stale-micros` the caller re-mints from the
 *    returned `nextMicros` and calls `prepareRecord` again (the blob ref is
 *    reused — same bytes; `payload_hash` is unchanged because `content.js`
 *    excludes `createdAt` / `rkey` from it). After `applied`, `rkey`,
 *    `createdAt` and `record` are FROZEN and never change through retry or
 *    reconciliation.
 * 3. **envío** — `client.putRecord({ rkey, record })`, exactly once, with
 *    `validate: true` and an explicit `swapRecord: null`. A lost response,
 *    `InvalidSwap`, a malformed body or a timeout never mint a new key — they
 *    return `ambiguous` and hand off to phase 4.
 * 4. **reconciliación** — `client.reconcile({ rkey, frozenRecord })` reads with
 *    `getRecord` on the configured PDS (no session, dry-run safe) and returns
 *    `{ decision, evidence }`. It NEVER issues a put; the orchestrator
 *    re-applies its own controls before authorising one.
 */

// --- constants ---------------------------------------------------------

export const BLUESKY_PLATFORM = 'bluesky';
export const BLUESKY_COLLECTION = 'app.bsky.feed.post';
export const POST_TYPE = 'app.bsky.feed.post';
export const LINK_FACET_TYPE = 'app.bsky.richtext.facet#link';
export const EXTERNAL_EMBED_TYPE = 'app.bsky.embed.external';

/**
 * The record `langs`. §14's record sketch is `langs: [es]` and the MVP is
 * Spanish-only (package-6 decision: `langs: ['es']`). Still a per-call override
 * so a later multi-locale phase does not need a signature change.
 */
export const DEFAULT_LANGS = Object.freeze(['es']);

/**
 * The thumbnail byte ceiling: `1_000_000`. Both §10 ("JPEG/PNG público
 * ≤ 1.000.000 bytes") and §14 ("Thumb tiene límite de schema 1.000.000 bytes")
 * and the package-6 decision agree; a named constant keeps it in one place.
 */
export const THUMB_MAX_BYTES = 1_000_000;
export const THUMB_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png']);

/** TID: 64 bits = `0` | 53-bit micros | 10-bit clock id, big-endian base32-sortable. */
// eslint-disable-next-line no-secrets/no-secrets -- the base32-sortable alphabet, not a secret
const TID_ALPHABET = '234567abcdefghijklmnopqrstuvwxyz';
const TID_LENGTH = 13;
const TID_MICROS_LIMIT = 2n ** 53n;
const TID_CLOCK_ID_LIMIT = 1024;

const DID_RE = /^did:[a-z][a-z0-9]*:[A-Za-z0-9._:%-]+$/;

const XRPC = Object.freeze({
  CREATE_SESSION: 'com.atproto.server.createSession',
  REFRESH_SESSION: 'com.atproto.server.refreshSession',
  UPLOAD_BLOB: 'com.atproto.repo.uploadBlob',
  PUT_RECORD: 'com.atproto.repo.putRecord',
  GET_RECORD: 'com.atproto.repo.getRecord',
});

/**
 * The outcomes `putRecord` / session setup can produce, and the discriminant of
 * a {@link PublishResult}. Exported so the mapping table can be asserted rather
 * than re-derived from prose.
 *
 * - `confirmed`       — the PDS stored the record; `uri` + `cid` are returned.
 *   Storage in the PDS is the confirmation; it does NOT require the post to have
 *   appeared in any feed, and it does NOT license recreating the record if it
 *   is later deleted.
 * - `ambiguous`       — the write's effect cannot be proven (lost response,
 *   timeout, `InvalidSwap`, malformed body, 5xx). Reconcile with `getRecord`.
 * - `rejected`        — an explicit 4xx rejection (`InvalidRecord`, lexicon
 *   validation, a garbage-collected thumb blob). Permanent for this record.
 * - `rate-limited`    — HTTP 429 / exhausted quota. A 429 is a rejection with
 *   no side effect, so the same record + key may be retried later.
 * - `auth-invalid`    — bad app password / a DID that does not match config.
 *   A misconfiguration: every send this run will fail the same way.
 * - `session-expired` — a 401 on an already-authenticated call after the bounded
 *   refresh budget is spent. Also a stop-the-run signal.
 * - `record-conflict` — `reconcile` found a *different* record at `rkey`. Never
 *   overwritten here.
 */
export const PUBLISH_OUTCOME = Object.freeze({
  CONFIRMED: 'confirmed',
  AMBIGUOUS: 'ambiguous',
  REJECTED: 'rejected',
  RATE_LIMITED: 'rate-limited',
  AUTH_INVALID: 'auth-invalid',
  SESSION_EXPIRED: 'session-expired',
  RECORD_CONFLICT: 'record-conflict',
});

/** Structured reconciliation decisions from {@link createBlueskyClient} `reconcile`. */
export const RECONCILE_DECISION = Object.freeze({
  CONFIRMED: 'confirmed',
  CONFLICT: 'conflict',
  RETRY_SAFE: 'retry-safe',
  UNCERTAIN: 'uncertain',
});

// --- errors ----------------------------------------------------------

/**
 * A programming-level failure (bad input, impossible config). Expected
 * operational outcomes are returned as a {@link PublishResult}, not thrown.
 * `message` is already redacted by the transport when it wraps an HTTP failure.
 */
export class BlueskyError extends Error {
  /**
   * @param {string} code stable — `CONFIG` for caller mistakes, otherwise a
   *   {@link PUBLISH_OUTCOME} value for a surfaced operational failure
   * @param {string} message already sanitized
   * @param {Record<string, unknown>} [detail]
   */
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'BlueskyError';
    this.code = code;
    this.detail = detail;
    this.retryAfterMs =
      detail && typeof detail.retryAfterMs === 'number' ? detail.retryAfterMs : null;
  }
}

// --- small helpers --------------------------------------------------

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** Deterministic JSON (keys sorted). Used for record equality, never for a hash. */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

/** JPEG (`FF D8 FF`) or PNG (`89 50 4E 47 0D 0A 1A 0A`) magic bytes. */
function sniffJpegOrPng(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, i) => buffer[i] === byte)) return 'image/png';
  return null;
}

/** Clip an arbitrary value to a bounded JSON string for evidence payloads. */
function clip(value, max = 600) {
  const text = canonicalJson(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// --- TID encoding (pure) -------------------------------------------

/**
 * Encode a Bluesky TID (`rkey` for `app.bsky.feed.post`) from a microsecond
 * timestamp and a 10-bit clock id (plan §14).
 *
 * All arithmetic is `BigInt`: JavaScript's `<<` / `&` / `|` coerce their
 * operands to signed 32-bit, which would silently truncate a ~1.79e15 micros
 * value. `micros` MUST be `< 2^53` — that is the width of the field, not just
 * `Number.MAX_SAFE_INTEGER`; a value at or past the limit is rejected rather
 * than wrapped.
 *
 * @param {number|bigint} micros microseconds since the UNIX epoch, `0 <= micros < 2^53`
 * @param {number|bigint} clockId `0 <= clockId < 1024`
 * @returns {string} 13-char base32-sortable TID
 */
export function encodeTid(micros, clockId) {
  let m;
  try {
    m = typeof micros === 'bigint' ? micros : BigInt(Math.trunc(Number(micros)));
  } catch {
    throw new BlueskyError('CONFIG', 'micros is not an integer');
  }
  if (m < 0n || m >= TID_MICROS_LIMIT) {
    throw new BlueskyError('CONFIG', `micros ${m} is outside the 53-bit TID timestamp field`);
  }
  let c;
  try {
    c = typeof clockId === 'bigint' ? clockId : BigInt(Math.trunc(Number(clockId)));
  } catch {
    throw new BlueskyError('CONFIG', 'clockId is not an integer');
  }
  if (c < 0n || c >= BigInt(TID_CLOCK_ID_LIMIT)) {
    throw new BlueskyError('CONFIG', `clockId ${c} is outside the 10-bit field`);
  }
  let n = (m << 10n) | c;
  let out = '';
  for (let i = 0; i < TID_LENGTH; i += 1) {
    out = TID_ALPHABET[Number(n & 31n)] + out;
    n >>= 5n;
  }
  return out;
}

/**
 * Mint a random 10-bit clock id (§14: "clock ID aleatorio de 10 bits" — a
 * per-record disambiguator so two records minted in the same microsecond do not
 * collide). Random per record, not stable per run. This is the value
 * *generator*; {@link prepareRecord} is the deterministic transform and never
 * calls this itself — the caller mints once and passes `clockId` in, so a
 * `stale-micros` re-mint re-uses the same clock id and only the micros change.
 * An injected `rng` keeps it testable.
 *
 * @param {{ rng?: () => number }} [options]
 * @returns {number}
 */
export function mintClockId({ rng } = {}) {
  if (typeof rng === 'function') {
    const scaled = Math.floor(rng() * TID_CLOCK_ID_LIMIT);
    return Math.min(TID_CLOCK_ID_LIMIT - 1, Math.max(0, scaled));
  }
  return randomInt(0, TID_CLOCK_ID_LIMIT);
}

// --- record preparation (pure) ------------------------------------

/**
 * @typedef {object} PostRecord an `app.bsky.feed.post` record value (plan §14)
 * @property {'app.bsky.feed.post'} $type
 * @property {string} text the frozen copy, verbatim from `SocialPost.text`
 * @property {string} createdAt frozen ISO timestamp
 * @property {string[]} langs
 * @property {Array<{ index: { byteStart: number, byteEnd: number }, features: Array<{ $type: string, uri: string }> }>} facets
 * @property {{ $type: 'app.bsky.embed.external', external: { uri: string, title: string, description: string, thumb?: object } }} embed
 */

/**
 * @typedef {object} PreparedRecord
 * @property {string} rkey the frozen TID / record key
 * @property {string} created_at frozen ISO `createdAt`
 * @property {number} bluesky_micros the micros the rkey was derived from — pass
 *   straight to `state.recordIntent` as `payload.blueskyMicros`
 * @property {PostRecord} record the frozen `app.bsky.feed.post` value
 * @property {string} facet_label the label the link facet points at, verified
 *   against the frozen text's UTF-8 bytes
 */

/**
 * Build the frozen `app.bsky.feed.post` record from an already-frozen
 * `SocialPost` (plan §12) plus the operation parameters (plan §14).
 *
 * **Strictly pure** — a deterministic transform, kept separate from value
 * generation (§14): it reads no clock and no RNG, and every value it needs is
 * an argument. `clockId` (from {@link mintClockId}) and `createdAt` (an ISO
 * string the caller freezes for the intent) are REQUIRED; omitting them is a
 * `CONFIG` error, never a silent `Date.now()` / `randomInt` fallback.
 *
 * The copy is used verbatim — `post.text` is never re-normalized or
 * re-truncated. The facet byte offsets from `content.js`
 * (`link_card.label_byte_start` / `_end`) are used as-is and checked to land
 * exactly on `link_card.label` within the UTF-8 bytes of `post.text`.
 *
 * @param {{
 *   post: import('../content.js').SocialPost,
 *   blueskyMicros: number,
 *   clockId: number,
 *   createdAt: string,
 *   langs?: string[],
 *   thumb?: object | null,
 * }} params
 * @returns {PreparedRecord}
 */
export function prepareRecord({ post, blueskyMicros, clockId, createdAt, langs, thumb }) {
  if (!isPlainObject(post)) throw new BlueskyError('CONFIG', 'post must be a SocialPost object');
  if (post.platform !== BLUESKY_PLATFORM) {
    throw new BlueskyError(
      'CONFIG',
      `prepareRecord is bluesky-only, got platform ${JSON.stringify(post.platform)}`
    );
  }
  if (typeof post.text !== 'string' || post.text === '') {
    throw new BlueskyError('CONFIG', 'post.text is empty');
  }
  const card = post.link_card;
  if (!isPlainObject(card) || !isNonEmptyString(card.uri) || !isNonEmptyString(card.label)) {
    throw new BlueskyError('CONFIG', 'post.link_card must carry uri + label for a bluesky record');
  }
  const start = card.label_byte_start;
  const end = card.label_byte_end;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start) {
    throw new BlueskyError('CONFIG', 'post.link_card label byte offsets are missing or malformed');
  }
  const textBytes = Buffer.from(post.text, 'utf8');
  if (end > textBytes.length) {
    throw new BlueskyError('CONFIG', 'post.link_card label byte offsets exceed the text length');
  }
  const sliced = textBytes.subarray(start, end).toString('utf8');
  if (sliced !== card.label) {
    throw new BlueskyError(
      'CONFIG',
      'facet byte offsets do not land on link_card.label in post.text',
      {
        expected: card.label,
        found: sliced,
      }
    );
  }
  if (!Number.isInteger(blueskyMicros) || blueskyMicros < 0) {
    throw new BlueskyError(
      'CONFIG',
      'blueskyMicros must be a >= 0 integer (from state.allocateBlueskyMicros)'
    );
  }
  if (thumb != null && !isBlobRef(thumb)) {
    throw new BlueskyError('CONFIG', 'thumb, when present, must be a validated blob ref');
  }
  if (!Number.isInteger(clockId)) {
    throw new BlueskyError('CONFIG', 'clockId is required (mint it with mintClockId, do not omit)');
  }
  if (!isIsoDate(createdAt)) {
    throw new BlueskyError('CONFIG', 'createdAt is required and must be an ISO date string');
  }

  const rkey = encodeTid(blueskyMicros, clockId);
  const resolvedLangs =
    Array.isArray(langs) && langs.length > 0 ? langs.slice() : DEFAULT_LANGS.slice();

  const external = {
    uri: card.uri,
    title: typeof card.title === 'string' ? card.title : '',
    // `content.js` emits `''` (not absent) when the article has no description.
    description: typeof card.description === 'string' ? card.description : '',
  };
  // No `alt` key: `external.thumb` has no alt field in the lexicon (task §3).
  if (thumb != null) external.thumb = thumb;

  const record = {
    $type: POST_TYPE,
    text: post.text,
    createdAt,
    langs: resolvedLangs,
    facets: [
      {
        index: { byteStart: start, byteEnd: end },
        features: [{ $type: LINK_FACET_TYPE, uri: card.uri }],
      },
    ],
    embed: { $type: EXTERNAL_EMBED_TYPE, external },
  };

  return {
    rkey,
    created_at: createdAt,
    bluesky_micros: blueskyMicros,
    record,
    facet_label: card.label,
  };
}

/** A JSON-API blob ref: `{ $type:'blob', ref:{ $link }, mimeType, size }`. */
export function isBlobRef(value) {
  return (
    isPlainObject(value) &&
    value.$type === 'blob' &&
    isPlainObject(value.ref) &&
    isNonEmptyString(value.ref.$link) &&
    isNonEmptyString(value.mimeType) &&
    Number.isInteger(value.size)
  );
}

// --- record equality / diff --------------------------------------

/**
 * Full canonical-JSON equality of two records. Returns `null` when identical,
 * otherwise a bounded, per-top-level-key diff for the reconciliation evidence.
 *
 * Deliberately strict: the PDS echoes exactly what was written (including
 * `$type`; JSON-API blob refs round-trip as `{ ref: { $link } }`). If a future
 * server-side field surfaces here as a "conflict", the structured `fields`
 * makes the reason inspectable rather than hiding it.
 */
export function diffRecords(frozen, found) {
  if (canonicalJson(frozen) === canonicalJson(found)) return null;
  const keys = [
    ...new Set([
      ...Object.keys(isPlainObject(frozen) ? frozen : {}),
      ...Object.keys(isPlainObject(found) ? found : {}),
    ]),
  ].sort();
  const fields = {};
  for (const key of keys) {
    const a = canonicalJson(isPlainObject(frozen) ? frozen[key] : undefined);
    const b = canonicalJson(isPlainObject(found) ? found[key] : undefined);
    if (a !== b) fields[key] = { frozen: clip(frozen?.[key]), found: clip(found?.[key]) };
  }
  return { fields };
}

// --- HTTP outcome mapping ---------------------------------------

/**
 * Map a completed non-2xx XRPC response to a {@link PUBLISH_OUTCOME}. `json` is
 * the parsed body when available — ATProto puts a lexicon error name in
 * `json.error`.
 *
 * @param {{ status: number, headers: Record<string,string>, retryAfterMs?: number|null }} result
 * @param {any} json
 * @returns {{ outcome: string, errorCode: string|null, retryAfterMs: number|null }}
 */
function classifyXrpcFailure(result, json) {
  const errorCode = isPlainObject(json) && isNonEmptyString(json.error) ? String(json.error) : null;
  const cls = classifyStatus(result.status, result.headers || {});
  if (cls === ERROR_CLASS.RATE_LIMITED) {
    return {
      outcome: PUBLISH_OUTCOME.RATE_LIMITED,
      errorCode,
      retryAfterMs: result.retryAfterMs ?? null,
    };
  }
  if (cls === ERROR_CLASS.AUTH) {
    // `AuthenticationRequired` on a first-contact call is bad credentials;
    // `ExpiredToken` / a 401 mid-run is an expired session. Both are surfaced;
    // the caller distinguishes create-time from mid-run.
    return { outcome: PUBLISH_OUTCOME.SESSION_EXPIRED, errorCode, retryAfterMs: null };
  }
  if (errorCode === 'InvalidSwap') {
    // A record already exists at `rkey`. NOT "mint a new key" — reconcile.
    return { outcome: PUBLISH_OUTCOME.AMBIGUOUS, errorCode, retryAfterMs: null };
  }
  if (result.status >= 400 && result.status < 500) {
    return { outcome: PUBLISH_OUTCOME.REJECTED, errorCode, retryAfterMs: null };
  }
  return { outcome: PUBLISH_OUTCOME.AMBIGUOUS, errorCode, retryAfterMs: null };
}

// --- client ---------------------------------------------------------

/**
 * @typedef {object} PublishResult
 * @property {'confirmed'|'ambiguous'|'rejected'|'rate-limited'|'auth-invalid'|'session-expired'|'record-conflict'} outcome
 * @property {string} [uri] Bluesky `at://` URI (on `confirmed`)
 * @property {string} [cid] (on `confirmed`)
 * @property {string|null} [errorClass] transport {@link ERROR_CLASS} when the
 *   result came from a transport failure rather than a lexicon error
 * @property {string|null} [errorCode] the ATProto lexicon error name
 * @property {number|null} [retryAfterMs] parsed `Retry-After` (on `rate-limited`)
 * @property {boolean} [safeToRetry] `true` ONLY when the write provably reached
 *   no PDS state — a 429 or a pre-put auth failure. A timeout / lost response /
 *   `InvalidSwap` is never `safeToRetry`.
 * @property {Record<string, unknown>} evidence structured, non-secret facts behind the outcome
 */

/**
 * @typedef {object} LedgerSendResult the shape `state.recordResult` accepts
 *   (its `SendResult` typedef).
 * @property {string} status one of the `state.STATUS` values
 * @property {string} [uri]
 * @property {string} [cid]
 * @property {string} [providerId]
 * @property {string} [errorClass]
 * @property {boolean} [safeToRetry]
 * @property {string} [retryAt] ISO
 * @property {Record<string, unknown>} [evidence]
 */

/**
 * Create a Bluesky client bound to one identity + PDS. Tokens live only in
 * this closure; nothing is persisted and nothing happens until a method is
 * called.
 *
 * @param {{
 *   fetchImpl: import('../http.js').FetchLike,
 *   service: string,          // PDS base URL, e.g. https://pds.example.com
 *   did: string,              // the DID this identity MUST resolve to
 *   appPassword: string,
 *   session?: { refreshJwt: string },  // optional carried refresh token (bounded refresh, §14)
 *   maxRefreshes?: number,    // bounded refresh budget (default 1)
 *   timeoutMs?: number,
 *   allowedImageHosts?: string[],  // thumbnail host allowlist; default ['noticiencias.com'] (mirrors article.js)
 * }} config
 */
export function createBlueskyClient(config) {
  const {
    fetchImpl,
    service,
    did,
    appPassword,
    session: carriedSession,
    maxRefreshes = 1,
    timeoutMs,
    allowedImageHosts = ['noticiencias.com'],
  } = config || {};

  if (typeof fetchImpl !== 'function') {
    throw new BlueskyError('CONFIG', 'fetchImpl must be injected');
  }
  let serviceUrl;
  try {
    serviceUrl = new URL(String(service));
  } catch {
    throw new BlueskyError('CONFIG', 'service must be an absolute URL');
  }
  if (serviceUrl.protocol !== 'https:') {
    throw new BlueskyError('CONFIG', 'service must be an https URL');
  }
  if (!DID_RE.test(String(did))) {
    throw new BlueskyError('CONFIG', 'did must look like did:method:identifier');
  }
  if (!isNonEmptyString(appPassword)) {
    throw new BlueskyError('CONFIG', 'appPassword is required');
  }

  const host = serviceUrl.host;
  const base = `${serviceUrl.origin}/xrpc`;

  /** @type {{ accessJwt: string, refreshJwt: string, did: string } | null} */
  let live = null;
  let refreshJwt =
    isPlainObject(carriedSession) && isNonEmptyString(carriedSession.refreshJwt)
      ? String(carriedSession.refreshJwt)
      : null;
  let refreshes = 0;

  function secretList() {
    return [appPassword, live?.accessJwt, live?.refreshJwt, refreshJwt].filter(isNonEmptyString);
  }

  function baseOptions(extra = {}) {
    return {
      fetchImpl,
      allowedHosts: [host],
      followRedirects: false,
      timeoutMs: timeoutMs ?? 15_000,
      secrets: secretList(),
      ...extra,
    };
  }

  function authHeaders(token) {
    return { Authorization: `Bearer ${token}` };
  }

  function assertSameIdentity(responseDid, where) {
    if (String(responseDid) !== String(did)) {
      // Never store a session for a DID we did not ask for.
      live = null;
      throw new BlueskyError(
        PUBLISH_OUTCOME.AUTH_INVALID,
        `${where} resolved to a different DID than configured`,
        {
          expected_did: did,
        }
      );
    }
  }

  async function createSession() {
    const url = `${base}/${XRPC.CREATE_SESSION}`;
    let result;
    let json;
    try {
      ({ result, json } = await requestJson(
        url,
        baseOptions({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: did, password: appPassword }),
        })
      ));
    } catch (error) {
      throw wrapTransport(error, 'createSession');
    }
    if (classifyStatus(result.status, result.headers) !== ERROR_CLASS.OK) {
      const mapped = classifyXrpcFailure(result, json);
      const outcome =
        mapped.outcome === PUBLISH_OUTCOME.SESSION_EXPIRED
          ? PUBLISH_OUTCOME.AUTH_INVALID
          : mapped.outcome;
      throw new BlueskyError(outcome, `createSession failed (${result.status})`, {
        status: result.status,
        errorCode: mapped.errorCode,
        retryAfterMs: mapped.retryAfterMs,
      });
    }
    if (
      !isPlainObject(json) ||
      !isNonEmptyString(json.accessJwt) ||
      !isNonEmptyString(json.refreshJwt)
    ) {
      throw new BlueskyError(
        PUBLISH_OUTCOME.AMBIGUOUS,
        'createSession response is missing tokens',
        {
          status: result.status,
        }
      );
    }
    assertSameIdentity(json.did, 'createSession');
    live = {
      accessJwt: String(json.accessJwt),
      refreshJwt: String(json.refreshJwt),
      did: String(json.did),
    };
    refreshJwt = live.refreshJwt;
    return live;
  }

  async function refreshSession() {
    if (!isNonEmptyString(refreshJwt)) {
      throw new BlueskyError(
        PUBLISH_OUTCOME.SESSION_EXPIRED,
        'no refresh token to renew the session'
      );
    }
    if (refreshes >= maxRefreshes) {
      throw new BlueskyError(
        PUBLISH_OUTCOME.SESSION_EXPIRED,
        `refresh budget (${maxRefreshes}) exhausted`
      );
    }
    refreshes += 1;
    const url = `${base}/${XRPC.REFRESH_SESSION}`;
    let result;
    let json;
    try {
      ({ result, json } = await requestJson(
        url,
        baseOptions({
          method: 'POST',
          headers: authHeaders(refreshJwt),
        })
      ));
    } catch (error) {
      throw wrapTransport(error, 'refreshSession');
    }
    if (classifyStatus(result.status, result.headers) !== ERROR_CLASS.OK) {
      throw new BlueskyError(
        PUBLISH_OUTCOME.SESSION_EXPIRED,
        `refreshSession failed (${result.status})`,
        {
          status: result.status,
        }
      );
    }
    if (
      !isPlainObject(json) ||
      !isNonEmptyString(json.accessJwt) ||
      !isNonEmptyString(json.refreshJwt)
    ) {
      throw new BlueskyError(
        PUBLISH_OUTCOME.AMBIGUOUS,
        'refreshSession response is missing tokens'
      );
    }
    assertSameIdentity(json.did, 'refreshSession');
    live = {
      accessJwt: String(json.accessJwt),
      refreshJwt: String(json.refreshJwt),
      did: String(json.did),
    };
    refreshJwt = live.refreshJwt;
    return live;
  }

  /**
   * Ensure a usable access token exists. Bounded refresh happens HERE, before
   * an operation — never as a reaction to a failed write. With a carried
   * `refreshJwt` and no live token, the session is renewed; otherwise a fresh
   * `createSession` runs. A caller may force a pre-operation renewal with
   * `{ refresh: true }`.
   *
   * @param {{ refresh?: boolean }} [options]
   */
  async function ensureSession({ refresh = false } = {}) {
    if (refresh) return refreshSession();
    if (live && isNonEmptyString(live.accessJwt)) return live;
    if (isNonEmptyString(refreshJwt)) return refreshSession();
    return createSession();
  }

  function wrapTransport(error, where) {
    if (error instanceof BlueskyError) return error;
    if (error instanceof HttpError) {
      const outcome =
        error.errorClass === ERROR_CLASS.RATE_LIMITED
          ? PUBLISH_OUTCOME.RATE_LIMITED
          : error.errorClass === ERROR_CLASS.AUTH
            ? PUBLISH_OUTCOME.SESSION_EXPIRED
            : PUBLISH_OUTCOME.AMBIGUOUS;
      return new BlueskyError(outcome, `${where}: ${error.sanitizedMessage}`, {
        errorClass: error.errorClass,
        retryAfterMs: error.retryAfterMs ?? null,
      });
    }
    return new BlueskyError(PUBLISH_OUTCOME.AMBIGUOUS, `${where}: transport failure`);
  }

  /**
   * `com.atproto.repo.uploadBlob`. Requires a session (a write-adjacent prep
   * step, never on the public-read path). Validates the response is a real
   * blob ref of the exact size + mime uploaded.
   *
   * @param {Buffer} bytes
   * @param {string} mimeType `image/jpeg` or `image/png`
   * @returns {Promise<object>} the validated blob ref
   */
  async function uploadBlob(bytes, mimeType) {
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      throw new BlueskyError('CONFIG', 'uploadBlob needs a non-empty Buffer');
    }
    if (!THUMB_MIME_TYPES.includes(mimeType)) {
      throw new BlueskyError(
        'CONFIG',
        `uploadBlob mimeType ${JSON.stringify(mimeType)} is not allowed`
      );
    }
    await ensureSession();
    const url = `${base}/${XRPC.UPLOAD_BLOB}`;
    let result;
    let json;
    try {
      // Binary body via `request`: its JSDoc says `string`, but there is no
      // runtime check and `fetch` accepts a Buffer/Uint8Array body. http.js is
      // not modified.
      ({ result, json } = await requestJson(
        url,
        baseOptions({
          method: 'POST',
          headers: { ...authHeaders(live.accessJwt), 'Content-Type': mimeType },
          body: bytes,
          maxBytes: 256 * 1024,
        })
      ));
    } catch (error) {
      throw wrapTransport(error, 'uploadBlob');
    }
    if (classifyStatus(result.status, result.headers) !== ERROR_CLASS.OK) {
      const mapped = classifyXrpcFailure(result, json);
      throw new BlueskyError(mapped.outcome, `uploadBlob failed (${result.status})`, {
        status: result.status,
        errorCode: mapped.errorCode,
      });
    }
    const blob = isPlainObject(json) ? json.blob : null;
    if (!isBlobRef(blob) || blob.mimeType !== mimeType || Number(blob.size) !== bytes.length) {
      throw new BlueskyError(PUBLISH_OUTCOME.AMBIGUOUS, 'uploadBlob response did not validate', {
        expected_size: bytes.length,
        expected_mime: mimeType,
        got: clip(blob),
      });
    }
    return blob;
  }

  /**
   * @typedef {object} ThumbnailResult
   * @property {object|null} thumb the validated blob ref, or `null`
   * @property {string|null} warning a stable code when the thumb was dropped
   *   (`NO_IMAGE`, `IMAGE_OFFDOMAIN`, `IMAGE_FETCH_FAILED`, `IMAGE_STATUS`,
   *   `IMAGE_FORMAT`, `IMAGE_TOO_LARGE`, `BLOB_UPLOAD_FAILED`). Only meaningful
   *   BEFORE the record is frozen — the caller may proceed with a card that has
   *   no thumb. An `auth-invalid` / `session-expired` failure during the upload
   *   is NOT one of these: it is re-thrown as a {@link BlueskyError} so the run
   *   halts on its real cause (task §5).
   * @property {object} evidence
   */

  /**
   * Re-use the already-verified public image (`article.verifyPublicArticle`
   * `.verified`) as the external-card thumbnail: JPEG/PNG only,
   * `<= THUMB_MAX_BYTES`, magic-byte checked, then `uploadBlob`. No image
   * processing — an unusable image yields `{ thumb: null, warning }`, never a
   * resize. A verified URL and a successful upload are NOT a publication.
   *
   * The image host is re-checked against `allowedImageHosts` here — the value
   * crossed a module boundary, so "already verified" is not re-established by
   * trust. A redirect off the allowlist is rejected hop-by-hop by the transport.
   *
   * @param {{ verifiedImage: { url: string|null, content_type?: string|null, bytes?: number|null } | null }} params
   * @returns {Promise<ThumbnailResult>}
   * @throws {BlueskyError} when `uploadBlob` fails with `auth-invalid` /
   *   `session-expired` — a broken session is a run-level halt, not a
   *   "drop the thumb" warning.
   */
  async function resolveThumbnail({ verifiedImage }) {
    if (!isPlainObject(verifiedImage) || !isNonEmptyString(verifiedImage.url)) {
      return { thumb: null, warning: 'NO_IMAGE', evidence: { reason: 'no verified image url' } };
    }
    let imageHost;
    try {
      imageHost = new URL(verifiedImage.url).host;
    } catch {
      return {
        thumb: null,
        warning: 'IMAGE_FORMAT',
        evidence: { reason: 'unparseable image url' },
      };
    }
    if (!allowedImageHosts.includes(imageHost)) {
      // A self-derived allowlist would be a no-op guard; pin to config.
      return { thumb: null, warning: 'IMAGE_OFFDOMAIN', evidence: { host: imageHost } };
    }
    let res;
    try {
      res = await request(verifiedImage.url, {
        fetchImpl,
        allowedHosts: allowedImageHosts,
        followRedirects: true,
        maxRedirects: 3,
        maxBytes: THUMB_MAX_BYTES + 4096,
        timeoutMs: timeoutMs ?? 15_000,
      });
    } catch (error) {
      return {
        thumb: null,
        warning: 'IMAGE_FETCH_FAILED',
        evidence: { errorClass: error instanceof HttpError ? error.errorClass : 'CONNECTION' },
      };
    }
    if (res.status !== 200) {
      return { thumb: null, warning: 'IMAGE_STATUS', evidence: { status: res.status } };
    }
    const headerMime = String(res.headers['content-type'] ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const sniffedMime = sniffJpegOrPng(res.bodyBuffer);
    if (!THUMB_MIME_TYPES.includes(headerMime) || !sniffedMime || sniffedMime !== headerMime) {
      return {
        thumb: null,
        warning: 'IMAGE_FORMAT',
        evidence: { header_mime: headerMime, sniffed_mime: sniffedMime },
      };
    }
    if (res.bodyBytes > THUMB_MAX_BYTES) {
      return {
        thumb: null,
        warning: 'IMAGE_TOO_LARGE',
        evidence: { bytes: res.bodyBytes, cap: THUMB_MAX_BYTES },
      };
    }
    try {
      const thumb = await uploadBlob(res.bodyBuffer, headerMime);
      return { thumb, warning: null, evidence: { bytes: res.bodyBytes, mime: headerMime } };
    } catch (error) {
      // An auth-class failure during the blob upload is NOT "this image is
      // unusable, proceed without a thumb" — it means the session is broken and
      // the subsequent putRecord will fail the same way. Propagate it so the
      // orchestrator halts on the real cause, instead of burying it in a
      // BLOB_UPLOAD_FAILED warning (task §5). Every other upload failure
      // (rate-limit, a rejected blob, a lost response) legitimately degrades to
      // a card with no thumb, since the record is not frozen yet.
      if (
        error instanceof BlueskyError &&
        (error.code === PUBLISH_OUTCOME.AUTH_INVALID ||
          error.code === PUBLISH_OUTCOME.SESSION_EXPIRED)
      ) {
        throw error;
      }
      return {
        thumb: null,
        warning: 'BLOB_UPLOAD_FAILED',
        evidence: { outcome: error instanceof BlueskyError ? error.code : 'ambiguous' },
      };
    }
  }

  /**
   * `com.atproto.repo.putRecord`, issued exactly once. `swapRecord` is an
   * explicit `null` (create-only, never overwrite, plan §4). A lost response,
   * `InvalidSwap`, a malformed body or a 5xx never mint a new `rkey` — they
   * return `ambiguous` for phase-4 reconciliation.
   *
   * @param {{ rkey: string, record: PostRecord }} params the FROZEN key + record
   *   (on a safe retry, both come from the ledger entry, not a rebuild)
   * @returns {Promise<PublishResult>}
   */
  async function putRecord({ rkey, record }) {
    if (!isNonEmptyString(rkey)) throw new BlueskyError('CONFIG', 'putRecord needs a frozen rkey');
    if (!isPlainObject(record) || record.$type !== POST_TYPE) {
      throw new BlueskyError('CONFIG', 'putRecord needs a frozen app.bsky.feed.post record');
    }

    try {
      await ensureSession();
    } catch (error) {
      const be = error instanceof BlueskyError ? error : wrapTransport(error, 'putRecord/session');
      // The put was never issued — no side effect on the PDS.
      return {
        outcome: be.code === 'CONFIG' ? PUBLISH_OUTCOME.REJECTED : be.code,
        errorClass: be.detail?.errorClass ?? null,
        errorCode: be.detail?.errorCode ?? null,
        retryAfterMs: be.retryAfterMs,
        safeToRetry:
          be.code === PUBLISH_OUTCOME.RATE_LIMITED || be.code === PUBLISH_OUTCOME.AUTH_INVALID,
        evidence: { phase: 'pre-put', message: be.message, detail: be.detail },
      };
    }

    const body = {
      repo: did,
      collection: BLUESKY_COLLECTION,
      rkey,
      validate: true,
      swapRecord: null,
      record,
    };
    const url = `${base}/${XRPC.PUT_RECORD}`;

    let result;
    let json;
    try {
      ({ result, json } = await requestJson(
        url,
        baseOptions({
          method: 'POST',
          headers: { ...authHeaders(live.accessJwt), 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          maxBytes: 256 * 1024,
        })
      ));
    } catch (error) {
      // Thrown = response lost / timeout / non-JSON. NEVER a new key.
      const be = wrapTransport(error, 'putRecord');
      return {
        outcome: PUBLISH_OUTCOME.AMBIGUOUS,
        errorClass: be.detail?.errorClass ?? null,
        errorCode: null,
        retryAfterMs: be.retryAfterMs,
        safeToRetry: false,
        evidence: {
          phase: 'put',
          reason: 'transport failure / lost response',
          message: be.message,
        },
      };
    }

    if (classifyStatus(result.status, result.headers) === ERROR_CLASS.OK) {
      const uri = isPlainObject(json) ? json.uri : null;
      const cid = isPlainObject(json) ? json.cid : null;
      if (!isNonEmptyString(uri) || !isNonEmptyString(cid)) {
        return {
          outcome: PUBLISH_OUTCOME.AMBIGUOUS,
          errorClass: null,
          errorCode: null,
          retryAfterMs: null,
          safeToRetry: false,
          evidence: {
            phase: 'put',
            reason: '2xx without uri/cid',
            status: result.status,
            body: clip(json),
          },
        };
      }
      const expectedSuffix = `/${BLUESKY_COLLECTION}/${rkey}`;
      if (!String(uri).includes(String(did)) || !String(uri).endsWith(expectedSuffix)) {
        // The response does not correspond to the operation we issued.
        return {
          outcome: PUBLISH_OUTCOME.AMBIGUOUS,
          errorClass: null,
          errorCode: null,
          retryAfterMs: null,
          safeToRetry: false,
          evidence: {
            phase: 'put',
            reason: 'response uri is for a different repo/collection/rkey',
            uri,
          },
        };
      }
      return {
        outcome: PUBLISH_OUTCOME.CONFIRMED,
        uri: String(uri),
        cid: String(cid),
        errorClass: null,
        errorCode: null,
        evidence: { phase: 'put', status: result.status },
      };
    }

    const mapped = classifyXrpcFailure(result, json);
    return {
      outcome: mapped.outcome,
      errorClass: classifyStatus(result.status, result.headers),
      errorCode: mapped.errorCode,
      retryAfterMs: mapped.retryAfterMs,
      // Only an HTTP 429 (rejected, not processed) is provably no-effect.
      safeToRetry: mapped.outcome === PUBLISH_OUTCOME.RATE_LIMITED,
      evidence: {
        phase: 'put',
        status: result.status,
        errorCode: mapped.errorCode,
        body: clip(json),
      },
    };
  }

  /**
   * @typedef {object} GetRecordResult
   * @property {'present'|'absent'|'unknown'} state
   *   - `present`: the PDS returned a record `value` AND the response `uri`
   *     matches the repo/collection/rkey we asked for.
   *   - `absent`: the PDS answered authoritatively that it does not exist
   *     (HTTP 400 `RecordNotFound`). A bare 404, `RepoNotFound`, a 5xx, a
   *     non-JSON body, an incomplete body, a response for a foreign `at://`
   *     uri, or a timeout are `unknown`, NOT `absent`.
   *   - `unknown`: could not be determined.
   * @property {string} [uri]
   * @property {string|null} [cid]
   * @property {object} [value] the stored record
   * @property {object} evidence
   */

  /**
   * `com.atproto.repo.getRecord` on the configured PDS. Unauthenticated — it
   * never opens a session, refreshes a token or uploads a blob, so a future
   * dry-run can call it freely.
   *
   * @param {{ rkey: string }} params
   * @returns {Promise<GetRecordResult>}
   */
  async function getRecord({ rkey }) {
    if (!isNonEmptyString(rkey)) throw new BlueskyError('CONFIG', 'getRecord needs an rkey');
    const url =
      `${base}/${XRPC.GET_RECORD}` +
      `?repo=${encodeURIComponent(did)}` +
      `&collection=${encodeURIComponent(BLUESKY_COLLECTION)}` +
      `&rkey=${encodeURIComponent(rkey)}`;
    let result;
    let json;
    try {
      ({ result, json } = await requestJson(url, baseOptions()));
    } catch (error) {
      return {
        state: 'unknown',
        evidence: {
          reason: 'read failed',
          errorClass: error instanceof HttpError ? error.errorClass : 'CONNECTION',
        },
      };
    }
    if (classifyStatus(result.status, result.headers) === ERROR_CLASS.OK) {
      if (!isPlainObject(json) || !isNonEmptyString(json.uri) || !isPlainObject(json.value)) {
        return {
          state: 'unknown',
          evidence: { reason: 'incomplete getRecord body', status: result.status },
        };
      }
      // Identity: the body must be for the repo/collection/rkey we asked about.
      // A record for a foreign `at://` URI (misrouted PDS, cache bleed, a hostile
      // response) is NOT evidence about our key — treat it as unknown, never as
      // a match/absence (task §4: "URI ajena ... no debe convertirse en ausencia
      // ni coincidencia"). Mirrors the same check on the putRecord response.
      const expectedSuffix = `/${BLUESKY_COLLECTION}/${rkey}`;
      if (!String(json.uri).includes(String(did)) || !String(json.uri).endsWith(expectedSuffix)) {
        return {
          state: 'unknown',
          evidence: {
            reason: 'getRecord uri is for a different repo/collection/rkey',
            status: result.status,
            uri: String(json.uri),
          },
        };
      }
      return {
        state: 'present',
        uri: String(json.uri),
        cid: isNonEmptyString(json.cid) ? String(json.cid) : null,
        value: json.value,
        evidence: { status: result.status },
      };
    }
    const errorCode =
      isPlainObject(json) && isNonEmptyString(json.error) ? String(json.error) : null;
    if (result.status === 400 && errorCode === 'RecordNotFound') {
      return { state: 'absent', evidence: { status: 400, errorCode } };
    }
    return { state: 'unknown', evidence: { status: result.status, errorCode } };
  }

  /**
   * Phase 4 — read the PDS and return a structured decision + evidence. NEVER
   * issues a put; on `retry-safe` it returns a *proposal* the orchestrator must
   * re-authorise (through the ledger's own controls) before any re-send.
   *
   * @param {{ rkey: string, frozenRecord: object }} params
   * @returns {Promise<{
   *   decision: 'confirmed'|'conflict'|'retry-safe'|'uncertain',
   *   uri?: string, cid?: string|null,
   *   proposal?: { action: 'reissue-same-record', rkey: string, record: object },
   *   evidence: { read?: Record<string, unknown>, diff?: { fields: Record<string, { frozen: string, found: string }> }, note?: string },
   * }>}
   */
  async function reconcile({ rkey, frozenRecord }) {
    if (!isNonEmptyString(rkey)) throw new BlueskyError('CONFIG', 'reconcile needs a frozen rkey');
    if (!isPlainObject(frozenRecord))
      throw new BlueskyError('CONFIG', 'reconcile needs the frozen record');

    const read = await getRecord({ rkey });

    if (read.state === 'present') {
      const diff = diffRecords(frozenRecord, read.value);
      if (diff === null) {
        return {
          decision: RECONCILE_DECISION.CONFIRMED,
          uri: read.uri,
          cid: read.cid ?? null,
          evidence: { read: read.evidence },
        };
      }
      // A different record occupies our key — never overwritten here.
      return { decision: RECONCILE_DECISION.CONFLICT, evidence: { read: read.evidence, diff } };
    }

    if (read.state === 'absent') {
      return {
        decision: RECONCILE_DECISION.RETRY_SAFE,
        proposal: { action: 'reissue-same-record', rkey, record: frozenRecord },
        evidence: {
          read: read.evidence,
          note: 'authoritative absence; same record + key may be re-issued once re-authorised',
        },
      };
    }

    // Read error / incomplete — uncertainty, not absence.
    return { decision: RECONCILE_DECISION.UNCERTAIN, evidence: { read: read.evidence } };
  }

  return {
    /** @internal test seam — the identity this client is bound to. */
    did,
    ensureSession,
    refreshSession,
    uploadBlob,
    resolveThumbnail,
    putRecord,
    getRecord,
    reconcile,
  };
}

// --- translation to the ledger's input contracts ----------------

/**
 * Translate a {@link PublishResult} to the shape `state.recordResult` accepts
 * (its `SendResult` typedef: `status`, `providerId`, `uri`, `cid`,
 * `errorClass`, `safeToRetry`, `retryAt`, `evidence`).
 *
 * §12 sketches a `PublishResult` as a snake_case `status`-keyed shape; this
 * adapter deliberately keeps its own `outcome`-keyed camelCase discriminated
 * union ({@link PublishResult}) and THIS function is the translation to the
 * ledger's real fields. The authority for the target column is the §15
 * transition table and §17 retry matrix as `state.recordResult` implements
 * them: from a `PUBLISHING` entry it accepts `ACCEPTED | PUBLISHED | AMBIGUOUS
 * | RETRYABLE | FAILED_PERMANENT`, and a `RETRYABLE` needs `safeToRetry ===
 * true` AND an ISO `retryAt` or it throws `UNSAFE_RETRYABLE`.
 *
 * | outcome          | result                                                      |
 * |------------------|-------------------------------------------------------------|
 * | confirmed        | `{ recordResult: { status:'PUBLISHED', uri, cid, providerId:uri } }` — PDS storage IS the confirmation (§14) |
 * | ambiguous        | `{ recordResult: { status:'AMBIGUOUS', evidence } }`         |
 * | rejected         | `{ recordResult: { status:'FAILED_PERMANENT', errorClass } }` |
 * | rate-limited     | `{ recordResult: { status:'RETRYABLE', safeToRetry:true, retryAt } }` — §17 "429 auténtico que rechaza solicitud → Sí". Provably no-effect only because ATProto's rate limiter rejects pre-handler AND the fixed XRPC endpoint follows no redirects; the frozen `rkey` + `swapRecord:null` + reconcile-by-rkey is the structural backstop if a "429" ever hid a completed write (§6). The retry MUST reuse the frozen `rkey`/record (`state.recordIntent` does this for any bluesky pair that already has one). |
 * | auth-invalid     | `{ halt:'auth-invalid' }` — misconfiguration; stop the run   |
 * | session-expired  | `{ halt:'session-expired' }` — every send will fail; stop; the PUBLISHING reservation is reconciled next run |
 * | record-conflict  | `{ reconcile:'record-conflict' }` — never a `recordResult`. Not produced by any client method here (a `reconcile()` that finds a different record returns `RECONCILE_DECISION.CONFLICT`, handled by {@link reconciliationParams}); kept for an orchestrator that synthesises it. |
 *
 * @param {PublishResult} pub
 * @param {{ now?: () => number, retryDelayMs?: number }} [options]
 * @returns {{ recordResult?: LedgerSendResult, halt?: string, reconcile?: string, evidence?: Record<string, unknown> }}
 */
export function toRecordResult(pub, { now = () => Date.now(), retryDelayMs = 15 * 60_000 } = {}) {
  if (!isPlainObject(pub) || !isNonEmptyString(pub.outcome)) {
    throw new BlueskyError('CONFIG', 'toRecordResult needs a PublishResult with an outcome');
  }
  switch (pub.outcome) {
    case PUBLISH_OUTCOME.CONFIRMED:
      return {
        recordResult: {
          status: 'PUBLISHED',
          uri: pub.uri,
          cid: pub.cid,
          providerId: pub.uri,
          evidence: pub.evidence,
        },
      };
    case PUBLISH_OUTCOME.AMBIGUOUS:
      return {
        recordResult: {
          status: 'AMBIGUOUS',
          ...(pub.errorClass ? { errorClass: pub.errorClass } : {}),
          evidence: pub.evidence,
        },
      };
    case PUBLISH_OUTCOME.REJECTED:
      return {
        recordResult: {
          status: 'FAILED_PERMANENT',
          ...(pub.errorClass ? { errorClass: pub.errorClass } : {}),
          evidence: pub.evidence,
        },
      };
    case PUBLISH_OUTCOME.RATE_LIMITED: {
      const at = typeof now === 'function' ? now() : Date.now();
      const wait = Math.max(retryDelayMs, Number(pub.retryAfterMs) || 0);
      return {
        recordResult: {
          status: 'RETRYABLE',
          safeToRetry: true,
          retryAt: new Date(at + wait).toISOString(),
          evidence: pub.evidence,
        },
      };
    }
    case PUBLISH_OUTCOME.AUTH_INVALID:
    case PUBLISH_OUTCOME.SESSION_EXPIRED:
      return { halt: pub.outcome, evidence: pub.evidence };
    case PUBLISH_OUTCOME.RECORD_CONFLICT:
      return { reconcile: 'record-conflict', evidence: pub.evidence };
    default:
      throw new BlueskyError(
        'CONFIG',
        `unmappable PublishResult outcome ${JSON.stringify(pub.outcome)}`
      );
  }
}

/**
 * Translate a `reconcile()` decision to `state.recordReconciliation` params.
 * Returns a descriptor; it does NOT call the ledger — the orchestrator
 * re-applies its controls first (task §4).
 *
 * The authority is `state.recordReconciliation` as it implements §15's
 * "Resolución humana segura": `adopt` needs AMBIGUOUS/ACCEPTED; `block` is
 * always allowed; `authorize-retry` is `kind:'resolve'` + a human actor +
 * `expectedRevision` + ISO `retryAt` (never automatic — §15 "authorize-retry
 * ... sólo tras comprobar ausencia"). This adapter only ever emits automatic
 * `adopt`/`block` descriptors; `retry-safe` and `uncertain` call nothing.
 *
 * | decision   | descriptor                                                            |
 * |------------|----------------------------------------------------------------------|
 * | confirmed  | `{ call:'recordReconciliation', kind:'adopt', target:'PUBLISHED', uri, cid }` |
 * | conflict   | `{ call:'recordReconciliation', kind:'block', resolution:{ reason, evidence } }` |
 * | retry-safe | `{ call:null, proposal:'authorize-retry', note }` — human `resolve` OR a fresh `recordIntent({ resume:{ safeBlueskyRetry:true } })`; caller decides |
 * | uncertain  | `{ call:null }` — no state change; re-check next run                  |
 *
 * @param {{ decision: string, uri?: string, cid?: string|null, proposal?: object, evidence?: object }} recon
 * @param {{ actor?: string, reason?: string }} [meta]
 */
export function reconciliationParams(recon, { actor = 'social-orchestrator', reason } = {}) {
  if (!isPlainObject(recon) || !isNonEmptyString(recon.decision)) {
    throw new BlueskyError('CONFIG', 'reconciliationParams needs a decision');
  }
  switch (recon.decision) {
    case RECONCILE_DECISION.CONFIRMED:
      return {
        call: 'recordReconciliation',
        kind: 'adopt',
        target: 'PUBLISHED',
        ...(isNonEmptyString(recon.uri) ? { uri: recon.uri } : {}),
        ...(isNonEmptyString(recon.cid) ? { cid: recon.cid } : {}),
        resolution: {
          actor,
          reason: reason ?? 'getRecord returned the frozen record',
          evidence: recon.evidence ?? null,
        },
      };
    case RECONCILE_DECISION.CONFLICT:
      return {
        call: 'recordReconciliation',
        kind: 'block',
        resolution: {
          actor,
          reason: reason ?? 'a different record occupies the frozen rkey',
          evidence: recon.evidence ?? null,
        },
      };
    case RECONCILE_DECISION.RETRY_SAFE:
      return {
        call: null,
        proposal: 'authorize-retry',
        reissue: recon.proposal ?? null,
        note: 'authoritative absence: re-issue the SAME record + rkey only after the orchestrator/human re-authorises',
      };
    case RECONCILE_DECISION.UNCERTAIN:
      return {
        call: null,
        note: 'reconciliation is uncertain; keep the reservation and re-check next run',
      };
    default:
      throw new BlueskyError(
        'CONFIG',
        `unknown reconcile decision ${JSON.stringify(recon.decision)}`
      );
  }
}
