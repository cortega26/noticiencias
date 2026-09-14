import { ERROR_CLASS, HttpError, classifyStatus, requestJson } from '../http.js';

/**
 * Buffer GraphQL publishing adapter for Facebook Page / X / LinkedIn Page
 * (plan social-distribution §6 / §10 / §12 / §13 / §15 / §17).
 *
 * ### What this adapter is
 *
 * It receives an already-frozen `SocialPost` (`content.js`, §12) plus a
 * destination `channelId` and talks to Buffer's single GraphQL endpoint
 * (`https://api.buffer.com`, `Authorization: Bearer <BUFFER_API_KEY>`, §13). It
 * does NOT decide editorial eligibility, does not regenerate copy, and does not
 * persist ledger state — `state.js` owns `state.json`; this module returns
 * structured results the orchestrator feeds to `recordResult` /
 * `recordReconciliation`, exactly like `providers/bluesky.js` does.
 *
 * ### Why GraphQL, not REST
 *
 * Buffer's write API is GraphQL: `createPost(input: CreatePostInput!)`, a
 * `post(input:{id})` query, and a paginated `posts(...)` query — never a REST
 * "create update" / "get update status" collection. §13 is the authority; the
 * task brief's REST-shaped language ("create update/share-now", "list
 * profiles/channels") describes Buffer's *narrative* docs, not its schema, and
 * is not followed literally here.
 *
 * ### Boundaries (mirrors `providers/bluesky.js`)
 *
 * - Transport is always `../http.js` (`requestJson`): injected `fetch`, hard
 *   timeout, byte cap, secret redaction, no automatic retry of a mutation.
 * - Imports `../http.js` only — not `state.js`, not `content.js`. Tests wire
 *   all three together, same as the Bluesky adapter.
 * - No module-load side effects.
 *
 * ### The Buffer-specific ambiguity case (task requirement)
 *
 * A timeout or 5xx *after* `createPost` may have been issued must never become
 * a blind retry-create: `create()` maps every transport failure and every 5xx
 * to `AMBIGUOUS` (§17 "5xx de mutation Buffer → No create automático ... Sí:
 * puede haber aceptado"). `state.recordIntent` independently enforces the same
 * rule structurally — reserving over an `AMBIGUOUS` entry requires
 * `platform === 'bluesky' && resume.safeBlueskyRetry`, so a Buffer platform can
 * never re-enter the send path from `AMBIGUOUS` even if this adapter's mapping
 * were wrong. Recovery is exclusively `reconcile()`, which lists/adopts
 * existing Buffer updates instead of creating a new one (§13 "Reconciliación
 * sin ID").
 */

// --- constants ----------------------------------------------------------

/**
 * The single Buffer GraphQL endpoint (plan §13: "API GraphQL
 * https://api.buffer.com"). Buffer's official reference does not carry a
 * different write/read path; verifying this literal endpoint against a real
 * account is Rollout Phase 0 (plan §22/§28), out of scope for this module.
 */
export const BUFFER_API_URL = 'https://api.buffer.com';
export const BUFFER_API_HOST = 'api.buffer.com';

/** The three Buffer-routed MVP platforms (Bluesky is direct, not Buffer). */
export const BUFFER_PLATFORMS = Object.freeze(['facebook', 'x', 'linkedin']);

/** Buffer's `service` string per platform — X's channel `service` is `twitter` (§13). */
export const BUFFER_SERVICE_BY_PLATFORM = Object.freeze({
  facebook: 'facebook',
  x: 'twitter',
  linkedin: 'linkedin',
});

/** Inverse of {@link BUFFER_SERVICE_BY_PLATFORM}, for `inspectChannels`. */
const PLATFORM_BY_SERVICE = Object.freeze(
  Object.fromEntries(Object.entries(BUFFER_SERVICE_BY_PLATFORM).map(([k, v]) => [v, k]))
);

/** Buffer's `PostStatus` enum values actually used here (plan §13). */
const POST_STATUS = Object.freeze({
  DRAFT: 'draft',
  ERROR: 'error',
  NEEDS_APPROVAL: 'needs_approval',
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  SENT: 'sent',
});

/** Batched `post(input:{id})` polling is capped at 10 aliases per request (§13). */
export const MAX_POST_IDS_PER_REQUEST = 10;
/** Reconciliation listing is capped at 10 pages/run (§13). */
export const DEFAULT_MAX_LIST_PAGES = 10;

