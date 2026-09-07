import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';

import { ERROR_CLASS, HttpError, classifyStatus, request, requestJson } from './http.js';

/**
 * The durable state authority for the social publisher (plan
 * social-distribution §2 / §3 / §12 / §15 / §16 / §18).
 *
 * One `state.json` on a dedicated `social-state` branch is the single source of
 * truth for what has been reserved, sent, accepted, confirmed or blocked, keyed
 * by `social.id × platform`. This module owns:
 *
 * - **Loading** — resolve the branch commit, read the file *at that commit*, and
 *   validate the §15 model. A missing branch/file in normal operation is an
 *   error (`STATE_NOT_INITIALIZED`); it is never treated as a fresh install.
 * - **Compare-and-swap** — write through the GitHub Contents API with the blob
 *   SHA read from the same commit. On a `409/422` conflict the caller re-reads
 *   and recomputes the transition against the *current* state; it never
 *   overwrites someone else's success. On a lost PUT response it proves whether
 *   the transition landed via the per-entry `intent_id` evidence (the global
 *   `last_transition_nonce` is only a fast-path *positive* signal — its absence
 *   is not proof a write never happened, §2). When it cannot prove the result,
 *   it returns `indeterminate`, which forces the orchestrator to stop all new
 *   sends.
 * - **Reservations** — `recordIntent` reserves a `social.id × platform` pair for
 *   an exact run+attempt before the caller may send. Two contenders on the same
 *   blob SHA: CAS lets exactly one win; the loser sees the live owner and does
 *   not send. An abandoned reservation is recovered only once its owner is
 *   *proven* finished (`evaluateOwnerLiveness`), and only to `AMBIGUOUS` — never
 *   to a fresh send.
 * - **Results & immutability** — `recordResult` applies only the §15
 *   transitions. `PUBLISHED` is terminal for automatic distribution; `ACCEPTED`
 *   keeps its Buffer id; `AMBIGUOUS` keeps its evidence and frozen payload; a
 *   destination change blocks continuation; changing copy / image / hash /
 *   generator version never restarts a delivery or regenerates a frozen attempt.
 * - **Explicit initialization** — `initializeState` creates the orphan branch
 *   with the Git Data API. It is a separate operation from the normal loader and
 *   verifies (never replaces) an existing branch.
 *
 * This module never publishes social content and never inspects the social HTTP
 * payload: `frozen_payload` is stored and hashed as opaque bytes. It imports
 * `getRunStatus` from `./github.js` for owner-liveness reads (an import, not a
 * modification of that module).
 */

// --- constants -----------------------------------------------------------

export const SCHEMA_VERSION = 1;
export const STATE_BRANCH = 'social-state';
export const STATE_PATH = 'state.json';
export const GITHUB_API_HOST = 'api.github.com';

/** JSON size ceiling and soft warning threshold (plan §15). */
export const STATE_MAX_BYTES = 10 * 1024 * 1024;
export const STATE_WARN_BYTES = 8 * 1024 * 1024;

/** The §15 state machine. `PENDING` is the absence of a platform entry. */
export const STATUS = Object.freeze({
  PENDING: 'PENDING',
  PUBLISHING: 'PUBLISHING',
  ACCEPTED: 'ACCEPTED',
  AMBIGUOUS: 'AMBIGUOUS',
  RETRYABLE: 'RETRYABLE',
  FAILED_PERMANENT: 'FAILED_PERMANENT',
  BLOCKED: 'BLOCKED',
  PUBLISHED: 'PUBLISHED',
});

/**
 * What a caller must do with every result this module can produce (plan
 * §15 "Falló guardar éxito" / §17 "Ledger no guardable"). The future
 * orchestrator (package 8) and the administrative CLI (package 9) are bound by
 * this table; it is exported so it can be asserted, not re-derived from prose.
 *
 * `haltOutcomes` / `haltErrorCodes` — **stop every new send, on every network,
 * for the rest of the run.** Either a durable write could not be proven, or the
 * ledger itself is unusable. Reservations already made stay durable and are
 * reconciled by a later run; nothing new may be sent, because the ledger can no
 * longer prove what was already sent.
 *
 * `pairOutcomes` / `pairErrorCodes` — **skip this `social.id × platform` pair
 * and continue with the next one.** The ledger is healthy and answered
 * authoritatively; this particular pair is simply not eligible now.
 *
 * `stale-micros` is deliberately in the *pair* class: it means "another
 * reservation already took that TID value, re-mint the rkey from `nextMicros`
 * and call `recordIntent` again", never a halt.
 *
 * `storeCodes` are raised by the {@link StateStore} adapter and resolved
 * *inside* this module (a conflict is re-planned, a missing branch/file becomes
 * `STATE_NOT_INITIALIZED`). A caller never has to classify them.
 *
 * `programmingErrorCodes` mean the call itself was wrong: fail the run loudly,
 * never retry.
 *
 * `REVISION_STALE` reaches only the operator path (`kind: 'resolve'`): the
 * ledger moved under a human decision, which must be re-read and re-issued.
 *
 * A `tests/social/state.test.ts` case asserts every `StateError` code raised in
 * this file appears in exactly one of these lists, so the table cannot drift
 * away from the implementation.
 */
export const SEND_HALT_CONTRACT = Object.freeze({
  haltOutcomes: Object.freeze(['indeterminate']),
  haltErrorCodes: Object.freeze([
    'STATE_NOT_INITIALIZED',
    'CORRUPT_STATE',
    'UNKNOWN_SCHEMA',
    'SIZE_LIMIT',
    'MALFORMED_STORE_RESPONSE',
    'INIT_RACE_UNRESOLVED',
  ]),
  pairOutcomes: Object.freeze(['noop', 'conflict', 'superseded', 'stale-micros']),
  pairErrorCodes: Object.freeze([
    'TERMINAL',
    'INVALID_TRANSITION',
    'RETRY_NOT_DUE',
    'DESTINATION_CHANGED',
    'IDENTITY_CONFLICT',
    'NO_RESERVATION',
    'NOT_OWNER',
    'OWNER_ALIVE',
    'OWNER_UNKNOWN',
    'CONFLICTING_PROVIDER_ID',
    'UNSAFE_RETRYABLE',
    'REVISION_STALE',
  ]),
  storeCodes: Object.freeze(['CAS_CONFLICT', 'BRANCH_MISSING', 'FILE_MISSING', 'BRANCH_EXISTS']),
  programmingErrorCodes: Object.freeze(['CONFIG', 'REVISION_NOT_ADVANCED', 'NONCE_MISMATCH']),
});

const ALL_STATUSES = new Set(Object.values(STATUS));
/** Statuses a `recordResult` call may be applied to. */
const RESULT_SOURCE_STATUSES = new Set([STATUS.PUBLISHING, STATUS.ACCEPTED, STATUS.AMBIGUOUS]);
/**
 * Allowed result targets per current status (plan §15 transition table). A
 * `RETRYABLE` target additionally requires `result.safeToRetry === true`.
 */
const RESULT_TRANSITIONS = Object.freeze({
  [STATUS.PUBLISHING]: new Set([
    STATUS.ACCEPTED,
    STATUS.PUBLISHED,
    STATUS.AMBIGUOUS,
    STATUS.RETRYABLE,
    STATUS.FAILED_PERMANENT,
  ]),
  // "conserva ID aunque polling falle": ACCEPTED never regresses to a state
  // that would authorise another create.
  [STATUS.ACCEPTED]: new Set([STATUS.PUBLISHED, STATUS.FAILED_PERMANENT]),
  // Ambiguity is only ever resolved *up* by evidence, or hard-blocked.
  [STATUS.AMBIGUOUS]: new Set([STATUS.ACCEPTED, STATUS.PUBLISHED, STATUS.BLOCKED]),
});

/** Statuses `recordIntent` may reserve over (fresh, a due retry, a safe bsky retry). */
const INTENT_SOURCE_STATUSES = new Set([STATUS.PENDING, STATUS.RETRYABLE, STATUS.AMBIGUOUS]);

const SOCIAL_ID_RE = /^[0-9a-f]{64}$/;
const REPO_RE = /^[^/\s]+\/[^/\s]+$/;
const PLATFORMS = new Set(['facebook', 'x', 'linkedin', 'bluesky']);

const API_HEADERS = Object.freeze({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'noticiencias-social-distribution',
});

// --- errors ------------------------------------------------------------

/**
 * A durable-state failure. `code` is stable and drives caller behaviour;
 * `message` is already sanitized and is not user copy.
 */
export class StateError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [detail]
   */
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'StateError';
    this.code = code;
    this.detail = detail;
  }
}

