import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { load } from 'cheerio';
import { ERROR_CLASS, HttpError, classifyStatus, request } from './http.js';

/**
 * Article eligibility and public-publication verification for the social
 * publisher (plan social-distribution §8 / §11 / §15).
 *
 * Three pure-ish functions:
 * - `validateManifest(rawText)` — parse and validate the `/social-manifest.json`
 *   contract, and bind the SHA-256 digest of the *received bytes* (§8/§190).
 * - `selectCandidates({ manifest, config, now, state })` — decide which
 *   (article × platform) pairs are a NEW authorised distribution, given an
 *   explicitly supplied config, clock and read-only state view. Absence/false
 *   disables; future dates wait; confirmed pairs are omitted; unresolved
 *   attempts never become new sends (§8/§15).
 * - `verifyPublicArticle({ article, fetchImpl })` — GET the canonical URL and
 *   confirm one exact canonical, matching og:url/og:title/og:description, no
 *   `noindex`, and a real, reachable image (§11).
 *
 * This module returns verified data and structured reasons. It does not
 * generate copy, call social APIs, persist state, or implement the state
 * machine — `state` is consumed as the conceptual shape from §15 only.
 */

const SHA_RE = /^[0-9a-f]{40}$/;
const DECIMAL_RE = /^[0-9]+$/;
const REPO_RE = /^[^/\s]+\/[^/\s]+$/;
const SOCIAL_ID_RE = /^[0-9a-f]{64}$/;
const ALLOWED_HOST = 'noticiencias.com';
const MANIFEST_MAX_BYTES = 2 * 1024 * 1024;
const HTML_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Fixed platform order for deterministic candidate output (§15 algorithm). */
export const PLATFORM_ORDER = Object.freeze(['facebook', 'x', 'linkedin', 'bluesky']);

/** A manifest that fails the §8 contract. `reasons` lists every problem found. */
export class ManifestError extends Error {
  /** @param {string[]} reasons */
  constructor(reasons) {
    super(`invalid social manifest: ${reasons.join('; ')}`);
    this.name = 'ManifestError';
    this.reasons = reasons;
  }
}

/** SHA-256 hex of the UTF-8 bytes exactly as received. */
export function digestManifestBytes(rawText) {
  return createHash('sha256').update(Buffer.from(rawText, 'utf8')).digest('hex');
}

function isBareCanonical(value) {
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    return false;
  }
  return (
    parsed.protocol === 'https:' &&
    parsed.host === ALLOWED_HOST &&
    !parsed.username &&
    !parsed.password &&
    !parsed.search &&
    !parsed.hash
  );
}

function validateProvenance(provenance, reasons) {
  if (provenance === null || provenance === undefined) return null;
  if (typeof provenance !== 'object') {
    reasons.push('provenance must be null or an object');
    return null;
  }
  const p = provenance;
  if (!REPO_RE.test(String(p.repository ?? '')))
    reasons.push('provenance.repository must be "owner/repo"');
  if (!SHA_RE.test(String(p.commit ?? ''))) reasons.push('provenance.commit must be a 40-hex SHA');
  if (!DECIMAL_RE.test(String(p.run_id ?? '')))
    reasons.push('provenance.run_id must be a decimal string');
  const attempt = Number(p.build_attempt);
  if (!Number.isInteger(attempt) || attempt < 1)
    reasons.push('provenance.build_attempt must be a positive integer');
  if (typeof p.workflow !== 'string' || p.workflow === '')
    reasons.push('provenance.workflow must be a non-empty string');
  return {
    repository: String(p.repository),
    commit: String(p.commit).toLowerCase(),
    run_id: String(p.run_id),
    build_attempt: attempt,
    workflow: p.workflow,
  };
}

/**
 * Validate the raw manifest text against the §8 contract.
 * @param {string} rawText the response body exactly as received
 * @param {{ maxBytes?: number }} [options]
 * @returns {{
 *   schema_version: 1,
 *   provenance: object | null,
 *   articles: Array<{ collection_id: string, date: string, dateMs: number, title: string, description?: string, canonical_url: string, social: { publish: boolean, id?: string } }>,
 *   digest: string,
 * }}
 */