/**
 * The outcomes `createPost` / `get` can produce (the discriminant of a
 * {@link PublishResult}), exported so the mapping table can be asserted.
 *
 * - `published`       — Buffer's own `post.status === 'sent'`.
 * - `accepted`        — `scheduled` / `sending` / an unrecognized status:
 *   Buffer accepted the object and returned an id; "guardar ID y reconciliar"
 *   (§13) — an unknown status is deliberately NOT a failure.
 * - `ambiguous`       — the write's effect cannot be proven (lost response,
 *   timeout, 5xx, an unparseable/incomplete 2xx body, an untyped/unknown
 *   GraphQL error). Reconcile by listing.
 * - `rejected`        — `InvalidInputError`: content Buffer provably rejected
 *   before any provider-side send (§17 "rechazo pre-write confirmado"), or a
 *   created post object whose own `status === 'error'` (permanent for *that*
 *   object; never create another, §13).
 * - `rate-limited`    — an actual HTTP 429 *response* (rejected, not
 *   processed) — never a 429 surfaced only as a thrown transport error.
 * - `auth-invalid`    — HTTP 401; every send this run will fail the same way.
 * - `channel-blocked` — Buffer accepted the post into `draft` / `needs_approval`
 *   (unexpected MVP configuration, §13 "detener canal"): the id is real and
 *   kept, but this specific channel needs human reconfiguration before any
 *   further automatic send.
 */
export const BUFFER_OUTCOME = Object.freeze({
  PUBLISHED: 'published',
  ACCEPTED: 'accepted',
  AMBIGUOUS: 'ambiguous',
  REJECTED: 'rejected',
  RATE_LIMITED: 'rate-limited',
  AUTH_INVALID: 'auth-invalid',
  CHANNEL_BLOCKED: 'channel-blocked',
});

/** Structured reconciliation decisions from {@link createBufferClient} `reconcile`. */
export const RECONCILE_DECISION = Object.freeze({
  CONFIRMED: 'confirmed',
  CONFLICT: 'conflict',
  UNCERTAIN: 'uncertain',
});

// --- errors ---------------------------------------------------------------

/**
 * A programming-level failure (bad input, impossible config). Expected
 * operational outcomes are returned as a {@link PublishResult}, not thrown.
 */
export class BufferError extends Error {
  /**
   * @param {string} code stable — `CONFIG` for caller mistakes, otherwise a
   *   {@link BUFFER_OUTCOME} value for a surfaced operational failure
   * @param {string} message already sanitized
   * @param {Record<string, unknown>} [detail]
   */
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'BufferError';
    this.code = code;
    this.detail = detail;
    this.retryAfterMs =
      detail && typeof detail.retryAfterMs === 'number' ? detail.retryAfterMs : null;
  }
}

// --- small helpers ----------------------------------------------------------

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** Deterministic JSON (keys sorted). Used only for bounded evidence clipping. */
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