// --- pure model: validation & serialization --------------------------

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/**
 * Validate and normalize a parsed `state.json` object against the §15 model.
 * Rejects a corrupt document, an unknown schema version, and structurally
 * invalid status combinations *before* anything is written (plan §1).
 *
 * @param {unknown} parsed
 * @returns {import('./state.js').SocialState}
 */
export function validateState(parsed) {
  if (!isPlainObject(parsed)) {
    throw new StateError('CORRUPT_STATE', 'state.json is not a JSON object');
  }
  if (parsed.schema_version !== SCHEMA_VERSION) {
    throw new StateError(
      'UNKNOWN_SCHEMA',
      `unsupported state schema_version ${JSON.stringify(parsed.schema_version)} (expected ${SCHEMA_VERSION})`
    );
  }

  const problems = [];

  if (!isIsoDate(parsed.initialized_at)) problems.push('initialized_at must be an ISO date');
  const revision = parsed.revision;
  if (!Number.isInteger(revision) || revision < 0) problems.push('revision must be a >= 0 integer');
  if (parsed.last_transition_nonce !== null && !isNonEmptyString(parsed.last_transition_nonce)) {
    problems.push('last_transition_nonce must be a non-empty string or null');
  }
  const micros = parsed.last_allocated_bluesky_micros;
  if (!Number.isInteger(micros) || micros < 0) {
    problems.push('last_allocated_bluesky_micros must be a >= 0 integer');
  }
  if (!isPlainObject(parsed.proven_deploys)) problems.push('proven_deploys must be an object');
  if (!isPlainObject(parsed.articles)) problems.push('articles must be an object');

  if (problems.length > 0) {
    throw new StateError('CORRUPT_STATE', `state.json is corrupt: ${problems.join('; ')}`);
  }

  const articles = {};
  for (const [socialId, rawArticle] of Object.entries(parsed.articles)) {
    if (!SOCIAL_ID_RE.test(socialId)) {
      throw new StateError('CORRUPT_STATE', `articles key "${socialId}" is not a 64-hex social id`);
    }
    articles[socialId] = validateArticleEntry(socialId, rawArticle);
  }

  return {
    schema_version: SCHEMA_VERSION,
    initialized_at: parsed.initialized_at,
    revision,
    last_transition_nonce: parsed.last_transition_nonce ?? null,
    last_allocated_bluesky_micros: micros,
    proven_deploys: normalizeProvenDeploys(parsed.proven_deploys),
    articles,
  };
}

function validateArticleEntry(socialId, raw) {
  if (!isPlainObject(raw)) {
    throw new StateError('CORRUPT_STATE', `articles["${socialId}"] is not an object`);
  }
  const collectionIds = Array.isArray(raw.collection_ids) ? raw.collection_ids.map(String) : null;
  const canonicalUrls = Array.isArray(raw.canonical_urls) ? raw.canonical_urls.map(String) : null;
  if (
    !collectionIds ||
    !canonicalUrls ||
    !isIsoDate(raw.first_seen_at) ||
    !isPlainObject(raw.platforms)
  ) {
    throw new StateError(
      'CORRUPT_STATE',
      `articles["${socialId}"] must carry collection_ids[], canonical_urls[], first_seen_at, platforms{}`
    );
  }
  const platforms = {};
  for (const [platform, rawPlatform] of Object.entries(raw.platforms)) {
    if (!PLATFORMS.has(platform)) {
      throw new StateError(
        'CORRUPT_STATE',
        `articles["${socialId}"] has unknown platform "${platform}"`
      );
    }
    platforms[platform] = validatePlatformEntry(socialId, platform, rawPlatform);
  }
  return {
    collection_ids: dedupe(collectionIds),
    canonical_urls: dedupe(canonicalUrls),
    first_seen_at: raw.first_seen_at,
    platforms,
    ...(raw.tombstone ? { tombstone: raw.tombstone } : {}),
  };
}

function validatePlatformEntry(socialId, platform, raw) {
  if (!isPlainObject(raw)) {
    throw new StateError('CORRUPT_STATE', `${socialId}/${platform} entry is not an object`);
  }
  const status = raw.status;
  if (!ALL_STATUSES.has(status)) {
    throw new StateError(
      'CORRUPT_STATE',
      `${socialId}/${platform} has unknown status ${JSON.stringify(status)}`
    );
  }
  if (!isNonEmptyString(raw.intent_id)) {
    // Invariant (i): no transition ever drops intent_id. A stored entry
    // without one is corrupt, not "PENDING".
    throw new StateError('CORRUPT_STATE', `${socialId}/${platform} has no intent_id`);
  }
  if (!isNonEmptyString(raw.account_key)) {
    throw new StateError('CORRUPT_STATE', `${socialId}/${platform} has no account_key`);
  }

  // Structurally invalid combinations (plan §1 "combinaciones inválidas").
  if (status === STATUS.PUBLISHING || status === STATUS.ACCEPTED) {
    if (!isNonEmptyString(raw.owner_run_id) || !Number.isInteger(raw.owner_attempt)) {
      throw new StateError(
        'CORRUPT_STATE',
        `${socialId}/${platform} is ${status} without an owner`
      );
    }
  }
  if (status === STATUS.ACCEPTED && !isNonEmptyString(raw.provider_id)) {
    throw new StateError(
      'CORRUPT_STATE',
      `${socialId}/${platform} is ACCEPTED without a provider_id`
    );
  }
  const LIVE =
    status === STATUS.PUBLISHING || status === STATUS.ACCEPTED || status === STATUS.AMBIGUOUS;
  if (LIVE && !isPlainObject(raw.frozen_payload)) {
    // The frozen copy is retained for every in-flight state and dropped only
    // when PUBLISHED (plan §15 model / §435).
    throw new StateError(
      'CORRUPT_STATE',
      `${socialId}/${platform} is ${status} without a frozen_payload`
    );
  }
  if (platform === 'bluesky' && LIVE) {
    // A Bluesky attempt must carry its frozen record key and createdAt so a
    // "same conditional put" retry never mints a new TID (plan §14).
    if (!isNonEmptyString(raw.rkey) || !isIsoDate(raw.created_at)) {
      throw new StateError(
        'CORRUPT_STATE',
        `${socialId}/bluesky is ${status} without a frozen rkey / created_at`
      );
    }
  }
  if (status === STATUS.RETRYABLE && !isIsoDate(raw.retry_at)) {
    throw new StateError(
      'CORRUPT_STATE',
      `${socialId}/${platform} is RETRYABLE without a retry_at`
    );
  }

  return { ...raw, status, account_key: String(raw.account_key), intent_id: String(raw.intent_id) };
}

function normalizeProvenDeploys(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isPlainObject(value)) out[key] = value;
  }
  return out;
}

function dedupe(list) {
  return [...new Set(list)];
}

/**
 * Deterministic JSON (keys sorted lexicographically). Used so the serialized
 * bytes — and therefore the blob SHA — are stable across processes and diffs
 * stay small.
 * @param {unknown} value
 * @returns {string}
 */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/**
 * Serialize a state object to canonical JSON, enforcing the §15 size ceiling.
 * @param {import('./state.js').SocialState} state
 * @param {{ maxBytes?: number, warnBytes?: number }} [options]
 * @returns {{ text: string, bytes: number, warn: boolean }}
 */
export function serializeState(
  state,
  { maxBytes = STATE_MAX_BYTES, warnBytes = STATE_WARN_BYTES } = {}
) {
  // Injected limits may only tighten the ceiling. A caller (or a test helper
  // reused in production) cannot raise it past the §15 hard limit.
  const cap = Math.min(Number(maxBytes) || STATE_MAX_BYTES, STATE_MAX_BYTES);
  const warnAt = Math.min(Number(warnBytes) || STATE_WARN_BYTES, cap);
  const text = `${stableStringify(state)}\n`;
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > cap) {
    // Never auto-compact tombstones to "free space": stop new deliveries and
    // require an explicit partition (plan §15).
    throw new StateError(
      'SIZE_LIMIT',
      `state.json would be ${bytes} bytes, over the ${cap} ceiling`,
      {
        bytes,
        maxBytes: cap,
      }
    );
  }
  return { text, bytes, warn: bytes >= warnAt };
}

// --- GitHub contents store (real implementation) --------------------

function apiOptions(fetchImpl, token, timeoutMs) {
  const headers = { ...API_HEADERS };
  const secrets = [];
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    secrets.push(token);
  }
  return {
    fetchImpl,
    headers,
    allowedHosts: [GITHUB_API_HOST],
    followRedirects: false,
    maxBytes: 12 * 1024 * 1024,
    timeoutMs: timeoutMs ?? 15_000,
    secrets,
  };
}