export function validateManifest(rawText, { maxBytes = MANIFEST_MAX_BYTES } = {}) {
  if (typeof rawText !== 'string') throw new ManifestError(['manifest body must be a string']);
  if (Buffer.byteLength(rawText, 'utf8') > maxBytes) {
    throw new ManifestError([`manifest exceeds the ${maxBytes} byte read limit`]);
  }

  const digest = digestManifestBytes(rawText);

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new ManifestError([
      `body is not valid JSON (${error instanceof Error ? error.message : 'parse error'})`,
    ]);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ManifestError(['manifest must be a JSON object']);
  }

  const reasons = [];
  if (parsed.schema_version !== 1) {
    reasons.push(
      `unsupported schema_version ${JSON.stringify(parsed.schema_version)} (expected 1)`
    );
  }

  const provenance = validateProvenance(parsed.provenance, reasons);

  const rawArticles = Array.isArray(parsed.articles) ? parsed.articles : null;
  if (!rawArticles) reasons.push('articles must be an array');

  const articles = [];
  const idOwner = new Map();
  const canonicalOwner = new Map();
  const collectionOwner = new Map();

  for (const [index, raw] of (rawArticles ?? []).entries()) {
    const where = `articles[${index}]`;
    if (!raw || typeof raw !== 'object') {
      reasons.push(`${where} must be an object`);
      continue;
    }
    const collectionId = raw.collection_id;
    if (typeof collectionId !== 'string' || collectionId.trim() === '') {
      reasons.push(`${where}.collection_id must be a non-empty string`);
    }
    const dateOk = typeof raw.date === 'string' && !Number.isNaN(Date.parse(raw.date));
    if (!dateOk) reasons.push(`${where}.date must be an ISO date string`);
    if (typeof raw.title !== 'string' || raw.title.trim() === '') {
      reasons.push(`${where}.title must be a non-empty string`);
    }
    if (raw.description !== undefined && typeof raw.description !== 'string') {
      reasons.push(`${where}.description must be a string when present`);
    }
    if (!isBareCanonical(raw.canonical_url)) {
      reasons.push(`${where}.canonical_url must be a bare https://${ALLOWED_HOST}/… URL`);
    }

    const social = raw.social;
    let normalizedSocial = { publish: false };
    if (!social || typeof social !== 'object' || Array.isArray(social)) {
      reasons.push(`${where}.social must be an object`);
    } else {
      if (typeof social.publish !== 'boolean') {
        reasons.push(`${where}.social.publish must be a strict boolean`);
      }
      if (social.id !== undefined && !SOCIAL_ID_RE.test(String(social.id))) {
        reasons.push(`${where}.social.id must be 64 lowercase hex chars`);
      }
      if (social.publish === true && !social.id) {
        reasons.push(`${where}.social.id is required when social.publish is true`);
      }
      const extraKeys = Object.keys(social).filter((k) => k !== 'publish' && k !== 'id');
      if (extraKeys.length > 0)
        reasons.push(`${where}.social has unknown keys: ${extraKeys.join(', ')}`);
      normalizedSocial = social.id
        ? { publish: social.publish === true, id: String(social.id) }
        : { publish: social.publish === true };
    }

    if (typeof collectionId === 'string') {
      if (collectionOwner.has(collectionId)) {
        reasons.push(`duplicate collection_id "${collectionId}"`);
      } else {
        collectionOwner.set(collectionId, index);
      }
    }
    if (normalizedSocial.id) {
      if (idOwner.has(normalizedSocial.id)) {
        reasons.push(`duplicate social.id "${normalizedSocial.id}"`);
      } else {
        idOwner.set(normalizedSocial.id, index);
      }
    }
    if (isBareCanonical(raw.canonical_url)) {
      if (canonicalOwner.has(raw.canonical_url)) {
        reasons.push(`duplicate canonical_url "${raw.canonical_url}"`);
      } else {
        canonicalOwner.set(raw.canonical_url, index);
      }
    }

    const article = {
      collection_id: collectionId,
      date: raw.date,
      dateMs: dateOk ? Date.parse(raw.date) : NaN,
      title: raw.title,
      canonical_url: raw.canonical_url,
      social: normalizedSocial,
    };
    if (typeof raw.description === 'string') article.description = raw.description;
    articles.push(article);
  }

  if (reasons.length > 0) throw new ManifestError(reasons);

  return { schema_version: 1, provenance, articles, digest };
}