function clip(value, max = 600) {
  const text = canonicalJson(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * NFC + collapse internal whitespace + trim — an equality basis for
 * reconciliation only. `content.js` owns social-copy normalization; this is a
 * deliberately small local check (mirrors the same pattern in `article.js`),
 * not a shared helper, so this module's only dependency stays `../http.js`.
 */
function normalizeForCompare(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- GraphQL documents (frozen constants, variables never concatenated) ---

const DISCOVER_ORGANIZATIONS_QUERY = `
  query DiscoverOrganizations {
    account {
      organizations {
        id
        name
      }
    }
  }
`;

const DISCOVER_CHANNELS_QUERY = `
  query DiscoverChannels($input: ChannelsInput!) {
    channels(input: $input) {
      id
      name
      service
    }
  }
`;

const CREATE_POST_MUTATION = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess {
        post {
          id
          status
          channelId
          text
          externalLink
          sentAt
        }
      }
      ... on InvalidInputError {
        message
      }
      ... on MutationError {
        message
      }
    }
  }
`;

const POST_FIELDS = 'id status channelId text externalLink sentAt assets { link { url } }';

function buildGetPostsQuery(ids) {
  const variableDefs = ids.map((_, i) => `$id${i}: ID!`).join(', ');
  const aliasFields = ids
    .map((_, i) => `p${i}: post(input: { id: $id${i} }) { ${POST_FIELDS} }`)
    .join('\n    ');
  const query = `query GetPosts(${variableDefs}) {\n    ${aliasFields}\n  }`;
  const variables = Object.fromEntries(ids.map((id, i) => [`id${i}`, id]));
  return { query, variables };
}

const LIST_POSTS_QUERY = `
  query ListPosts($input: PostsInput!, $first: Int!, $after: String) {
    posts(first: $first, after: $after, input: $input) {
      edges {
        node {
          ${POST_FIELDS}
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// --- pure result classification --------------------------------------------

/**
 * @typedef {object} PublishResult
 * @property {'published'|'accepted'|'ambiguous'|'rejected'|'rate-limited'|'auth-invalid'|'channel-blocked'} outcome
 * @property {string} [providerId] Buffer's own post id — NOT a native platform id (§13)
 * @property {string} [externalUrl] on `published`
 * @property {number|null} [retryAfterMs] parsed `Retry-After` (on `rate-limited`)
 * @property {boolean} [safeToRetry] `true` ONLY when the mutation provably never
 *   reached Buffer's create path (a 429 response, a pre-send auth failure) —
 *   never on a timeout / lost response / 5xx.
 * @property {Record<string, unknown>} evidence structured, non-secret facts
 */

/** Map a created/polled Buffer post object to a {@link PublishResult}. */
function classifyPost(post) {
  const evidence = { status: post.status, channelId: post.channelId ?? null };
  if (!isNonEmptyString(post.id)) {
    return {
      outcome: BUFFER_OUTCOME.AMBIGUOUS,
      safeToRetry: false,
      evidence: { ...evidence, reason: 'post object carries no id' },
    };
  }
  switch (post.status) {
    case POST_STATUS.SENT:
      return {
        outcome: BUFFER_OUTCOME.PUBLISHED,
        providerId: post.id,
        externalUrl: isNonEmptyString(post.externalLink) ? post.externalLink : null,
        evidence,
      };
    case POST_STATUS.SCHEDULED:
    case POST_STATUS.SENDING:
      return { outcome: BUFFER_OUTCOME.ACCEPTED, providerId: post.id, evidence };
    case POST_STATUS.ERROR:
      // Permanent for THIS object; never create another (plan §13).
      return {
        outcome: BUFFER_OUTCOME.REJECTED,
        providerId: post.id,
        evidence: { ...evidence, reason: 'buffer post status is error' },
      };
    case POST_STATUS.DRAFT:
    case POST_STATUS.NEEDS_APPROVAL:
      // Unexpected MVP configuration (shareNow + needsApproval:false was sent):
      // the id is real and kept; the channel needs human reconfiguration
      // before any further automatic send (plan §13 "detener canal").
      return {
        outcome: BUFFER_OUTCOME.CHANNEL_BLOCKED,
        providerId: post.id,
        evidence: { ...evidence, reason: `unexpected status "${post.status}"` },
      };
    default:
      // "Un status desconocido no equivale a fallo previo al write: guardar
      // ID y reconciliar" (plan §13).
      return {
        outcome: BUFFER_OUTCOME.ACCEPTED,
        providerId: post.id,
        evidence: { ...evidence, reason: `unrecognized status "${String(post.status)}"` },
      };
  }
}

function wrapTransport(error, where) {
  if (error instanceof BufferError) return error;
  if (error instanceof HttpError) {
    const outcome =
      error.errorClass === ERROR_CLASS.RATE_LIMITED
        ? BUFFER_OUTCOME.RATE_LIMITED
        : error.errorClass === ERROR_CLASS.AUTH
          ? BUFFER_OUTCOME.AUTH_INVALID
          : BUFFER_OUTCOME.AMBIGUOUS;
    return new BufferError(outcome, `${where}: ${error.sanitizedMessage}`, {
      errorClass: error.errorClass,
      retryAfterMs: error.retryAfterMs ?? null,
    });
  }
  return new BufferError(BUFFER_OUTCOME.AMBIGUOUS, `${where}: transport failure`);
}

// --- client ------------------------------------------------------------

/**
 * Create a Buffer GraphQL client bound to one API key. Nothing happens until a
 * method is called; the key lives only in this closure.
 *
 * @param {{
 *   fetchImpl: import('../http.js').FetchLike,
 *   apiKey: string,
 *   organizationId?: string,
 *   timeoutMs?: number,
 *   maxBytes?: number,
 * }} config
 */
export function createBufferClient(config) {
  const {
    fetchImpl,
    apiKey,
    organizationId: defaultOrganizationId,
    timeoutMs,
    maxBytes,
  } = config || {};

  if (typeof fetchImpl !== 'function') {
    throw new BufferError('CONFIG', 'fetchImpl must be injected');
  }
  if (!isNonEmptyString(apiKey)) {
    throw new BufferError('CONFIG', 'apiKey is required');
  }

  function baseOptions(extra = {}) {
    return {
      fetchImpl,
      allowedHosts: [BUFFER_API_HOST],
      followRedirects: false,
      timeoutMs: timeoutMs ?? 15_000,
      maxBytes: maxBytes ?? 512 * 1024,
      secrets: [apiKey],
      ...extra,
    };
  }

  async function graphql(query, variables) {
    return requestJson(
      BUFFER_API_URL,
      baseOptions({
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      })
    );
  }

  /**
   * `account { organizations { id name } }` (plan §13 discovery, read-only).
   * @returns {Promise<Array<{ id: string, name: string }>>}
   */
  async function discoverOrganizations() {
    let result;
    let json;
    try {
      ({ result, json } = await graphql(DISCOVER_ORGANIZATIONS_QUERY, {}));
    } catch (error) {
      throw wrapTransport(error, 'discoverOrganizations');
    }
    assertOk(result, json, 'discoverOrganizations');
    const orgs = json?.data?.account?.organizations;
    if (!Array.isArray(orgs)) {
      throw new BufferError(
        BUFFER_OUTCOME.AMBIGUOUS,
        'discoverOrganizations: malformed response body'
      );
    }
    return orgs.map((o) => ({ id: String(o.id), name: String(o.name ?? '') }));
  }

  /**
   * `channels(input:{organizationId})`. Read-only.
   * @param {{ organizationId?: string }} [params]
   * @returns {Promise<Array<{ id: string, name: string, service: string }>>}
   */
  async function discoverChannels(params = {}) {
    const organizationId = params.organizationId ?? defaultOrganizationId;
    if (!isNonEmptyString(organizationId)) {
      throw new BufferError('CONFIG', 'discoverChannels needs an organizationId');
    }
    let result;
    let json;
    try {
      ({ result, json } = await graphql(DISCOVER_CHANNELS_QUERY, {
        input: { organizationId },
      }));
    } catch (error) {
      throw wrapTransport(error, 'discoverChannels');
    }
    assertOk(result, json, 'discoverChannels');
    const channels = json?.data?.channels;
    if (!Array.isArray(channels)) {
      throw new BufferError(BUFFER_OUTCOME.AMBIGUOUS, 'discoverChannels: malformed response body');
    }
    return channels.map((c) => ({
      id: String(c.id),
      name: String(c.name ?? ''),
      service: String(c.service ?? ''),
    }));
  }

  /**
   * Discovery convenience: every channel plus the MVP platform it maps to
   * (`null` for a connected service outside facebook/twitter/linkedin). Used
   * by `operate.js doctor` to cross-check configured channel-id Variables
   * (plan §12 `inspectChannels`).
   * @param {{ organizationId?: string }} [params]
   */
  async function inspectChannels(params = {}) {
    const channels = await discoverChannels(params);
    return channels.map((c) => ({ ...c, platform: PLATFORM_BY_SERVICE[c.service] ?? null }));
  }

  /**
   * `createPost` — `shareNow`, never a scheduled queue entry (plan §13).
   * Issued exactly once. A lost response / timeout / 5xx never triggers a
   * second create — they map to `ambiguous` for phase-2 reconciliation.
   *
   * @param {{
   *   channelId: string,
   *   post: import('../content.js').SocialPost,
   *   needsApproval?: boolean,
   *   saveToDraft?: boolean,
   * }} params the FROZEN `SocialPost` (never re-rendered here)
   * @returns {Promise<PublishResult>}
   */
  async function create({ channelId, post, needsApproval = false, saveToDraft = false }) {
    if (!isNonEmptyString(channelId)) {
      throw new BufferError('CONFIG', 'create needs a channelId');
    }
    if (!isPlainObject(post) || !BUFFER_PLATFORMS.includes(post.platform)) {
      throw new BufferError(
        'CONFIG',
        `create is Buffer-only (facebook/x/linkedin), got platform ${JSON.stringify(post?.platform)}`
      );
    }
    if (!isNonEmptyString(post.text)) {
      throw new BufferError('CONFIG', 'post.text is empty');
    }
    // FB/LinkedIn: a link asset carries the canonical; X: no parallel asset
    // (the URL lives only in the text), plan §10/§13. `assets` and
    // `needsApproval` are ALWAYS sent explicitly per §13's discrepancy note.
    const assets =
      post.link_card && isNonEmptyString(post.link_card.uri)
        ? [{ link: { url: post.link_card.uri } }]
        : [];

    const input = {
      channelId,
      text: post.text,
      schedulingType: 'automatic',
      mode: 'shareNow',
      assets,
      needsApproval,
      saveToDraft,
    };

    let result;
    let json;
    try {
      ({ result, json } = await graphql(CREATE_POST_MUTATION, { input }));
    } catch (error) {
      // Thrown = response lost / timeout / non-JSON. NEVER a second create.
      const be = wrapTransport(error, 'createPost');
      return {
        outcome: BUFFER_OUTCOME.AMBIGUOUS,
        safeToRetry: false,
        evidence: {
          phase: 'create',
          reason: 'transport failure / lost response',
          message: be.message,
        },
      };
    }

    const httpClass = classifyStatus(result.status, result.headers);
    if (httpClass === ERROR_CLASS.AUTH) {
      return {
        outcome: BUFFER_OUTCOME.AUTH_INVALID,
        safeToRetry: true,
        evidence: { phase: 'create', status: result.status },
      };
    }
    if (httpClass === ERROR_CLASS.RATE_LIMITED) {
      // A 429 RESPONSE: the request was rejected, never processed (plan §17).
      return {
        outcome: BUFFER_OUTCOME.RATE_LIMITED,
        safeToRetry: true,
        retryAfterMs: result.retryAfterMs ?? null,
        evidence: { phase: 'create', status: result.status },
      };
    }
    if (httpClass !== ERROR_CLASS.OK) {
      // An unexpected 4xx/5xx on the mutation: Buffer's own docs note 200 is
      // not guaranteed for every failure mode (plan §13); never assume no
      // effect.
      return {
        outcome: BUFFER_OUTCOME.AMBIGUOUS,
        safeToRetry: false,
        evidence: { phase: 'create', status: result.status, body: clip(json) },
      };
    }

    if (Array.isArray(json?.errors) && json.errors.length > 0 && json?.data == null) {
      // Top-level GraphQL errors with no data: never inferred as "not
      // published" (plan §17 "GraphQL errors ... tras enviar").
      return {
        outcome: BUFFER_OUTCOME.AMBIGUOUS,
        safeToRetry: false,
        evidence: {
          phase: 'create',
          reason: 'top-level GraphQL errors',
          errors: clip(json.errors),
        },
      };
    }

    const payload = json?.data?.createPost;
    if (!isPlainObject(payload) || !isNonEmptyString(payload.__typename)) {
      return {
        outcome: BUFFER_OUTCOME.AMBIGUOUS,
        safeToRetry: false,
        evidence: { phase: 'create', reason: 'malformed createPost response', body: clip(json) },
      };
    }

    if (payload.__typename === 'PostActionSuccess') {
      const post0 = payload.post;
      if (!isPlainObject(post0) || !isNonEmptyString(post0.id)) {
        return {
          outcome: BUFFER_OUTCOME.AMBIGUOUS,
          safeToRetry: false,
          evidence: {
            phase: 'create',
            reason: 'PostActionSuccess carried no post.id',
            body: clip(payload),
          },
        };
      }
      const classified = classifyPost(post0);
      return { ...classified, evidence: { phase: 'create', ...classified.evidence } };
    }

    if (payload.__typename === 'InvalidInputError') {
      // Provably rejected before any provider-side send (plan §17 "rechazo
      // pre-write confirmado").
      return {
        outcome: BUFFER_OUTCOME.REJECTED,
        safeToRetry: false,
        evidence: {
          phase: 'create',
          reason: 'InvalidInputError',
          message: isNonEmptyString(payload.message) ? payload.message : null,
        },
      };
    }

    // `MutationError` or any other/unknown typed error union member: default
    // to AMBIGUOUS (plan §17 default), never "not published".
    return {
      outcome: BUFFER_OUTCOME.AMBIGUOUS,
      safeToRetry: false,
      evidence: {
        phase: 'create',
        reason: payload.__typename,
        message: isNonEmptyString(payload.message) ? payload.message : null,
      },
    };
  }

  /**
   * Batched `post(input:{id})` polling via aliases, at most
   * {@link MAX_POST_IDS_PER_REQUEST} ids per call (plan §13). The caller
   * chunks a larger id list across calls.
   *
   * @param {{ ids: string[] }} params
   * @returns {Promise<Array<{ id: string, found: boolean } & Partial<PublishResult>>>}
   */
  async function get({ ids }) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BufferError('CONFIG', 'get needs a non-empty ids array');
    }
    if (ids.length > MAX_POST_IDS_PER_REQUEST) {
      throw new BufferError(
        'CONFIG',
        `get supports at most ${MAX_POST_IDS_PER_REQUEST} ids per request; caller must chunk`
      );
    }
    const { query, variables } = buildGetPostsQuery(ids);
    let result;
    let json;
    try {
      ({ result, json } = await graphql(query, variables));
    } catch (error) {
      const be = wrapTransport(error, 'get');
      return ids.map((id) => ({
        id,
        found: false,
        outcome: BUFFER_OUTCOME.AMBIGUOUS,
        evidence: {
          phase: 'get',
          reason: 'transport failure / lost response',
          message: be.message,
        },
      }));
    }
    const httpClass = classifyStatus(result.status, result.headers);
    if (httpClass === ERROR_CLASS.AUTH) {
      throw new BufferError(BUFFER_OUTCOME.AUTH_INVALID, `get failed (${result.status})`, {
        status: result.status,
      });
    }
    if (httpClass !== ERROR_CLASS.OK) {
      return ids.map((id) => ({
        id,
        found: false,
        outcome: BUFFER_OUTCOME.AMBIGUOUS,
        evidence: { phase: 'get', status: result.status },
      }));
    }
    return ids.map((id, i) => {
      const node = json?.data?.[`p${i}`];
      if (!isPlainObject(node) || !isNonEmptyString(node.id)) {
        return {
          id,
          found: false,
          outcome: BUFFER_OUTCOME.AMBIGUOUS,
          evidence: { phase: 'get', reason: 'post not found or malformed' },
        };
      }
      return { id, found: true, ...classifyPost(node) };
    });
  }

  /**
   * List every post for a channel, unrestricted by status, paginating up to
   * `maxPages` pages of 100 (plan §13 "Reconciliación sin ID"). Never
   * throws on a transport failure or a non-OK response — those degrade to
   * `truncated: true` so an incomplete read is never read as proof of absence.
   *
   * @param {{ channelId: string, organizationId?: string, maxPages?: number }} params
   * @returns {Promise<{ posts: object[], truncated: boolean }>}
   */
  async function list({ channelId, organizationId, maxPages = DEFAULT_MAX_LIST_PAGES }) {
    const orgId = organizationId ?? defaultOrganizationId;
    if (!isNonEmptyString(channelId)) throw new BufferError('CONFIG', 'list needs a channelId');
    if (!isNonEmptyString(orgId)) throw new BufferError('CONFIG', 'list needs an organizationId');

    const posts = [];
    let cursor = null;
    let truncated = false;

    for (let page = 1; page <= maxPages; page += 1) {
      let result;
      let json;
      try {
        ({ result, json } = await graphql(LIST_POSTS_QUERY, {
          input: { organizationId: orgId, filter: { channelIds: [channelId] } },
          first: 100,
          after: cursor,
        }));
      } catch {
        truncated = true;
        break;
      }
      if (classifyStatus(result.status, result.headers) !== ERROR_CLASS.OK) {
        truncated = true;
        break;
      }
      const connection = json?.data?.posts;
      const edges = Array.isArray(connection?.edges) ? connection.edges : null;
      if (!edges) {
        truncated = true;
        break;
      }
      for (const edge of edges) {
        if (isPlainObject(edge?.node)) posts.push(edge.node);
      }
      const hasNextPage = connection?.pageInfo?.hasNextPage === true;
      if (!hasNextPage) break;
      if (page === maxPages) {
        truncated = true;
        break;
      }
      cursor = connection.pageInfo.endCursor ?? null;
    }

    return { posts, truncated };
  }

  /**
   * Phase-2 reconciliation: list the channel's posts and look for exactly one
   * unambiguous match by frozen normalized text + canonical presence (plan
   * §13/§15). NEVER issues a create. Zero matches — even after a complete
   * listing — is `uncertain`, never treated as proof of absence (plan §13
   * "cero o paginación incompleta → AMBIGUOUS, nunca prueba negativa").
   *
   * @param {{
   *   channelId: string,
   *   organizationId?: string,
   *   frozenText: string,
   *   canonicalUrl: string,
   *   maxPages?: number,
   * }} params
   * @returns {Promise<{
   *   decision: 'confirmed'|'conflict'|'uncertain',
   *   target?: 'PUBLISHED'|'ACCEPTED',
   *   providerId?: string,
   *   externalUrl?: string,
   *   evidence: Record<string, unknown>,
   * }>}
   */
  async function reconcile({ channelId, organizationId, frozenText, canonicalUrl, maxPages }) {
    if (!isNonEmptyString(frozenText) || !isNonEmptyString(canonicalUrl)) {
      throw new BufferError('CONFIG', 'reconcile needs frozenText and canonicalUrl');
    }
    const { posts, truncated } = await list({ channelId, organizationId, maxPages });
    const normalizedFrozen = normalizeForCompare(frozenText);

    const matches = posts.filter((p) => {
      const textMatches = normalizeForCompare(p.text) === normalizedFrozen;
      if (!textMatches) return false;
      const inText = typeof p.text === 'string' && p.text.includes(canonicalUrl);
      const assetLinks = Array.isArray(p.assets) ? p.assets : [];
      const inAsset = assetLinks.some((a) => a?.link?.url === canonicalUrl);
      return inText || inAsset;
    });

    if (matches.length === 1) {
      const post = matches[0];
      return {
        decision: RECONCILE_DECISION.CONFIRMED,
        target: post.status === POST_STATUS.SENT ? 'PUBLISHED' : 'ACCEPTED',
        providerId: String(post.id),
        ...(isNonEmptyString(post.externalLink) ? { externalUrl: post.externalLink } : {}),
        evidence: { matched_status: post.status, pages_truncated: truncated },
      };
    }
    if (matches.length > 1) {
      return {
        decision: RECONCILE_DECISION.CONFLICT,
        evidence: {
          reason: 'more than one post matched the frozen text/canonical',
          match_count: matches.length,
          matched_ids: matches.map((p) => String(p.id)),
        },
      };
    }
    return {
      decision: RECONCILE_DECISION.UNCERTAIN,
      evidence: {
        reason: truncated
          ? 'pagination did not complete; absence is not provable'
          : 'no matching post found; absence is not provable',
        pages_truncated: truncated,
        posts_scanned: posts.length,
      },
    };
  }

  return {
    discoverOrganizations,
    discoverChannels,
    inspectChannels,
    create,
    get,
    list,
    reconcile,
  };
}

function assertOk(result, json, where) {
  const cls = classifyStatus(result.status, result.headers);
  if (cls === ERROR_CLASS.AUTH) {
    throw new BufferError(BUFFER_OUTCOME.AUTH_INVALID, `${where} failed (${result.status})`, {
      status: result.status,
    });
  }
  if (cls === ERROR_CLASS.RATE_LIMITED) {
    throw new BufferError(BUFFER_OUTCOME.RATE_LIMITED, `${where} rate-limited (${result.status})`, {
      status: result.status,
      retryAfterMs: result.retryAfterMs ?? null,
    });
  }
  if (cls !== ERROR_CLASS.OK) {
    throw new BufferError(BUFFER_OUTCOME.AMBIGUOUS, `${where} failed (${result.status})`, {
      status: result.status,
    });
  }
  if (Array.isArray(json?.errors) && json.errors.length > 0 && json?.data == null) {
    throw new BufferError(BUFFER_OUTCOME.AMBIGUOUS, `${where}: top-level GraphQL errors`, {
      errors: clip(json.errors),
    });
  }
}

// --- translation to the ledger's input contracts ----------------------

/**
 * Translate a {@link PublishResult} to the shape `state.recordResult` accepts
 * (mirrors `providers/bluesky.js`'s `toRecordResult`).
 *
 * | outcome          | result                                                         |
 * |------------------|-----------------------------------------------------------------|
 * | published        | `{ recordResult: { status:'PUBLISHED', providerId, externalUrl } }` |
 * | accepted         | `{ recordResult: { status:'ACCEPTED', providerId } }`            |
 * | channel-blocked  | `{ recordResult: { status:'ACCEPTED', providerId }, halt:'channel-misconfigured' }` — the id is real and kept; the orchestrator stops NEW sends to *this platform* (not a global halt) until a human reconfigures the channel (judgment call, documented in the implementation report) |
 * | ambiguous        | `{ recordResult: { status:'AMBIGUOUS' } }`                       |
 * | rejected         | `{ recordResult: { status:'FAILED_PERMANENT', providerId? } }`   |
 * | rate-limited     | `{ recordResult: { status:'RETRYABLE', safeToRetry:true, retryAt } }` |
 * | auth-invalid     | `{ halt:'auth-invalid' }`                                        |
 *
 * @param {PublishResult} pub
 * @param {{ now?: () => number, retryDelayMs?: number }} [options]
 * @returns {{ recordResult?: object, halt?: string, evidence?: object }}
 */
export function toRecordResult(pub, { now = () => Date.now(), retryDelayMs = 15 * 60_000 } = {}) {
  if (!isPlainObject(pub) || !isNonEmptyString(pub.outcome)) {
    throw new BufferError('CONFIG', 'toRecordResult needs a PublishResult with an outcome');
  }
  switch (pub.outcome) {
    case BUFFER_OUTCOME.PUBLISHED:
      return {
        recordResult: {
          status: 'PUBLISHED',
          providerId: pub.providerId,
          ...(pub.externalUrl ? { externalUrl: pub.externalUrl } : {}),
          evidence: pub.evidence,
        },
      };
    case BUFFER_OUTCOME.ACCEPTED:
      return {
        recordResult: { status: 'ACCEPTED', providerId: pub.providerId, evidence: pub.evidence },
      };
    case BUFFER_OUTCOME.CHANNEL_BLOCKED:
      return {
        recordResult: { status: 'ACCEPTED', providerId: pub.providerId, evidence: pub.evidence },
        halt: 'channel-misconfigured',
      };
    case BUFFER_OUTCOME.AMBIGUOUS:
      return { recordResult: { status: 'AMBIGUOUS', evidence: pub.evidence } };
    case BUFFER_OUTCOME.REJECTED:
      return {
        recordResult: {
          status: 'FAILED_PERMANENT',
          ...(pub.providerId ? { providerId: pub.providerId } : {}),
          evidence: pub.evidence,
        },
      };
    case BUFFER_OUTCOME.RATE_LIMITED: {
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
    case BUFFER_OUTCOME.AUTH_INVALID:
      return { halt: 'auth-invalid', evidence: pub.evidence };
    default:
      throw new BufferError(
        'CONFIG',
        `unmappable PublishResult outcome ${JSON.stringify(pub.outcome)}`
      );
  }
}

/**
 * Translate a `reconcile()` decision to `state.recordReconciliation` params
 * (mirrors `providers/bluesky.js`'s `reconciliationParams`). Never emits
 * `authorize-retry`: a Buffer pair has no safe automatic retry path — the
 * spec's only recovery is `adopt` (a single unambiguous match) or `block`
 * (a conflict / operator-authorized exception, §15 "Resolución humana
 * segura").
 *
 * | decision  | descriptor                                                             |
 * |-----------|-------------------------------------------------------------------------|
 * | confirmed | `{ call:'recordReconciliation', kind:'adopt', target, providerId, externalUrl? }` |
 * | conflict  | `{ call:'recordReconciliation', kind:'block' }`                        |
 * | uncertain | `{ call:null }` — keep AMBIGUOUS; the orchestrator's own poll budget (1h/6h/24h, §15) decides when to escalate to a human `block` |
 *
 * @param {{ decision: string, target?: string, providerId?: string, externalUrl?: string, evidence?: object }} recon
 * @param {{ actor?: string, reason?: string }} [meta]
 */
export function reconciliationParams(recon, { actor = 'social-orchestrator', reason } = {}) {
  if (!isPlainObject(recon) || !isNonEmptyString(recon.decision)) {
    throw new BufferError('CONFIG', 'reconciliationParams needs a decision');
  }
  switch (recon.decision) {
    case RECONCILE_DECISION.CONFIRMED:
      return {
        call: 'recordReconciliation',
        kind: 'adopt',
        target: recon.target,
        providerId: recon.providerId,
        ...(isNonEmptyString(recon.externalUrl) ? { externalUrl: recon.externalUrl } : {}),
        resolution: {
          actor,
          reason: reason ?? 'buffer listing matched exactly one post by frozen text + canonical',
          evidence: recon.evidence ?? null,
        },
      };
    case RECONCILE_DECISION.CONFLICT:
      return {
        call: 'recordReconciliation',
        kind: 'block',
        resolution: {
          actor,
          reason: reason ?? 'buffer listing matched more than one post',
          evidence: recon.evidence ?? null,
        },
      };
    case RECONCILE_DECISION.UNCERTAIN:
      return {
        call: null,
        note: 'no unambiguous match; keep AMBIGUOUS and re-check on the next poll budget',
      };
    default:
      throw new BufferError(
        'CONFIG',
        `unknown reconcile decision ${JSON.stringify(recon.decision)}`
      );
  }
}