/**
 * The injectable GitHub storage contract `state.js` writes through. Tests pass
 * a fake object with the same four methods; production uses
 * {@link createContentsStore}.
 *
 * @typedef {object} StateStore
 * @property {() => Promise<{ commitSha: string }>} readBranchHead
 *   resolves `refs/heads/<branch>` to its commit; throws
 *   `StateError('BRANCH_MISSING')` when the ref does not exist.
 * @property {(commitSha: string) => Promise<{ contentText: string, blobSha: string }>} readFileAtCommit
 *   reads `state.json` *at that exact commit*; throws
 *   `StateError('FILE_MISSING')` when the path is absent there.
 * @property {(input: { expectedBlobSha: string, contentText: string, message: string }) => Promise<{ commitSha: string, blobSha: string }>} putFile
 *   Contents-API update with the expected blob SHA; throws
 *   `StateError('CAS_CONFLICT')` on `409/422`. A thrown network/timeout error
 *   means the response was lost — the write may or may not have applied.
 * @property {(input: { contentText: string, message: string }) => Promise<{ commitSha: string }>} createOrphanBranch
 *   Git-Data-API creation of the branch from a parentless root commit; throws
 *   `StateError('BRANCH_EXISTS')` when the ref already exists.
 */

/**
 * @param {{
 *   fetchImpl: import('./http.js').FetchLike,
 *   token: string,
 *   repository: string,
 *   branch?: string,
 *   path?: string,
 *   timeoutMs?: number,
 * }} config
 * @returns {StateStore}
 */