// --- selection -------------------------------------------------------------

/** Reason codes for a pair that is NOT a new send this run (never a persisted status). */
export const SKIP_REASON = Object.freeze({
  GLOBAL_DISABLED: 'GLOBAL_DISABLED',
  PLATFORM_DISABLED: 'PLATFORM_DISABLED',
  PUBLISH_FALSE: 'PUBLISH_FALSE',
  MISSING_ID: 'MISSING_ID',
  FUTURE_DATE: 'FUTURE_DATE',
  ALREADY_PUBLISHED: 'ALREADY_PUBLISHED',
  UNRESOLVED_ATTEMPT: 'UNRESOLVED_ATTEMPT',
  RETRY_NOT_DUE: 'RETRY_NOT_DUE',
  BLOCKED: 'BLOCKED',
  IDENTITY_CONFLICT: 'IDENTITY_CONFLICT',
  DESTINATION_CHANGED: 'DESTINATION_CHANGED',
  DEPLOY_UNVERIFIED: 'DEPLOY_UNVERIFIED',
});

const UNRESOLVED_STATUSES = new Set(['PUBLISHING', 'ACCEPTED', 'AMBIGUOUS']);
const BLOCKED_STATUSES = new Set(['BLOCKED', 'FAILED_PERMANENT']);

/**
 * @typedef {object} Candidate
 * @property {string} collection_id
 * @property {string | null} social_id
 * @property {string} platform
 * @property {string} canonical_url
 * @property {boolean} resume `true` when this resumes a due RETRYABLE attempt.
 * @property {import('./github.js').DeployProof} deploy_proof the verified proof
 *   this candidate was selected under; its `manifest_digest` equals the digest
 *   of the snapshot the candidate came from (plan §12 Article contract).
 */

/**
 * @typedef {object} SkipRow a run-level reason a pair is not a new send.
 *   Never a persisted status (§463).
 * @property {string} collection_id
 * @property {string | null} social_id
 * @property {string} [platform]
 * @property {string} reason one of {@link SKIP_REASON}
 * @property {string} [conflicting_social_id]
 * @property {string} [account_key]
 * @property {string} [date]
 * @property {string | number} [retry_at]
 * @property {string} [status]
 */

/**
 * @typedef {object} SelectionResult
 * @property {Candidate[]} candidates
 * @property {SkipRow[]} skipped
 * @property {SkipRow[]} waiting
 * @property {SkipRow[]} conflicts
 */

/**
 * True only when `proof` is bound to this exact manifest snapshot: same
 * received-bytes digest AND same provenance identity. A manifest without a
 * `provenance` block can never satisfy this (plan §7 — only builds from the
 * deploy workflow carry provenance).
 *
 * @param {import('./github.js').DeployProof | null | undefined} proof
 * @param {ReturnType<typeof validateManifest>} manifest
 * @returns {boolean}
 */
function isProofBoundToManifest(proof, manifest) {
  if (!proof || typeof proof !== 'object') return false;
  const prov = manifest?.provenance;
  if (!prov || typeof prov !== 'object') return false;
  if (String(proof.manifest_digest ?? '') !== String(manifest.digest ?? '')) return false;
  if (String(proof.repository ?? '') !== String(prov.repository ?? '')) return false;
  if (String(proof.commit ?? '').toLowerCase() !== String(prov.commit ?? '').toLowerCase()) {
    return false;
  }
  if (String(proof.run_id ?? '') !== String(prov.run_id ?? '')) return false;
  if (Number(proof.build_attempt) !== Number(prov.build_attempt)) return false;
  return true;
}

function readStateArticles(state) {
  return state && state.articles && typeof state.articles === 'object' ? state.articles : {};
}

/**
 * Detect whether this article's collection_id / canonical is already bound to
 * a *different* social.id in the state view (§8 identity conflict → zero
 * writes for the whole article, §207).
 *
 * Only the "another id claims my file/URL" direction is a conflict. The
 * inverse — this same social.id now on a different file *and* a different
 * canonical — is a deliberate rename, which §206 keeps as one identity, so it
 * is not flagged here.
 */
function hasIdentityConflict(article, stateArticles) {
  const myId = article.social.id;
  for (const [id, entry] of Object.entries(stateArticles)) {
    if (id === myId) continue;
    const collections = Array.isArray(entry?.collection_ids) ? entry.collection_ids : [];
    const canonicals = Array.isArray(entry?.canonical_urls) ? entry.canonical_urls : [];
    if (collections.includes(article.collection_id) || canonicals.includes(article.canonical_url)) {
      return id;
    }
  }
  return null;
}

/**
 * A pair is only a NEW authorised distribution when the snapshot it comes
 * from belongs to a *proven* public deploy (plan §175). `deployProof` is the
 * object `verifyDeployProof` returns as `result.proof` **only when
 * `result.trust === 'verified'`** — the orchestrator must not pass a proof
 * from a `deferred`/`blocked` result.
 *
 * This function cannot see the outer `trust` flag, so it re-checks the
 * contract structurally (plan §20.2 "define y valida claramente el contrato
 * entre funciones"): the proof must be bound to *this* snapshot both by the
 * SHA-256 digest of the received bytes **and** by the manifest's own
 * `provenance` identity (repository, commit, run_id, build_attempt). A bare
 * `{ manifest_digest }` object, a proof for a digest-colliding manifest with
 * different provenance, or any manifest with no `provenance` block (a local
 * build) therefore cannot authorise a send — every article is skipped
 * `DEPLOY_UNVERIFIED`. The gate is structural: each candidate carries the
 * proof it was selected under.
 *
 * @param {{
 *   manifest: ReturnType<typeof validateManifest>,
 *   config: { publishEnabled: boolean, enabledPlatforms: string[], platformAccounts?: Record<string, string> },
 *   now: () => number,
 *   state: { articles?: Record<string, { collection_ids?: string[], canonical_urls?: string[], platforms?: Record<string, { status?: string, account_key?: string, retry_at?: string | number }> }> },
 *   deployProof: import('./github.js').DeployProof | null,
 * }} params
 * @returns {SelectionResult}
 */