export function createContentsStore(config) {
  const {
    fetchImpl,
    token,
    repository,
    branch = STATE_BRANCH,
    path = STATE_PATH,
    timeoutMs,
  } = config;
  if (!REPO_RE.test(String(repository))) {
    throw new StateError('CONFIG', 'repository must be "owner/repo"');
  }
  const base = `https://${GITHUB_API_HOST}/repos/${repository}`;
  const opts = () => apiOptions(fetchImpl, token, timeoutMs);

  return {
    async readBranchHead() {
      const url = `${base}/git/ref/heads/${encodeURIComponent(branch)}`;
      const { result, json } = await requestJson(url, opts());
      if (result.status === 404) {
        throw new StateError('BRANCH_MISSING', `branch ${branch} does not exist`);
      }
      if (classifyStatus(result.status, result.headers) !== ERROR_CLASS.OK) {
        throw new HttpError(
          classifyStatus(result.status, result.headers),
          `github ${result.status} on ref read`,
          {
            status: result.status,
          }
        );
      }
      const sha = json && json.object && json.object.sha;
      if (!isNonEmptyString(sha)) {
        throw new StateError('MALFORMED_STORE_RESPONSE', 'ref read returned no object.sha');
      }
      return { commitSha: String(sha) };
    },

    async readFileAtCommit(commitSha) {
      const url = `${base}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(commitSha)}`;
      const { result, json } = await requestJson(url, opts());
      if (result.status === 404) {
        throw new StateError('FILE_MISSING', `${path} is absent at commit ${commitSha}`);
      }
      if (classifyStatus(result.status, result.headers) !== ERROR_CLASS.OK) {
        throw new HttpError(
          classifyStatus(result.status, result.headers),
          `github ${result.status} on file read`,
          {
            status: result.status,
          }
        );
      }
      const blobSha = json && json.sha;
      if (!isNonEmptyString(blobSha)) {
        throw new StateError('MALFORMED_STORE_RESPONSE', 'file read returned no sha');
      }
      let contentText;
      if (json.encoding === 'base64' && typeof json.content === 'string' && json.content !== '') {
        contentText = Buffer.from(json.content, 'base64').toString('utf8');
      } else {
        // > 1 MiB: the JSON form omits `content`. Re-read the raw blob at the
        // same commit; the blob SHA from the JSON form still applies.
        const rawUrl = `${base}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(commitSha)}`;
        const rawOpts = opts();
        rawOpts.headers = { ...rawOpts.headers, Accept: 'application/vnd.github.raw' };
        const raw = await request(rawUrl, rawOpts);
        if (classifyStatus(raw.status, raw.headers) !== ERROR_CLASS.OK || raw.bodyText === '') {
          throw new StateError('MALFORMED_STORE_RESPONSE', 'large file raw read returned no body');
        }
        contentText = raw.bodyText;
      }
      return { contentText, blobSha: String(blobSha) };
    },

    async putFile({ expectedBlobSha, contentText, message }) {
      const url = `${base}/contents/${encodeURIComponent(path)}`;
      const body = JSON.stringify({
        message,
        branch,
        sha: expectedBlobSha,
        content: Buffer.from(contentText, 'utf8').toString('base64'),
      });
      const putOpts = opts();
      const { result, json } = await requestJson(url, {
        ...putOpts,
        method: 'PUT',
        headers: { ...putOpts.headers, 'Content-Type': 'application/json' },
        body,
      });
      if (result.status === 409 || result.status === 422) {
        throw new StateError(
          'CAS_CONFLICT',
          `github ${result.status}: state.json changed under the write`,
          {
            status: result.status,
          }
        );
      }
      if (classifyStatus(result.status, result.headers) !== ERROR_CLASS.OK) {
        throw new HttpError(
          classifyStatus(result.status, result.headers),
          `github ${result.status} on file write`,
          {
            status: result.status,
          }
        );
      }
      const commitSha = json && json.commit && json.commit.sha;
      const blobSha = json && json.content && json.content.sha;
      if (!isNonEmptyString(commitSha) || !isNonEmptyString(blobSha)) {
        throw new StateError(
          'MALFORMED_STORE_RESPONSE',
          'file write returned no commit/content sha'
        );
      }
      return { commitSha: String(commitSha), blobSha: String(blobSha) };
    },

    async createOrphanBranch({ contentText, message }) {
      const blob = await postJson(`${base}/git/blobs`, opts(), {
        content: Buffer.from(contentText, 'utf8').toString('base64'),
        encoding: 'base64',
      });
      const tree = await postJson(`${base}/git/trees`, opts(), {
        tree: [{ path, mode: '100644', type: 'blob', sha: blob.sha }],
      });
      const commit = await postJson(`${base}/git/commits`, opts(), {
        message,
        tree: tree.sha,
        parents: [],
      });
      const refUrl = `${base}/git/refs`;
      const { result } = await requestJson(refUrl, {
        ...opts(),
        method: 'POST',
        headers: { ...opts().headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
      });
      if (result.status === 422) {
        throw new StateError('BRANCH_EXISTS', `branch ${branch} already exists`);
      }
      if (classifyStatus(result.status, result.headers) !== ERROR_CLASS.OK) {
        throw new HttpError(
          classifyStatus(result.status, result.headers),
          `github ${result.status} on ref create`,
          {
            status: result.status,
          }
        );
      }
      return { commitSha: String(commit.sha) };
    },
  };
}

async function postJson(url, options, payload) {
  const { result, json } = await requestJson(url, {
    ...options,
    method: 'POST',
    headers: { ...options.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (classifyStatus(result.status, result.headers) !== ERROR_CLASS.OK) {
    throw new HttpError(
      classifyStatus(result.status, result.headers),
      `github ${result.status} on ${url}`,
      {
        status: result.status,
      }
    );
  }
  if (!json || !isNonEmptyString(json.sha)) {
    throw new StateError('MALFORMED_STORE_RESPONSE', `git data POST to ${url} returned no sha`);
  }
  return json;
}

// --- load --------------------------------------------------------------

/**
 * Load the current state, read consistently at one immutable commit.
 *
 * @param {{ store: StateStore }} params
 * @returns {Promise<{ state: import('./state.js').SocialState, commitSha: string, blobSha: string }>}
 */
export async function loadState({ store }) {
  let head;
  try {
    head = await store.readBranchHead();
  } catch (error) {
    if (error instanceof StateError && error.code === 'BRANCH_MISSING') {
      throw new StateError(
        'STATE_NOT_INITIALIZED',
        'the social-state branch is absent; this is an error, not a fresh install (run init once)'
      );
    }
    throw error;
  }

  let file;
  try {
    file = await store.readFileAtCommit(head.commitSha);
  } catch (error) {
    if (error instanceof StateError && error.code === 'FILE_MISSING') {
      throw new StateError(
        'STATE_NOT_INITIALIZED',
        'state.json is absent on the social-state branch; this is an error, not a fresh install'
      );
    }
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(file.contentText);
  } catch {
    throw new StateError('CORRUPT_STATE', 'state.json is not valid JSON');
  }
  const state = validateState(parsed);
  return { state, commitSha: head.commitSha, blobSha: file.blobSha };
}

// --- compare-and-swap primitive ------------------------------------

/**
 * @typedef {object} CasResult
 * @property {'applied'|'conflict'|'indeterminate'} outcome
 *   - `applied`: the transition is durably persisted.
 *   - `conflict`: the write was rejected (or provably did not land); the caller
 *     must recompute against `state` and retry.
 *   - `indeterminate`: the write's result cannot be proven. The caller MUST
 *     stop all new sends until state is reconciled (plan §2/§15).
 * @property {import('./state.js').SocialState} [state] current state (on
 *   `applied` = the new state; on `conflict` = the reloaded state).
 * @property {string} [commitSha]
 * @property {string} [blobSha]
 */

/**
 * One compare-and-swap write of `nextState` over `base`.
 *
 * Requires `nextState.revision === base.revision + 1` — a content-level CAS
 * check independent of the blob SHA (plan §15 `resolve-state` "expected
 * revision"). A non-advancing revision is a programming error and is rejected
 * before any network call.
 *
 * On a lost PUT response the caller-supplied `verify(reloadedState)` decides
 * `'applied' | 'not-applied' | 'indeterminate'` from the per-entry evidence;
 * `last_transition_nonce === nonce` is checked first as a fast positive path,
 * but its *absence* is never read as proof of non-application (§2).
 *
 * @param {{
 *   store: StateStore,
 *   base: import('./state.js').SocialState,
 *   blobSha: string,
 *   nextState: import('./state.js').SocialState,
 *   nonce: string,
 *   message: string,
 *   verify?: (reloaded: import('./state.js').SocialState) => 'applied' | 'not-applied' | 'indeterminate',
 *   limits?: { maxBytes?: number, warnBytes?: number },
 * }} params
 * @returns {Promise<CasResult>}
 */
export async function compareAndSwap({
  store,
  base,
  blobSha,
  nextState,
  nonce,
  message,
  verify,
  limits,
}) {
  if (nextState.revision !== base.revision + 1) {
    throw new StateError(
      'REVISION_NOT_ADVANCED',
      `next revision ${nextState.revision} must be exactly base revision ${base.revision} + 1`
    );
  }
  if (nextState.last_transition_nonce !== nonce) {
    throw new StateError(
      'NONCE_MISMATCH',
      'nextState.last_transition_nonce must equal the transition nonce'
    );
  }

  const { text } = serializeState(nextState, limits);

  let written;
  try {
    written = await store.putFile({ expectedBlobSha: blobSha, contentText: text, message });
  } catch (error) {
    if (error instanceof StateError && error.code === 'CAS_CONFLICT') {
      const reloaded = await loadState({ store }).catch(() => null);
      if (!reloaded) return { outcome: 'indeterminate' };
      return {
        outcome: 'conflict',
        state: reloaded.state,
        commitSha: reloaded.commitSha,
        blobSha: reloaded.blobSha,
      };
    }
    // Any other thrown error = the response was lost. The write may have
    // applied server-side. Prove it or stop.
    let reloaded;
    try {
      reloaded = await loadState({ store });
    } catch {
      return { outcome: 'indeterminate' };
    }
    if (reloaded.state.last_transition_nonce === nonce) {
      // Fast positive path. Cross-checked against the caller's per-entry
      // evidence: with unique nonces the two can never disagree, so a
      // `not-applied` verdict here means the nonce is not the proof it claims
      // to be — never authorize on it.
      const crossCheck = typeof verify === 'function' ? verify(reloaded.state) : 'applied';
      if (crossCheck !== 'not-applied') {
        return {
          outcome: 'applied',
          state: reloaded.state,
          commitSha: reloaded.commitSha,
          blobSha: reloaded.blobSha,
        };
      }
      return { outcome: 'indeterminate' };
    }
    const verdict = typeof verify === 'function' ? verify(reloaded.state) : 'indeterminate';
    if (verdict === 'applied') {
      return {
        outcome: 'applied',
        state: reloaded.state,
        commitSha: reloaded.commitSha,
        blobSha: reloaded.blobSha,
      };
    }
    if (verdict === 'not-applied') {
      return {
        outcome: 'conflict',
        state: reloaded.state,
        commitSha: reloaded.commitSha,
        blobSha: reloaded.blobSha,
      };
    }
    return { outcome: 'indeterminate' };
  }

  return {
    outcome: 'applied',
    state: nextState,
    commitSha: written.commitSha,
    blobSha: written.blobSha,
  };
}

// --- transition helpers ---------------------------------------------

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeNonce(session) {
  // `last_transition_nonce` is the plan's *positive* proof that a transition
  // landed (§15 "Si el nonce de transición está presente, la transición
  // ocurrió"). That proof is only sound while nonces are globally unique, so
  // uniqueness is structural here: an injected `newNonce` may add a readable
  // label, but it can never replace the random component.
  const label = typeof session?.newNonce === 'function' ? `${session.newNonce()}:` : '';
  return `${session?.runId ?? 'run'}:${session?.attempt ?? 0}:${label}${randomUUID()}`;
}

function nowIso(now) {
  return new Date(typeof now === 'function' ? now() : Date.now()).toISOString();
}

function requireSession(session) {
  if (!isNonEmptyString(session?.runId) || !Number.isInteger(session?.attempt)) {
    throw new StateError('CONFIG', 'session must carry { runId: string, attempt: integer }');
  }
}

function platformEntry(state, socialId, platform) {
  return state.articles?.[socialId]?.platforms?.[platform] ?? null;
}

function currentStatus(entry) {
  return entry ? entry.status : STATUS.PENDING;
}

/**
 * Another article entry (a *different* social id) already owns this file or
 * canonical URL → identity conflict, zero writes for this article (plan §8).
 */
function identityConflict(state, socialId, collectionId, canonicalUrl) {
  for (const [id, entry] of Object.entries(state.articles ?? {})) {
    if (id === socialId) continue;
    if (
      (entry.collection_ids ?? []).includes(collectionId) ||
      (entry.canonical_urls ?? []).includes(canonicalUrl)
    ) {
      return id;
    }
  }
  return null;
}

/**
 * Build `nextState` from a mutator, advancing revision by one and stamping the
 * transition nonce. The mutator receives a deep clone and mutates it in place.
 */
function applyTransition(base, session, mutate) {
  const next = clone(base);
  const nonce = makeNonce(session);
  mutate(next);
  next.revision = base.revision + 1;
  next.last_transition_nonce = nonce;
  return { next, nonce };
}

/**
 * A generic bounded CAS loop: load, precondition, mutate, swap; on `conflict`,
 * reload and recompute up to `maxAttempts` times. `indeterminate` short-circuits.
 *
 * `plan(state)` returns `{ mutate, verify, message }` or throws a `StateError`
 * for an illegal transition (never retried). `plan` may also return
 * `{ shortCircuit: <result> }` to stop the loop with a caller-facing result
 * (e.g. "already reserved by someone else").
 *
 * `limits` is threaded to the pre-write size check and to `compareAndSwap`. The
 * stop-on-exhausted-conflict flag maps a 3-conflict exhaustion to
 * `indeterminate` instead of `conflict`: for a post-send transition
 * (`recordResult` / `recordReconciliation`) an unpersisted result must halt all
 * new sends (plan §546), never let the caller move on to the next pair.
 */
async function runTransition({
  store,
  session,
  maxAttempts = 3,
  plan,
  limits,
  stopOnExhaustedConflict = false,
}) {
  requireSession(session);
  let attempt = 0;
  let lastConflictState = null;
  let sizeWarning = false;
  while (attempt < maxAttempts) {
    attempt += 1;
    const { state, blobSha } = await loadState({ store });
    const planned = plan(state);
    if (planned && planned.shortCircuit) return planned.shortCircuit;
    const { mutate, verify, message } = planned;
    const { next, nonce } = applyTransition(state, session, mutate);
    // Size is checked *before* the write lands (plan §435 "antes de reservar el
    // siguiente intento"): a `SIZE_LIMIT` throw here means no PUT was attempted.
    const sized = serializeState(next, limits);
    sizeWarning = sized.warn;
    const res = await compareAndSwap({
      store,
      base: state,
      blobSha,
      nextState: next,
      nonce,
      message,
      verify,
      limits,
    });
    if (res.outcome === 'applied') {
      return {
        outcome: 'applied',
        state: res.state,
        commitSha: res.commitSha,
        blobSha: res.blobSha,
        ...(sizeWarning ? { sizeWarning: true } : {}),
      };
    }
    if (res.outcome === 'indeterminate') return { outcome: 'indeterminate' };
    lastConflictState = res.state ?? null;
  }
  if (stopOnExhaustedConflict) {
    return {
      outcome: 'indeterminate',
      reason: 'CAS conflict exhausted after send; stop all new writes',
    };
  }
  return { outcome: 'conflict', state: lastConflictState };
}

// --- recordProvenDeploy -------------------------------------------

/**
 * Persist a freshly verified deploy proof into `proven_deploys` (plan §7/§8
 * "persist_new_proof_if_needed"). Append-only, keyed by
 * `<run_id>/<build_attempt>/<commit>`. Idempotent: re-persisting the same proof
 * for the same digest is a no-op transition.
 *
 * @param {{ store: StateStore, session: object, proof: import('./github.js').DeployProof, now?: () => number, maxAttempts?: number }} params
 */
export async function recordProvenDeploy({ store, session, proof, now, maxAttempts }) {
  if (!isPlainObject(proof) || !REPO_RE.test(String(proof.repository ?? ''))) {
    throw new StateError('CONFIG', 'a verified DeployProof is required');
  }
  const key = `${proof.run_id}/${proof.build_attempt}/${String(proof.commit).toLowerCase()}`;
  const minimal = {
    repository: String(proof.repository),
    commit: String(proof.commit).toLowerCase(),
    run_id: String(proof.run_id),
    build_attempt: Number(proof.build_attempt),
    workflow_path: proof.workflow_path ?? null,
    manifest_digest: String(proof.manifest_digest),
    verified_at: proof.verified_at ?? nowIso(now),
  };

  return runTransition({
    store,
    session,
    maxAttempts,
    plan: (state) => {
      const existing = state.proven_deploys[key];
      if (existing && existing.manifest_digest === minimal.manifest_digest) {
        return { shortCircuit: { outcome: 'noop', reason: 'proof already on file' } };
      }
      return {
        message: `social-state: record deploy proof ${key}`,
        mutate: (next) => {
          next.proven_deploys[key] = minimal;
        },
        verify: (reloaded) => {
          const p = reloaded.proven_deploys[key];
          if (p && p.manifest_digest === minimal.manifest_digest) return 'applied';
          return 'not-applied';
        },
      };
    },
  });
}

// --- recordIntent -----------------------------------------------------

/**
 * @typedef {object} FrozenPayloadInput
 * @property {object} frozenPayload opaque `SocialPost` (or equivalent) bytes
 * @property {string} payloadHash stable hash of the frozen copy (from `content.js`)
 * @property {number} generatorVersion
 * @property {string} [rkey] Bluesky record key — REQUIRED only for the FIRST
 *   `bluesky` reservation of a pair, frozen once. Derive it in `bluesky.js`
 *   from an {@link allocateBlueskyMicros} value plus a random clock id (plan
 *   §14). Any later reservation over the same pair (a due RETRYABLE, a safe
 *   retry over AMBIGUOUS) reuses the frozen `rkey` from the entry and a value
 *   passed here is ignored.
 * @property {string} [createdAt] Bluesky `createdAt` — REQUIRED only for the
 *   FIRST `bluesky` reservation, frozen in the intent (reused thereafter).
 * @property {number} [blueskyMicros] the micros allocated for the TID —
 *   REQUIRED only for the FIRST `bluesky` reservation (not consumed on reuse).
 */

/**
 * Reserve a `social.id × platform` pair for an exact run+attempt *before* the
 * caller may send (plan §3). The reservation is confirmed (durably persisted
 * and read-back verified) on `outcome === 'applied'`.
 *
 * Two contenders on the same blob SHA: CAS admits one; the other sees the live
 * owner and gets `outcome: 'conflict', reservedByOther: true` — it must not
 * send. `outcome: 'indeterminate'` means the reservation write could not be
 * proven → stop all new sends. `outcome: 'stale-micros'` means the Bluesky TID
 * value in `payload.blueskyMicros` was already consumed by another
 * reservation: re-derive the rkey from the returned `nextMicros` and call
 * again (see {@link SEND_HALT_CONTRACT}).
 *
 * `resume.safeBlueskyRetry: true` is REQUIRED to re-reserve a `bluesky` pair
 * that is currently `AMBIGUOUS` (it acknowledges the same-frozen-record retry
 * the plan permits there, §15). A due `RETRYABLE` bluesky pair does not need it.
 * Either way the frozen `rkey` / `createdAt` / record are reused, never
 * regenerated — that is keyed off the existing entry, not this flag.
 *
 * @param {{
 *   store: StateStore,
 *   session: { runId: string, attempt: number, newNonce?: () => string },
 *   article: { social_id: string, collection_id: string, canonical_url: string },
 *   platform: string,
 *   destination: { account_key: string },
 *   payload: FrozenPayloadInput,
 *   resume?: { safeBlueskyRetry?: boolean },
 *   now?: () => number,
 *   maxAttempts?: number,
 *   stateLimits?: { maxBytes?: number, warnBytes?: number },
 * }} params
 * @returns {Promise<{ outcome: string, intentId?: string, blueskyMicros?: number, reservedByOther?: boolean, sizeWarning?: boolean, state?: object, owner?: { run_id: string, attempt: number, intent_id: string }, nextMicros?: number, lastAllocated?: number, reason?: string }>}
 */
export async function recordIntent({
  store,
  session,
  article,
  platform,
  destination,
  payload,
  resume = {},
  now,
  maxAttempts,
  stateLimits,
}) {
  if (!SOCIAL_ID_RE.test(String(article?.social_id ?? ''))) {
    throw new StateError('CONFIG', 'article.social_id must be a 64-hex string');
  }
  if (!PLATFORMS.has(platform))
    throw new StateError('CONFIG', `unknown platform ${JSON.stringify(platform)}`);
  if (!isNonEmptyString(destination?.account_key)) {
    throw new StateError('CONFIG', 'destination.account_key is required');
  }
  if (!isPlainObject(payload?.frozenPayload) || !isNonEmptyString(payload?.payloadHash)) {
    throw new StateError('CONFIG', 'payload.frozenPayload and payload.payloadHash are required');
  }
  // The Bluesky "must carry a frozen rkey/createdAt/micros" requirement is
  // decided inside `plan(state)` below, where the existing entry is known: a
  // FIRST reservation must supply them; every later reservation over the same
  // pair reuses the frozen ones (plan §14 — "Repeticiones usan ese mismo rkey
  // y record; nunca timestamp actual nuevo").
  const { social_id: socialId, collection_id: collectionId, canonical_url: canonicalUrl } = article;
  const intentId = randomUUID();
  const at = nowIso(now);
  const nowMs = typeof now === 'function' ? now() : Date.now();
  let allocatedMicros;

  const outcome = await runTransition({
    store,
    session,
    maxAttempts,
    limits: stateLimits,
    plan: (state) => {
      const conflictWith = identityConflict(state, socialId, collectionId, canonicalUrl);
      if (conflictWith) {
        throw new StateError(
          'IDENTITY_CONFLICT',
          `${collectionId}/${canonicalUrl} is already bound to ${conflictWith}`,
          {
            conflicting_social_id: conflictWith,
          }
        );
      }

      const entry = platformEntry(state, socialId, platform);
      const status = currentStatus(entry);

      // A Bluesky pair freezes its record key, createdAt and TID micros on its
      // FIRST reservation. Every later reservation over the same pair (a due
      // RETRYABLE, a safe retry over AMBIGUOUS) reuses exactly those — the
      // adapter re-issues the same conditional put, never a new TID (plan §14).
      // `resume.safeBlueskyRetry` is a *separate* protection (it is what lets a
      // reservation cross AMBIGUOUS at all); it is not what decides reuse.
      const reuseFrozenBluesky = platform === 'bluesky' && !!entry && isNonEmptyString(entry.rkey);
      if (platform === 'bluesky' && !reuseFrozenBluesky) {
        if (
          !isNonEmptyString(payload.rkey) ||
          !isIsoDate(payload.createdAt) ||
          !Number.isInteger(payload.blueskyMicros)
        ) {
          throw new StateError(
            'CONFIG',
            'a first bluesky reservation requires payload.rkey, payload.createdAt and payload.blueskyMicros'
          );
        }
      }

      if (status === STATUS.PUBLISHED) {
        return { shortCircuit: { outcome: 'noop', reason: 'already PUBLISHED' } };
      }
      if (entry && entry.account_key !== destination.account_key) {
        throw new StateError(
          'DESTINATION_CHANGED',
          `${socialId}/${platform} is bound to a different account_key`,
          {
            account_key: entry.account_key,
          }
        );
      }
      if (
        (status === STATUS.PUBLISHING || status === STATUS.ACCEPTED) &&
        entry.intent_id !== intentId
      ) {
        return {
          shortCircuit: {
            outcome: 'conflict',
            reservedByOther: true,
            owner: {
              run_id: entry.owner_run_id,
              attempt: entry.owner_attempt,
              intent_id: entry.intent_id,
            },
          },
        };
      }
      if (!INTENT_SOURCE_STATUSES.has(status)) {
        throw new StateError(
          'INVALID_TRANSITION',
          `cannot reserve ${socialId}/${platform} over status ${status}`
        );
      }
      if (status === STATUS.RETRYABLE) {
        const due = Date.parse(entry.retry_at) <= nowMs;
        if (!due)
          throw new StateError(
            'RETRY_NOT_DUE',
            `${socialId}/${platform} retry_at is in the future`
          );
      }
      if (status === STATUS.AMBIGUOUS) {
        // Only a Bluesky safe retry of the *same* frozen record may reserve
        // over AMBIGUOUS (plan §15) — never an automatic Buffer create.
        if (platform !== 'bluesky' || !resume.safeBlueskyRetry) {
          throw new StateError(
            'INVALID_TRANSITION',
            `AMBIGUOUS ${socialId}/${platform} cannot be re-reserved automatically`
          );
        }
      }

      // A first Bluesky reservation records the micros used for its TID so the
      // top-level monotonic counter advances; a reuse (RETRYABLE / safe retry
      // over AMBIGUOUS) keeps the frozen rkey and needs no new micros.
      const blueskyMicros =
        platform === 'bluesky' && !reuseFrozenBluesky ? payload.blueskyMicros : undefined;
      if (
        typeof blueskyMicros === 'number' &&
        blueskyMicros <= (state.last_allocated_bluesky_micros ?? 0)
      ) {
        // The counter lives in the ledger precisely so allocation is
        // CAS-coordinated (plan §14/§15). `allocateBlueskyMicros` guarantees
        // `micros > last_allocated` *for the snapshot it read*; if that no
        // longer holds, another reservation already took this value and the
        // rkey derived from it would collide. Refuse and hand back the next
        // valid value — this is a "re-mint the rkey and call again", NOT a
        // stop-all-sends condition.
        return {
          shortCircuit: {
            outcome: 'stale-micros',
            nextMicros: allocateBlueskyMicros(state, nowMs).micros,
            lastAllocated: state.last_allocated_bluesky_micros,
          },
        };
      }
      allocatedMicros = blueskyMicros;

      return {
        message: `social-state: reserve ${socialId}/${platform}`,
        mutate: (next) => {
          const article0 = next.articles[socialId] ?? {
            collection_ids: [],
            canonical_urls: [],
            first_seen_at: at,
            platforms: {},
          };
          article0.collection_ids = dedupe([...article0.collection_ids, collectionId]);
          article0.canonical_urls = dedupe([...article0.canonical_urls, canonicalUrl]);
          next.articles[socialId] = article0;

          const prev = article0.platforms[platform];
          // On any reuse of a frozen Bluesky pair the record key, bytes, hash,
          // generator version and createdAt come from the existing entry and a
          // caller-supplied `payload.*` for those fields is ignored (plan §14 /
          // §15 "no reemplazar frozen_payload"). A first reservation takes them
          // from `payload`.
          const carriedRkey = reuseFrozenBluesky ? prev.rkey : (payload.rkey ?? prev?.rkey);
          const carriedFrozen = reuseFrozenBluesky ? prev.frozen_payload : payload.frozenPayload;
          const carriedHash = reuseFrozenBluesky ? prev.payload_hash : payload.payloadHash;
          const carriedGen = reuseFrozenBluesky ? prev.generator_version : payload.generatorVersion;
          const carriedCreatedAt = reuseFrozenBluesky
            ? prev.created_at
            : (payload.createdAt ?? prev?.created_at);

          article0.platforms[platform] = {
            status: STATUS.PUBLISHING,
            account_key: destination.account_key,
            attempt_count: (prev?.attempt_count ?? 0) + 1,
            owner_run_id: session.runId,
            owner_attempt: session.attempt,
            intent_id: intentId,
            payload_hash: carriedHash,
            generator_version: carriedGen,
            frozen_payload: carriedFrozen,
            attempted_at: at,
            ...(carriedRkey ? { rkey: carriedRkey } : {}),
            ...(carriedCreatedAt ? { created_at: carriedCreatedAt } : {}),
          };

          if (platform === 'bluesky' && typeof blueskyMicros === 'number') {
            next.last_allocated_bluesky_micros = Math.max(
              next.last_allocated_bluesky_micros,
              blueskyMicros
            );
          }
        },
        verify: (reloaded) => {
          const e = platformEntry(reloaded, socialId, platform);
          if (e && e.intent_id === intentId && e.status === STATUS.PUBLISHING) return 'applied';
          // Our intent id is not there → the CAS did not land (a rejected write
          // leaves the entry untouched). Safe to recompute and retry.
          return 'not-applied';
        },
      };
    },
  });

  if (outcome.outcome === 'applied') {
    return {
      ...outcome,
      intentId,
      ...(typeof allocatedMicros === 'number' ? { blueskyMicros: allocatedMicros } : {}),
    };
  }
  return outcome;
}

/**
 * Allocate the next Bluesky TID micros value (plan §14):
 * `max(nowMs * 1000, last_allocated + 1)`. The 13-char base32 encoding and the
 * random clock id live in `bluesky.js`; this module only owns the monotonic
 * counter so it survives across runs in the ledger.
 *
 * The value is only valid against the `state` it was read from. `recordIntent`
 * re-checks it inside the CAS transaction and answers `stale-micros` when
 * another reservation consumed it meanwhile — so allocate from a freshly
 * loaded state, and on `stale-micros` re-mint the rkey from the returned
 * `nextMicros` rather than reusing the old one.
 *
 * @param {import('./state.js').SocialState} state
 * @param {number} nowMs
 * @returns {{ micros: number }}
 */
export function allocateBlueskyMicros(state, nowMs) {
  const floor = Math.floor(Number(nowMs)) * 1000;
  const micros = Math.max(floor, (state.last_allocated_bluesky_micros ?? 0) + 1);
  return { micros };
}

// --- recordResult ---------------------------------------------------

/**
 * @typedef {object} SendResult
 * @property {string} status one of {@link STATUS} (`ACCEPTED`, `PUBLISHED`, `AMBIGUOUS`, `RETRYABLE`, `FAILED_PERMANENT`)
 * @property {string} [providerId] Buffer post id — kept once known
 * @property {string} [externalUrl]
 * @property {string} [uri] Bluesky at:// URI
 * @property {string} [cid]
 * @property {string} [errorClass]
 * @property {boolean} [safeToRetry] required `true` for a `RETRYABLE` result
 * @property {string} [retryAt] ISO; required for a `RETRYABLE` result
 * @property {object} [evidence] reconciliation evidence retained on the entry
 */

/**
 * Persist the outcome of one send, applying only the §15 transitions.
 *
 * Immutability guards: `PUBLISHED` is terminal; `ACCEPTED` only advances to
 * `PUBLISHED`/`FAILED_PERMANENT` and keeps its `provider_id`; the frozen
 * payload, `payload_hash`, `generator_version`, `intent_id`, `rkey` and
 * `created_at` are never rewritten. A `RETRYABLE` result is refused unless
 * `result.safeToRetry === true` (a purely local failure never reduces the
 * uncertainty of a social operation — the §17 default is `AMBIGUOUS`).
 *
 * @param {{
 *   store: StateStore,
 *   session: object,
 *   socialId: string,
 *   platform: string,
 *   intentId: string,
 *   result: SendResult,
 *   now?: () => number,
 *   maxAttempts?: number,
 * }} params
 */
export async function recordResult({
  store,
  session,
  socialId,
  platform,
  intentId,
  result,
  now,
  maxAttempts,
}) {
  if (!isNonEmptyString(intentId)) throw new StateError('CONFIG', 'intentId is required');
  if (!ALL_STATUSES.has(result?.status)) {
    throw new StateError(
      'CONFIG',
      `result.status ${JSON.stringify(result?.status)} is not a known status`
    );
  }
  if (result.status === STATUS.RETRYABLE) {
    if (result.safeToRetry !== true) {
      throw new StateError(
        'UNSAFE_RETRYABLE',
        'a RETRYABLE result requires proven no-effect (safeToRetry === true); otherwise classify AMBIGUOUS'
      );
    }
    if (!isIsoDate(result.retryAt))
      throw new StateError('CONFIG', 'a RETRYABLE result requires an ISO retryAt');
  }
  const at = nowIso(now);

  return runTransition({
    store,
    session,
    maxAttempts,
    // A send already happened; an unpersisted result must halt every network,
    // not let the caller advance to the next pair (plan §546).
    stopOnExhaustedConflict: true,
    plan: (state) => {
      const entry = platformEntry(state, socialId, platform);
      if (!entry) throw new StateError('NO_RESERVATION', `${socialId}/${platform} has no entry`);
      if (entry.intent_id !== intentId) {
        // Someone superseded this attempt (recovery / human resolution). Do not
        // overwrite it with a result computed against stale data (plan §15).
        return {
          shortCircuit: {
            outcome: 'superseded',
            currentIntentId: entry.intent_id,
            status: entry.status,
          },
        };
      }
      if (entry.status === STATUS.PUBLISHED) {
        throw new StateError(
          'TERMINAL',
          `${socialId}/${platform} is PUBLISHED; terminal for automatic distribution`
        );
      }
      if (!RESULT_SOURCE_STATUSES.has(entry.status)) {
        throw new StateError(
          'INVALID_TRANSITION',
          `cannot record a result over status ${entry.status}`
        );
      }
      const allowed = RESULT_TRANSITIONS[entry.status];
      if (!allowed || !allowed.has(result.status)) {
        throw new StateError(
          'INVALID_TRANSITION',
          `${entry.status} → ${result.status} is not an allowed result transition`
        );
      }
      if (
        entry.status === STATUS.ACCEPTED &&
        result.providerId &&
        entry.provider_id &&
        result.providerId !== entry.provider_id
      ) {
        throw new StateError(
          'CONFLICTING_PROVIDER_ID',
          `${socialId}/${platform} already holds a different provider_id`
        );
      }

      return {
        message: `social-state: result ${socialId}/${platform} → ${result.status}`,
        mutate: (next) => {
          const e = next.articles[socialId].platforms[platform];
          e.status = result.status;
          e.last_checked_at = at;
          if (result.providerId) e.provider_id = result.providerId;
          if (result.externalUrl) e.external_url = result.externalUrl;
          if (result.uri) e.uri = result.uri;
          if (result.cid) e.cid = result.cid;
          if (result.errorClass) e.error_class = result.errorClass;
          if (isPlainObject(result.evidence)) e.evidence = result.evidence;

          if (result.status === STATUS.RETRYABLE) {
            e.retry_at = result.retryAt;
          } else {
            delete e.retry_at;
          }
          if (result.status === STATUS.PUBLISHED) {
            // Field-level prune only (invariant ii): keep the entry and every
            // id/hash, drop just the now-unneeded frozen copy (plan §15).
            delete e.frozen_payload;
          }
          if (result.status === STATUS.PUBLISHING) {
            // never a valid result target — guarded above, defensive here.
            e.status = entry.status;
          }
        },
        verify: (reloaded) => {
          const e = platformEntry(reloaded, socialId, platform);
          if (!e || e.intent_id !== intentId) return 'indeterminate';
          if (e.status === result.status) return 'applied';
          if (e.status === entry.status) return 'not-applied';
          // Some other transition advanced it after our (possibly lost) write.
          return 'indeterminate';
        },
      };
    },
  });
}

// --- owner liveness + reconciliation ------------------------------

/**
 * Decide, from a `getRunStatus` snapshot, whether the process that holds a
 * reservation is still alive (plan §3/§15/§547). Asymmetric and conservative:
 *
 * - `alive`   → the owner (or a same-attempt run) is still going; **defer**.
 * - `finished`→ the exact run+attempt that reserved has ended; recover only to
 *   `AMBIGUOUS`, never to a fresh send.
 * - `unknown` → cannot be determined; **keep the lock**.
 *
 * A completed attempt N with an in-progress rerun N+1 reads as `finished`: the
 * reservation is bound to run+attempt N exactly, and that process is dead
 * regardless of N+1 (which never inherited the lock).
 *
 * @param {{ entry: object, runStatus: import('./github.js').RunStatus | null, session: object }} params
 * @returns {{ liveness: 'alive'|'finished'|'unknown', reason: string }}
 */
export function evaluateOwnerLiveness({ entry, runStatus, session }) {
  if (!entry || !isNonEmptyString(entry.owner_run_id)) {
    return { liveness: 'unknown', reason: 'entry carries no owner' };
  }
  if (
    session &&
    String(entry.owner_run_id) === String(session.runId) &&
    Number(entry.owner_attempt) === Number(session.attempt)
  ) {
    return { liveness: 'alive', reason: 'this run+attempt owns the reservation' };
  }
  if (!runStatus || runStatus.found === false) {
    return { liveness: 'unknown', reason: 'run status could not be read' };
  }
  // The snapshot must identify itself as the owner's run. A response fetched
  // for another run — or one whose run id is missing — proves nothing about
  // this reservation (plan §15 "Dos procesos"; run *and* attempt must match the
  // registered owner).
  const snapshotRunId = runStatus.latestRun?.id ?? runStatus.run?.id ?? null;
  if (!isNonEmptyString(snapshotRunId) || String(snapshotRunId) !== String(entry.owner_run_id)) {
    return { liveness: 'unknown', reason: 'run status does not identify the owner run' };
  }

  const ownerAttempt = Number(entry.owner_attempt);
  const declared = runStatus.run;
  const latest = runStatus.latestRun;

  if (declared && Number(declared.run_attempt) === ownerAttempt) {
    if (declared.status === 'completed')
      return { liveness: 'finished', reason: 'owner attempt completed' };
    return { liveness: 'alive', reason: `owner attempt is "${declared.status ?? 'unknown'}"` };
  }
  if (latest && Number.isInteger(latest.run_attempt)) {
    if (latest.run_attempt > ownerAttempt) {
      return { liveness: 'finished', reason: 'a later attempt superseded the owner attempt' };
    }
    if (latest.run_attempt === ownerAttempt) {
      return latest.status === 'completed'
        ? { liveness: 'finished', reason: 'owner attempt completed (latest view)' }
        : { liveness: 'alive', reason: `owner attempt is "${latest.status ?? 'unknown'}"` };
    }
  }
  return { liveness: 'unknown', reason: 'attempt data is insufficient to decide' };
}

/**
 * The one mutating reconciliation transition (plan §15). It covers:
 *
 * - `kind: 'recover-abandoned'` — `PUBLISHING → AMBIGUOUS` for a reservation
 *   whose owner is *proven* finished. Retains the frozen payload. Requires
 *   `ownerLiveness === 'finished'`.
 * - `kind: 'adopt'` — `AMBIGUOUS → ACCEPTED | PUBLISHED` on external evidence.
 * - `kind: 'block'` — `→ BLOCKED` (conflict / destination change / repeated
 *   ambiguity budget exhausted).
 * - `kind: 'resolve'` — human resolution; requires `expectedRevision === base`.
 *   `action` ∈ `adopt | block | authorize-retry`. `authorize-retry` is the only
 *   path from `AMBIGUOUS → RETRYABLE`, and only with full evidence.
 *
 * Every write records `resolution: { actor, reason, evidence, timestamp }` and
 * never touches `frozen_payload`, `intent_id`, `payload_hash`, `rkey` or
 * `created_at`. `PUBLISHED` is terminal for every kind.
 *
 * @param {{
 *   store: StateStore,
 *   session: object,
 *   socialId: string,
 *   platform: string,
 *   intentId: string,
 *   kind: 'recover-abandoned' | 'adopt' | 'block' | 'resolve',
 *   ownerLiveness?: 'alive' | 'finished' | 'unknown',
 *   resolution: { actor: string, reason: string, evidence?: string | object },
 *   action?: 'adopt' | 'block' | 'authorize-retry',
 *   target?: 'ACCEPTED' | 'PUBLISHED',
 *   providerId?: string, uri?: string, cid?: string, externalUrl?: string,
 *   retryAt?: string,
 *   expectedRevision?: number,
 *   now?: () => number,
 *   maxAttempts?: number,
 * }} params
 */
export async function recordReconciliation(params) {
  const {
    store,
    session,
    socialId,
    platform,
    intentId,
    kind,
    ownerLiveness,
    resolution,
    action,
    target,
    providerId,
    uri,
    cid,
    externalUrl,
    retryAt,
    expectedRevision,
    now,
    maxAttempts,
  } = params;
  if (!isNonEmptyString(intentId)) throw new StateError('CONFIG', 'intentId is required');
  if (
    !isPlainObject(resolution) ||
    !isNonEmptyString(resolution.actor) ||
    !isNonEmptyString(resolution.reason)
  ) {
    throw new StateError('CONFIG', 'resolution { actor, reason, evidence } is required');
  }
  if (kind === 'resolve' && resolution.evidence == null) {
    // A human resolution must carry its evidence into the Git history (plan
    // §15 "Resolución humana segura"); an automatic kind records the read or
    // liveness result that justified it instead.
    throw new StateError('CONFIG', 'a human resolve requires resolution.evidence');
  }
  const at = nowIso(now);
  const stamp = {
    actor: resolution.actor,
    reason: resolution.reason,
    evidence: resolution.evidence ?? null,
    timestamp: at,
  };

  return runTransition({
    store,
    session,
    maxAttempts,
    // Reconciliation runs after a send may have happened; treat an exhausted
    // conflict as a stop-all-writes signal, not a skippable conflict (plan §546).
    stopOnExhaustedConflict: true,
    plan: (state) => {
      const entry = platformEntry(state, socialId, platform);
      if (!entry) throw new StateError('NO_RESERVATION', `${socialId}/${platform} has no entry`);
      if (entry.intent_id !== intentId) {
        return {
          shortCircuit: {
            outcome: 'superseded',
            currentIntentId: entry.intent_id,
            status: entry.status,
          },
        };
      }
      if (entry.status === STATUS.PUBLISHED) {
        throw new StateError(
          'TERMINAL',
          `${socialId}/${platform} is PUBLISHED; only annotations are allowed`
        );
      }
      if (kind === 'resolve' && expectedRevision !== state.revision) {
        throw new StateError(
          'REVISION_STALE',
          `expected revision ${expectedRevision} but state is at ${state.revision}`
        );
      }

      let toStatus;
      if (kind === 'recover-abandoned') {
        if (entry.status !== STATUS.PUBLISHING) {
          throw new StateError(
            'INVALID_TRANSITION',
            `recover-abandoned needs PUBLISHING, not ${entry.status}`
          );
        }
        if (ownerLiveness === 'alive')
          throw new StateError('OWNER_ALIVE', 'owner is still running; defer, do not recover');
        if (ownerLiveness !== 'finished')
          throw new StateError('OWNER_UNKNOWN', 'owner liveness is not proven; keep the lock');
        toStatus = STATUS.AMBIGUOUS;
      } else if (kind === 'adopt' || (kind === 'resolve' && action === 'adopt')) {
        if (entry.status !== STATUS.AMBIGUOUS && entry.status !== STATUS.ACCEPTED) {
          throw new StateError(
            'INVALID_TRANSITION',
            `adopt needs AMBIGUOUS/ACCEPTED, not ${entry.status}`
          );
        }
        toStatus = target === STATUS.PUBLISHED ? STATUS.PUBLISHED : STATUS.ACCEPTED;
        if (
          toStatus === STATUS.ACCEPTED &&
          !isNonEmptyString(providerId) &&
          !isNonEmptyString(entry.provider_id)
        ) {
          throw new StateError('CONFIG', 'adopt → ACCEPTED needs a providerId');
        }
      } else if (kind === 'block' || (kind === 'resolve' && action === 'block')) {
        toStatus = STATUS.BLOCKED;
      } else if (kind === 'resolve' && action === 'authorize-retry') {
        if (entry.status !== STATUS.AMBIGUOUS) {
          throw new StateError(
            'INVALID_TRANSITION',
            `authorize-retry needs AMBIGUOUS, not ${entry.status}`
          );
        }
        if (!isIsoDate(retryAt))
          throw new StateError('CONFIG', 'authorize-retry needs an ISO retryAt');
        toStatus = STATUS.RETRYABLE;
      } else {
        throw new StateError('CONFIG', `unknown reconciliation kind/action ${kind}/${action}`);
      }

      return {
        message: `social-state: reconcile ${socialId}/${platform} → ${toStatus} (${kind})`,
        mutate: (next) => {
          const e = next.articles[socialId].platforms[platform];
          e.status = toStatus;
          e.last_checked_at = at;
          e.resolution = stamp;
          if (providerId) e.provider_id = providerId;
          if (externalUrl) e.external_url = externalUrl;
          if (uri) e.uri = uri;
          if (cid) e.cid = cid;
          if (toStatus === STATUS.RETRYABLE) e.retry_at = retryAt;
          else delete e.retry_at;
          if (toStatus === STATUS.PUBLISHED) delete e.frozen_payload;
          // AMBIGUOUS keeps frozen_payload (guaranteed present: source was
          // PUBLISHING, which always carries it).
        },
        verify: (reloaded) => {
          const e = platformEntry(reloaded, socialId, platform);
          if (!e || e.intent_id !== intentId) return 'indeterminate';
          if (e.status === toStatus) return 'applied';
          if (e.status === entry.status) return 'not-applied';
          return 'indeterminate';
        },
      };
    },
  });
}

/**
 * Return an unsent reservation to `PENDING` (drop the platform sub-entry,
 * keeping the article entry and its identity indexes).
 *
 * The *only* sanctioned regression to `PENDING` (plan §15/§539): permitted only
 * when **this same run+attempt** knows it never invoked send. `send_invoked` is
 * memory-only and is never persisted — the caller passes `sendInvoked: false`
 * as an explicit assertion; a `false` value is required, not merely falsy.
 *
 * @param {{
 *   store: StateStore,
 *   session: { runId: string, attempt: number },
 *   socialId: string,
 *   platform: string,
 *   intentId: string,
 *   sendInvoked: false,
 *   maxAttempts?: number,
 * }} params
 */
export async function releaseUnsentReservation({
  store,
  session,
  socialId,
  platform,
  intentId,
  sendInvoked,
  maxAttempts,
}) {
  if (sendInvoked !== false) {
    throw new StateError(
      'CONFIG',
      'releaseUnsentReservation requires an explicit sendInvoked === false assertion'
    );
  }
  if (!isNonEmptyString(intentId)) throw new StateError('CONFIG', 'intentId is required');

  return runTransition({
    store,
    session,
    maxAttempts,
    plan: (state) => {
      const entry = platformEntry(state, socialId, platform);
      if (!entry) return { shortCircuit: { outcome: 'noop', reason: 'no entry to release' } };
      if (entry.intent_id !== intentId) {
        return { shortCircuit: { outcome: 'superseded', currentIntentId: entry.intent_id } };
      }
      if (entry.status !== STATUS.PUBLISHING) {
        throw new StateError(
          'INVALID_TRANSITION',
          `only a PUBLISHING reservation can be released, not ${entry.status}`
        );
      }
      if (
        String(entry.owner_run_id) !== String(session.runId) ||
        Number(entry.owner_attempt) !== Number(session.attempt)
      ) {
        // A different process (incl. a rerun) reserved it; it has no memory of
        // whether send was invoked. Never release on its behalf.
        throw new StateError(
          'NOT_OWNER',
          'only the exact owning run+attempt may release an unsent reservation'
        );
      }
      return {
        message: `social-state: release unsent ${socialId}/${platform}`,
        mutate: (next) => {
          delete next.articles[socialId].platforms[platform];
        },
        verify: (reloaded) => {
          const e = platformEntry(reloaded, socialId, platform);
          if (!e) return 'applied';
          if (e.intent_id === intentId && e.status === STATUS.PUBLISHING) return 'not-applied';
          return 'indeterminate';
        },
      };
    },
  });
}

// --- explicit initialization -------------------------------------

/**
 * Create the orphan `social-state` branch with a parentless root commit (plan
 * §5/§15). Separate from the normal loader. If the branch already exists it is
 * *verified* (loaded + validated) and never replaced. Concurrent init and a
 * lost ref-create response both resolve through the same read-and-verify path.
 *
 * Not to be run against real GitHub yet — tests only.
 *
 * @param {{ store: StateStore, now?: () => number }} params
 * @returns {Promise<{ outcome: 'created' | 'exists', state: import('./state.js').SocialState }>}
 */
export async function initializeState({ store, now }) {
  const initial = {
    schema_version: SCHEMA_VERSION,
    initialized_at: nowIso(now),
    revision: 0,
    last_transition_nonce: null,
    last_allocated_bluesky_micros: 0,
    proven_deploys: {},
    articles: {},
  };

  // Fast path: already initialized → verify, never replace.
  const existing = await loadExistingForInit(store);
  if (existing) return { outcome: 'exists', state: existing };

  const { text } = serializeState(initial);
  try {
    await store.createOrphanBranch({
      contentText: text,
      message: 'social-state: initialize ledger',
    });
  } catch (error) {
    if (error instanceof StateError && error.code === 'BRANCH_EXISTS') {
      const afterRace = await loadExistingForInit(store);
      if (afterRace) return { outcome: 'exists', state: afterRace };
      throw new StateError(
        'INIT_RACE_UNRESOLVED',
        'branch reported as existing but could not be read back'
      );
    }
    // Lost response on ref-create: re-check through the same path.
    const afterLoss = await loadExistingForInit(store);
    if (afterLoss) return { outcome: 'exists', state: afterLoss };
    throw error;
  }

  const created = await loadExistingForInit(store);
  if (!created)
    throw new StateError('INIT_RACE_UNRESOLVED', 'branch created but could not be read back');
  return { outcome: 'created', state: created };
}

async function loadExistingForInit(store) {
  try {
    const { state } = await loadState({ store });
    return state;
  } catch (error) {
    if (
      error instanceof StateError &&
      (error.code === 'STATE_NOT_INITIALIZED' ||
        error.code === 'BRANCH_MISSING' ||
        error.code === 'FILE_MISSING')
    ) {
      return null;
    }
    throw error;
  }
}