export function selectCandidates({ manifest, config, now, state, deployProof }) {
  const clockMs = typeof now === 'function' ? now() : Date.now();
  const enabled = new Set(Array.isArray(config?.enabledPlatforms) ? config.enabledPlatforms : []);
  const accounts = config?.platformAccounts ?? {};
  const stateArticles = readStateArticles(state);

  /** @type {Candidate[]} */
  const candidates = [];
  /** @type {SkipRow[]} */
  const skipped = [];
  /** @type {SkipRow[]} */
  const waiting = [];
  /** @type {SkipRow[]} */
  const conflicts = [];

  const proofOk = isProofBoundToManifest(deployProof, manifest);

  if (!proofOk) {
    for (const article of manifest.articles) {
      skipped.push({
        collection_id: article.collection_id,
        social_id: article.social.id ?? null,
        reason: SKIP_REASON.DEPLOY_UNVERIFIED,
      });
    }
    return { candidates, skipped, waiting, conflicts };
  }

  for (const article of manifest.articles) {
    const base = { collection_id: article.collection_id, social_id: article.social.id ?? null };

    const conflictId = article.social.id ? hasIdentityConflict(article, stateArticles) : null;
    if (conflictId) {
      conflicts.push({
        ...base,
        reason: SKIP_REASON.IDENTITY_CONFLICT,
        conflicting_social_id: conflictId,
      });
      continue; // zero writes for the entire article
    }

    if (!config?.publishEnabled) {
      skipped.push({ ...base, reason: SKIP_REASON.GLOBAL_DISABLED });
      continue;
    }
    if (article.social.publish !== true) {
      skipped.push({ ...base, reason: SKIP_REASON.PUBLISH_FALSE });
      continue;
    }
    if (!article.social.id) {
      skipped.push({ ...base, reason: SKIP_REASON.MISSING_ID });
      continue;
    }
    if (Number.isFinite(article.dateMs) && article.dateMs > clockMs) {
      waiting.push({ ...base, reason: SKIP_REASON.FUTURE_DATE, date: article.date });
      continue;
    }

    const platformState = stateArticles[article.social.id]?.platforms ?? {};

    for (const platform of PLATFORM_ORDER) {
      const row = { ...base, platform, canonical_url: article.canonical_url };
      if (!enabled.has(platform)) {
        skipped.push({ ...row, reason: SKIP_REASON.PLATFORM_DISABLED });
        continue;
      }
      const entry = platformState[platform];
      const configuredAccount = accounts[platform];
      if (entry?.account_key && configuredAccount && entry.account_key !== configuredAccount) {
        skipped.push({
          ...row,
          reason: SKIP_REASON.DESTINATION_CHANGED,
          account_key: entry.account_key,
        });
        continue;
      }

      const status = entry?.status;
      if (!status) {
        candidates.push({ ...row, resume: false, deploy_proof: deployProof });
        continue;
      }
      if (status === 'PUBLISHED') {
        skipped.push({ ...row, reason: SKIP_REASON.ALREADY_PUBLISHED });
        continue;
      }
      if (BLOCKED_STATUSES.has(status)) {
        skipped.push({ ...row, reason: SKIP_REASON.BLOCKED });
        continue;
      }
      if (UNRESOLVED_STATUSES.has(status)) {
        skipped.push({ ...row, reason: SKIP_REASON.UNRESOLVED_ATTEMPT });
        continue;
      }
      if (status === 'RETRYABLE') {
        // A RETRYABLE row with no parseable retry_at is a malformed/partial
        // state entry: skip conservatively rather than emit a send (§575).
        const retryAt = entry?.retry_at != null ? Date.parse(String(entry.retry_at)) : NaN;
        if (!Number.isFinite(retryAt)) {
          skipped.push({ ...row, reason: SKIP_REASON.UNRESOLVED_ATTEMPT, status });
        } else if (retryAt > clockMs) {
          skipped.push({ ...row, reason: SKIP_REASON.RETRY_NOT_DUE, retry_at: entry.retry_at });
        } else {
          candidates.push({ ...row, resume: true, deploy_proof: deployProof });
        }
        continue;
      }
      // Unknown status: conservative — treat as an unresolved attempt.
      skipped.push({ ...row, reason: SKIP_REASON.UNRESOLVED_ATTEMPT, status });
    }
  }

  return { candidates, skipped, waiting, conflicts };
}

// --- public verification --------------------------------------------------

/**
 * Minimal text normalization for comparing manifest strings against rendered
 * metadata: NFC, collapse internal whitespace, trim. `content.js` (package 6)
 * owns social copy generation — this is only an equality basis, deliberately
 * not a shared normalizer.
 */
function normalizeForCompare(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

const IMAGE_MAGIC = [
  [0xff, 0xd8, 0xff], // JPEG
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0x47, 0x49, 0x46, 0x38], // GIF
];

function looksLikeImage(buffer) {
  if (!buffer || buffer.length < 12) return false;
  for (const magic of IMAGE_MAGIC) {
    if (magic.every((byte, i) => buffer[i] === byte)) return true;
  }
  // RIFF....WEBP
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')
    return true;
  // ISO-BMFF (AVIF/HEIF): bytes 4-8 == 'ftyp'
  if (buffer.toString('ascii', 4, 8) === 'ftyp') return true;
  return false;
}

async function fetchImage(imageUrl, { fetchImpl, allowedImageHosts, maxImageBytes, timeoutMs }) {
  try {
    const res = await request(imageUrl, {
      fetchImpl,
      allowedHosts: allowedImageHosts,
      followRedirects: true,
      maxRedirects: 3,
      maxBytes: maxImageBytes,
      timeoutMs,
    });
    return { res, error: null };
  } catch (error) {
    return {
      res: null,
      error:
        error instanceof HttpError
          ? error
          : new HttpError(ERROR_CLASS.CONNECTION, 'image fetch failed'),
    };
  }
}

/**
 * @typedef {object} VerifiedArticle
 * @property {string} canonical_url
 * @property {string} og_url
 * @property {string} title normalized og:title
 * @property {string} [description] normalized og:description (when the manifest carries one)
 * @property {string | null} image_url
 * @property {string | null} image_content_type
 * @property {number | null} image_bytes
 * @property {string} final_url
 */

/**
 * @typedef {object} VerifyResult
 * @property {boolean} ok
 * @property {Array<{ code: string, detail: string }>} reasons structured, not copy
 * @property {VerifiedArticle | null} verified
 */

/**
 * @param {{
 *   article: { canonical_url: string, title: string, description?: string },
 *   fetchImpl: import('./http.js').FetchLike,
 *   now?: () => number,
 *   maxHtmlBytes?: number,
 *   maxImageBytes?: number,
 *   allowedImageHosts?: string[],
 *   timeoutMs?: number,
 * }} params
 * @returns {Promise<VerifyResult>}
 */
export async function verifyPublicArticle(params) {
  const {
    article,
    fetchImpl,
    maxHtmlBytes = HTML_MAX_BYTES,
    maxImageBytes = IMAGE_MAX_BYTES,
    allowedImageHosts = [ALLOWED_HOST],
    timeoutMs,
  } = params;

  const reasons = [];
  const fail = (code, detail) => reasons.push({ code, detail });

  if (!isBareCanonical(article?.canonical_url)) {
    return {
      ok: false,
      reasons: [
        {
          code: 'BAD_CANONICAL_INPUT',
          detail: 'article.canonical_url is not a bare https URL on the domain',
        },
      ],
      verified: null,
    };
  }

  let res;
  try {
    res = await request(article.canonical_url, {
      fetchImpl,
      allowedHosts: [ALLOWED_HOST],
      followRedirects: true,
      maxRedirects: 3,
      maxBytes: maxHtmlBytes,
      timeoutMs,
    });
  } catch (error) {
    const detail =
      error instanceof HttpError
        ? `${error.errorClass}: ${error.sanitizedMessage}`
        : 'request failed';
    return { ok: false, reasons: [{ code: 'FETCH_FAILED', detail }], verified: null };
  }

  if (res.status !== 200) {
    return {
      ok: false,
      reasons: [
        {
          code: 'STATUS',
          detail: `expected 200, got ${res.status} (${classifyStatus(res.status, res.headers)})`,
        },
      ],
      verified: null,
    };
  }

  const $ = load(res.bodyText);

  const canonicalLinks = $('link[rel="canonical"]');
  if (canonicalLinks.length === 0) {
    fail('NO_CANONICAL', 'no <link rel="canonical"> in the rendered page');
  } else if (canonicalLinks.length > 1) {
    fail('MULTIPLE_CANONICAL', `${canonicalLinks.length} canonical links found`);
  } else {
    const href = (canonicalLinks.attr('href') ?? '').trim();
    if (href !== article.canonical_url) {
      fail('CANONICAL_MISMATCH', `canonical "${href}" !== manifest "${article.canonical_url}"`);
    }
  }

  // og:url / og:title / og:description / og:image are singletons. A page that
  // carries two — a first value that matches the manifest and a second that
  // contradicts it — must be rejected outright, not silently resolved to the
  // first (plan §11 "OG duplicados o contradictorios"); consumers/crawlers do
  // not agree on which one wins.
  const singleMeta = (property, code) => {
    const tags = $(`meta[property="${property}"]`);
    if (tags.length > 1) {
      fail(code, `${tags.length} <meta property="${property}"> tags found`);
    }
    return tags.first().attr('content');
  };

  const ogUrl = (singleMeta('og:url', 'MULTIPLE_OG_URL') ?? '').trim();
  if (!ogUrl) fail('OG_URL_MISSING', 'og:url is absent');
  else if (ogUrl !== article.canonical_url) {
    fail('OG_URL_MISMATCH', `og:url "${ogUrl}" !== manifest "${article.canonical_url}"`);
  }

  const ogTitle = singleMeta('og:title', 'MULTIPLE_OG_TITLE');
  if (ogTitle == null) fail('OG_TITLE_MISSING', 'og:title is absent');
  else if (normalizeForCompare(ogTitle) !== normalizeForCompare(article.title)) {
    fail('OG_TITLE_MISMATCH', `og:title "${normalizeForCompare(ogTitle)}" !== manifest title`);
  }

  const ogDesc = singleMeta('og:description', 'MULTIPLE_OG_DESCRIPTION');
  if (article.description != null && article.description !== '') {
    if (ogDesc == null)
      fail('OG_DESCRIPTION_MISSING', 'og:description is absent but the manifest carries one');
    else if (normalizeForCompare(ogDesc) !== normalizeForCompare(article.description)) {
      fail('OG_DESCRIPTION_MISMATCH', 'og:description does not match the manifest description');
    }
  }

  const robotsMeta = ($('meta[name="robots"]').attr('content') ?? '').toLowerCase();
  const robotsHeader = String(res.headers['x-robots-tag'] ?? '').toLowerCase();
  if (/noindex/.test(robotsMeta) || /noindex/.test(robotsHeader)) {
    fail('NOINDEX', 'the page asks crawlers not to index it');
  }

  // Only the FIRST og:image is inspected/fetched below, so a second tag would
  // be a way to smuggle a different (e.g. off-domain) image past verification.
  const ogImage = (singleMeta('og:image', 'MULTIPLE_OG_IMAGE') ?? '').trim();
  let verifiedImage = null;
  if (!ogImage) {
    fail('OG_IMAGE_MISSING', 'og:image is absent');
  } else {
    let imageUrl;
    try {
      imageUrl = new URL(ogImage);
    } catch {
      imageUrl = null;
    }
    if (!imageUrl || imageUrl.protocol !== 'https:' || !allowedImageHosts.includes(imageUrl.host)) {
      fail('OG_IMAGE_OFFDOMAIN', `og:image "${ogImage}" is not an allowed https image URL`);
    } else {
      const { res: imgRes, error } = await fetchImage(imageUrl.href, {
        fetchImpl,
        allowedImageHosts,
        maxImageBytes,
        timeoutMs,
      });
      if (error) {
        fail('IMAGE_FETCH_FAILED', `${error.errorClass}: ${error.sanitizedMessage}`);
      } else if (imgRes.status !== 200) {
        fail('IMAGE_STATUS', `image responded ${imgRes.status}`);
      } else {
        const contentType = String(imgRes.headers['content-type'] ?? '').toLowerCase();
        const typedImage = contentType.startsWith('image/');
        const sniffedImage = looksLikeImage(imgRes.bodyBuffer);
        if (!typedImage) fail('IMAGE_CONTENT_TYPE', `content-type "${contentType}" is not image/*`);
        if (!sniffedImage)
          fail(
            'IMAGE_NOT_IMAGE',
            'response bytes are not a recognized image (HTML disguised as an image?)'
          );
        if (typedImage && sniffedImage) {
          verifiedImage = {
            url: imageUrl.href,
            content_type: contentType,
            bytes: imgRes.bodyBytes,
          };
        }
      }
    }
  }

  const ok = reasons.length === 0;
  return {
    ok,
    reasons,
    verified: ok
      ? {
          canonical_url: article.canonical_url,
          og_url: ogUrl,
          title: normalizeForCompare(ogTitle),
          description: article.description != null ? normalizeForCompare(ogDesc) : undefined,
          image_url: verifiedImage?.url ?? null,
          image_content_type: verifiedImage?.content_type ?? null,
          image_bytes: verifiedImage?.bytes ?? null,
          final_url: res.url,
        }
      : null,
  };
}
