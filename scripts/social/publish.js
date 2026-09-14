import {
  StateError,
  allocateBlueskyMicros,
  loadState,
  recordIntent,
  recordProvenDeploy,
  recordReconciliation,
  recordResult,
  releaseUnsentReservation,
} from './state.js';
import { evaluateOwnerLiveness } from './state.js';
import { getRunStatus, verifyDeployProof } from './github.js';
import {
  digestManifestBytes,
  selectCandidates,
  validateManifest,
  verifyPublicArticle,
} from './article.js';
import { makeSocialPost } from './content.js';
import * as buffer from './providers/buffer.js';
import * as bluesky from './providers/bluesky.js';

/**
 * Orchestration + CLI for the social publisher (plan social-distribution
 * §5 / §12 / §15 / §16 / §17 / §19 / §21).
 *
 * `runDistribution` is the normative algorithm from §15, transcribed
 * literally:
 *
 *   validate config/trust → load state → fetch manifest → verify deploy
 *   proof → (dry-run: print decisions, zero mutations, return) → persist
 *   proof → reconcile pending attempts (read-only + ledger writes) →
 *   (mode reconcile: summarize, return) → for each eligible article/platform:
 *   reserve → build/prepare → re-check the manifest snapshot → send once →
 *   persist → bounded poll of ACCEPTED Buffer ids → summary → exit code.
 *
 * Every external effect (clock, RNG, sleep, HTTP, the GitHub/Buffer/Bluesky
 * clients, the ledger store) is injected so tests exercise the full decision
 * logic without a network, a timer, or a real credential.
 */

export class PublishError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PublishError';
    this.code = code;
  }
}

const BUFFER_PLATFORM_SET = new Set(buffer.BUFFER_PLATFORMS);
const DEFAULT_MAX_NEW_ARTICLES_PER_RUN = 20;
/** §13 "Tras 24 h sin sent, warning de operador ... después BLOCKED con acción humana". */
const DEFAULT_AMBIGUITY_BLOCK_AFTER_MS = 24 * 60 * 60 * 1000;
/** §13 "a +15 s y +60 s" bounded polling of newly-ACCEPTED Buffer ids. */
const DEFAULT_POLL_DELAYS_MS = Object.freeze([15_000, 60_000]);

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function nowIso(now) {
  return new Date(typeof now === 'function' ? now() : Date.now()).toISOString();
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * @typedef {object} RunConfig
 * @property {boolean} publishEnabled true when publishing is enabled via config (§18)
 * @property {string[]} enabledPlatforms subset of facebook/x/linkedin/bluesky (§18)
 * @property {Record<string,string>} platformAccounts channel id (Buffer) / DID (Bluesky) per platform
 * @property {string} repository `owner/repo`
 * @property {string} defaultBranch
 * @property {string} [workflowPath]
 * @property {number} [maxNewArticlesPerRun]
 * @property {number} [ambiguityBlockAfterMs]
 * @property {number[]} [pollDelaysMs]
 */

/**
 * @typedef {object} RunDependencies
 * @property {'dry-run'|'publish'|'reconcile'} mode
 * @property {boolean} trustedContext only a real GitHub Actions job context
 *   (or a test asserting one) may execute non-dry-run mutations (plan §21).
 * @property {{ articleId?: string, platform?: string }} [selectors]
 * @property {RunConfig} config
 * @property {{ runId: string, attempt: number }} session
 * @property {() => number} [now]
 * @property {(ms: number) => Promise<void>} [sleep]
 * @property {() => number} [rng]
 * @property {() => Promise<string>} fetchManifest returns the raw manifest body
 * @property {{ fetchImpl: Function, token?: string, timeoutMs?: number }} [githubDeps]
 * @property {import('./state.js').StateStore} [stateStore] required unless mode is dry-run
 * @property {ReturnType<typeof import('./providers/buffer.js').createBufferClient>} [bufferClient]
 * @property {ReturnType<typeof import('./providers/bluesky.js').createBlueskyClient>} [blueskyClient]
 */

function emptyHypotheticalState(now) {
  return {
    schema_version: 1,
    initialized_at: nowIso(now),
    revision: 0,
    last_transition_nonce: null,
    last_allocated_bluesky_micros: 0,
    proven_deploys: {},
    articles: {},
  };
}

/**
 * The single orchestration entry point. Never throws for an ordinary
 * operational outcome — every problem is folded into the returned summary and
 * `exitCode` (plan §19); it throws only for a genuine misconfiguration
 * (`PublishError('CONFIG', …)`).
 *
 * @param {RunDependencies} deps
 */
export async function runDistribution(deps) {
  const {
    mode = 'dry-run',
    trustedContext = false,
    selectors = {},
    config,
    session,
    now = () => Date.now(),
    sleep = async () => {},
    rng = Math.random,
    fetchManifest,
    githubDeps,
    stateStore,
    bufferClient,
    blueskyClient,
  } = deps || {};

  if (!['dry-run', 'publish', 'reconcile'].includes(mode)) {
    throw new PublishError('CONFIG', `unknown mode ${JSON.stringify(mode)}`);
  }
  if (!isPlainObject(config)) throw new PublishError('CONFIG', 'config is required');
  if (mode !== 'dry-run' && !trustedContext) {
    throw new PublishError(
      'CONFIG',
      'real execution (publish/reconcile) requires a trusted GitHub Actions context'
    );
  }
  if (mode !== 'dry-run' && !stateStore) {
    throw new PublishError('CONFIG', `${mode} requires a stateStore`);
  }
  if (typeof fetchManifest !== 'function') {
    throw new PublishError('CONFIG', 'fetchManifest is required');
  }

  const summary = {
    mode,
    disabled: config.publishEnabled !== true,
    trust: null,
    mutation_count: 0,
    reconciliation: [],
    sent: [],
    skipped: [],
    waiting: [],
    conflicts: [],
    deferred_new_article_budget: 0,
    warnings: [],
    state_source: 'ledger',
  };

  // --- load state (dry-run may fall back to a clearly-labeled hypothetical) --
  let state;
  if (stateStore) {
    try {
      ({ state } = await loadState({ store: stateStore }));
    } catch (error) {
      if (
        mode === 'dry-run' &&
        error instanceof StateError &&
        error.code === 'STATE_NOT_INITIALIZED'
      ) {
        state = emptyHypotheticalState(now);
        summary.state_source = 'hypothetical';
        summary.warnings.push('STATE_NOT_INITIALIZED');
      } else {
        throw error;
      }
    }
  } else {
    state = emptyHypotheticalState(now);
    summary.state_source = 'hypothetical';
  }

  // --- manifest + deploy trust ------------------------------------------
  const rawManifest = await fetchManifest();
  const manifest = validateManifest(rawManifest);

  let deployProof = null;
  if (manifest.provenance && githubDeps) {
    const runStatus = await getRunStatus({
      fetchImpl: githubDeps.fetchImpl,
      token: githubDeps.token,
      repository: manifest.provenance.repository,
      runId: manifest.provenance.run_id,
      attempt: manifest.provenance.build_attempt,
      timeoutMs: githubDeps.timeoutMs,
    });
    const verdict = verifyDeployProof({
      provenance: manifest.provenance,
      manifestDigest: manifest.digest,
      runStatus,
      expected: {
        repository: config.repository,
        defaultBranch: config.defaultBranch,
        workflowPath: config.workflowPath,
      },
      provenDeploys: state.proven_deploys,
      now,
    });
    summary.trust = verdict.trust;
    summary.trust_reasons = verdict.reasons;
    if (verdict.trust === 'verified') deployProof = verdict.proof;
  } else {
    summary.trust = 'blocked';
    summary.trust_reasons = ['manifest has no provenance, or no githubDeps was supplied'];
  }

  // --- dry-run: read-only decisions, zero mutations ----------------------
  if (mode === 'dry-run') {
    const selection = selectCandidates({
      manifest,
      config: toSelectConfig(config),
      now,
      state,
      deployProof,
    });
    summary.skipped = selection.skipped;
    summary.waiting = selection.waiting;
    summary.conflicts = selection.conflicts;
    summary.sent = [];
    for (const candidate of orderCandidates(selection.candidates, manifest)) {
      const article = findManifestArticle(manifest, candidate);
      if (!article) continue;
      const verified = await verifyPublicArticle({
        article: {
          canonical_url: article.canonical_url,
          title: article.title,
          description: article.description,
        },
        fetchImpl: deps.fetchImpl ?? globalThis.fetch,
      }).catch(() => ({
        ok: false,
        reasons: [{ code: 'FETCH_FAILED', detail: 'dry-run fetch unavailable' }],
      }));
      summary.sent.push({
        social_id: candidate.social_id,
        collection_id: candidate.collection_id,
        platform: candidate.platform,
        would_publish: verified.ok === true,
        reasons: verified.ok ? [] : verified.reasons,
        note: 'dry-run: no login/refresh/uploadBlob/create/put, no ledger write',
      });
    }
    summary.mutation_count = 0;
    summary.exit_code = summary.disabled ? 0 : 0;
    return summary;
  }

  // --- persist proof (real modes only) -----------------------------------
  if (deployProof) {
    const proofOutcome = await recordProvenDeploy({
      store: stateStore,
      session,
      proof: deployProof,
      now,
    });
    if (proofOutcome.outcome === 'indeterminate') {
      summary.warnings.push('PROOF_PERSIST_INDETERMINATE — stopping all new writes');
      summary.exit_code = 1;
      return summary;
    }
    if (proofOutcome.state) state = proofOutcome.state;
  }

  // --- reconciliation phase ----------------------------------------------
  const reconcileOutcome = await reconcilePending({
    state,
    stateStore,
    session,
    githubDeps,
    bufferClient,
    blueskyClient,
    config,
    now,
  });
  summary.reconciliation = reconcileOutcome.rows;
  if (reconcileOutcome.state) state = reconcileOutcome.state;
  if (reconcileOutcome.haltAll) {
    summary.warnings.push(reconcileOutcome.haltReason);
    summary.exit_code = 1;
    return summary;
  }

  if (mode === 'reconcile') {
    summary.exit_code = summary.reconciliation.some((r) => r.result === 'BLOCKED') ? 1 : 0;
    return summary;
  }

  if (!config.publishEnabled) {
    summary.exit_code = 0;
    return summary;
  }

  // --- new-send loop ------------------------------------------------------
  const selection = selectCandidates({
    manifest,
    config: toSelectConfig(config),
    now,
    state,
    deployProof,
  });
  summary.skipped = selection.skipped;
  summary.waiting = selection.waiting;
  summary.conflicts = selection.conflicts;

  const allCandidates = [
    ...orderCandidates(selection.candidates, manifest),
    ...reconcileOutcome.safeBlueskyRetryProposals,
  ];

  let manifestChanged = false;
  let haltAll = false;
  let haltReason = null;
  let newArticlesTouched = new Set();
  const sendRows = [];

  for (const candidate of allCandidates) {
    if (haltAll || manifestChanged) break;
    const article = findManifestArticle(manifest, candidate);
    if (!article) continue;

    if (
      !newArticlesTouched.has(candidate.social_id) &&
      newArticlesTouched.size >= (config.maxNewArticlesPerRun ?? DEFAULT_MAX_NEW_ARTICLES_PER_RUN)
    ) {
      summary.deferred_new_article_budget += 1;
      continue;
    }
    newArticlesTouched.add(candidate.social_id);

    if (selectors.articleId && candidate.social_id !== selectors.articleId) continue;
    if (
      selectors.platform &&
      selectors.platform !== 'all' &&
      candidate.platform !== selectors.platform
    )
      continue;

    const verified = await verifyPublicArticle({
      article: {
        canonical_url: article.canonical_url,
        title: article.title,
        description: article.description,
      },
      fetchImpl: deps.fetchImpl ?? globalThis.fetch,
    });
    if (!verified.ok) {
      sendRows.push({
        social_id: candidate.social_id,
        platform: candidate.platform,
        result: 'CHECK_FAILED',
        reasons: verified.reasons,
      });
      continue;
    }

    const outcome = await sendOneCandidate({
      candidate,
      article,
      verified,
      config,
      stateStore,
      session,
      bufferClient,
      blueskyClient,
      state,
      now,
      rng,
      fetchManifest,
      originalDigest: manifest.digest,
    });
    sendRows.push(outcome.row);
    if (outcome.manifestChanged) manifestChanged = true;
    if (outcome.haltAll) {
      haltAll = true;
      haltReason = outcome.haltReason;
    }
    if (outcome.channelHalted) {
      // Channel-level halt (Buffer draft/needs_approval, plan §13): stop
      // sending NEW posts to this exact platform for the rest of the run,
      // without affecting other networks.
      allCandidates.splice(
        0,
        allCandidates.length,
        ...allCandidates.filter((c) => c.platform !== candidate.platform)
      );
    }
  }
  summary.sent = sendRows;
  if (manifestChanged)
    summary.warnings.push('MANIFEST_CHANGED_MID_RUN — stopped issuing new sends');
  if (haltAll) {
    summary.warnings.push(haltReason);
    summary.exit_code = 1;
    return summary;
  }

  // --- bounded poll of newly-ACCEPTED Buffer ids --------------------------
  const acceptedBufferIds = sendRows
    .filter((r) => r.result === 'ACCEPTED' && BUFFER_PLATFORM_SET.has(r.platform) && r.provider_id)
    .map((r) => ({
      socialId: r.social_id,
      platform: r.platform,
      intentId: r.intent_id,
      providerId: r.provider_id,
    }));

  if (acceptedBufferIds.length > 0 && bufferClient) {
    for (const delayMs of config.pollDelaysMs ?? DEFAULT_POLL_DELAYS_MS) {
      await sleep(delayMs);
      for (const group of chunk(acceptedBufferIds, buffer.MAX_POST_IDS_PER_REQUEST)) {
        const results = await bufferClient.get({ ids: group.map((g) => g.providerId) });
        for (let i = 0; i < group.length; i += 1) {
          const item = group[i];
          const pub = results[i];
          if (!pub || pub.outcome === buffer.BUFFER_OUTCOME.AMBIGUOUS) continue; // keep polling
          const translated = buffer.toRecordResult(pub, { now });
          if (translated.recordResult) {
            await recordResult({
              store: stateStore,
              session,
              socialId: item.socialId,
              platform: item.platform,
              intentId: item.intentId,
              result: translated.recordResult,
              now,
            }).catch(() => {});
          }
        }
      }
    }
  }

  const problemStates = new Set(['FAILED_PERMANENT', 'AMBIGUOUS', 'CHECK_FAILED']);
  const hasProblem =
    summary.sent.some((r) => problemStates.has(r.result)) ||
    summary.reconciliation.some((r) => r.result === 'BLOCKED');
  summary.exit_code = hasProblem ? 1 : 0;
  summary.mutation_count = sendRows.length;
  return summary;
}

/** `article.js`'s `SelectionResult` config shape (a subset of `RunConfig`). */
function toSelectConfig(config) {
  return {
    publishEnabled: config.publishEnabled === true,
    enabledPlatforms: config.enabledPlatforms ?? [],
    platformAccounts: config.platformAccounts ?? {},
  };
}

function findManifestArticle(manifest, candidate) {
  return manifest.articles.find((a) => a.collection_id === candidate.collection_id) ?? null;
}

/** Sort candidates by (article date, social_id), preserving each article's fixed platform order. */
function orderCandidates(candidates, manifest) {
  const dateBySocialId = new Map();
  for (const a of manifest.articles) {
    if (a.social?.id) dateBySocialId.set(a.social.id, a.dateMs ?? 0);
  }
  const withKey = candidates.map((c, index) => ({
    c,
    index,
    dateMs: dateBySocialId.get(c.social_id) ?? 0,
  }));
  withKey.sort(
    (a, b) =>
      a.dateMs - b.dateMs ||
      String(a.c.social_id).localeCompare(String(b.c.social_id)) ||
      a.index - b.index
  );
  return withKey.map((w) => w.c);
}

// --- reconciliation phase ---------------------------------------------

async function reconcilePending({
  state,
  stateStore,
  session,
  githubDeps,
  bufferClient,
  blueskyClient,
  config,
  now,
}) {
  const rows = [];
  let currentState = state;
  const safeBlueskyRetryProposals = [];
  const nowMs = typeof now === 'function' ? now() : Date.now();
  const ambiguityBudgetMs = config.ambiguityBlockAfterMs ?? DEFAULT_AMBIGUITY_BLOCK_AFTER_MS;

  for (const [socialId, article] of Object.entries(currentState.articles ?? {})) {
    for (const [platform, entry] of Object.entries(article.platforms ?? {})) {
      if (entry.status === 'PUBLISHING') {
        let runStatus = null;
        if (githubDeps) {
          try {
            runStatus = await getRunStatus({
              fetchImpl: githubDeps.fetchImpl,
              token: githubDeps.token,
              repository: config.repository,
              runId: entry.owner_run_id,
              attempt: entry.owner_attempt,
              timeoutMs: githubDeps.timeoutMs,
            });
          } catch {
            runStatus = null;
          }
        }
        const liveness = evaluateOwnerLiveness({ entry, runStatus, session });
        if (liveness.liveness !== 'finished') {
          rows.push({ social_id: socialId, platform, result: 'DEFERRED', reason: liveness.reason });
          continue;
        }
        const outcome = await recordReconciliation({
          store: stateStore,
          session,
          socialId,
          platform,
          intentId: entry.intent_id,
          kind: 'recover-abandoned',
          ownerLiveness: 'finished',
          resolution: { actor: 'social-orchestrator', reason: liveness.reason },
          now,
        });
        if (outcome.outcome === 'indeterminate') {
          return { rows, haltAll: true, haltReason: 'RECOVER_ABANDONED_INDETERMINATE' };
        }
        if (outcome.state) currentState = outcome.state;
        rows.push({ social_id: socialId, platform, result: 'RECOVERED_TO_AMBIGUOUS' });
        continue;
      }

      if (
        entry.status === 'ACCEPTED' &&
        BUFFER_PLATFORM_SET.has(platform) &&
        bufferClient &&
        entry.provider_id
      ) {
        const results = await bufferClient.get({ ids: [entry.provider_id] });
        const pub = results[0];
        if (pub && pub.outcome !== buffer.BUFFER_OUTCOME.AMBIGUOUS) {
          const translated = buffer.toRecordResult(pub, { now });
          if (translated.recordResult) {
            const outcome = await recordResult({
              store: stateStore,
              session,
              socialId,
              platform,
              intentId: entry.intent_id,
              result: translated.recordResult,
              now,
            });
            if (outcome.outcome === 'indeterminate') {
              return { rows, haltAll: true, haltReason: 'ACCEPTED_POLL_INDETERMINATE' };
            }
            if (outcome.state) currentState = outcome.state;
          }
          rows.push({ social_id: socialId, platform, result: pub.outcome.toUpperCase() });
        } else {
          rows.push({ social_id: socialId, platform, result: 'STILL_ACCEPTED' });
        }
        continue;
      }

      if (entry.status === 'AMBIGUOUS') {
        const attemptedMs = entry.attempted_at ? Date.parse(entry.attempted_at) : NaN;
        const overBudget = Number.isFinite(attemptedMs) && nowMs - attemptedMs > ambiguityBudgetMs;

        if (BUFFER_PLATFORM_SET.has(platform) && bufferClient) {
          const recon = await bufferClient.reconcile({
            channelId: entry.account_key,
            frozenText: entry.frozen_payload?.text,
            canonicalUrl: entry.frozen_payload?.canonical_url,
          });
          const params = buffer.reconciliationParams(recon);
          if (params.call === 'recordReconciliation') {
            const outcome = await recordReconciliation({
              store: stateStore,
              session,
              socialId,
              platform,
              intentId: entry.intent_id,
              kind: params.kind,
              target: params.target,
              providerId: params.providerId,
              externalUrl: params.externalUrl,
              resolution: params.resolution,
              now,
            });
            if (outcome.outcome === 'indeterminate') {
              return { rows, haltAll: true, haltReason: 'AMBIGUOUS_RECONCILE_INDETERMINATE' };
            }
            if (outcome.state) currentState = outcome.state;
            rows.push({
              social_id: socialId,
              platform,
              result: params.kind === 'block' ? 'BLOCKED' : 'ADOPTED',
            });
            continue;
          }
          if (overBudget) {
            const outcome = await recordReconciliation({
              store: stateStore,
              session,
              socialId,
              platform,
              intentId: entry.intent_id,
              kind: 'block',
              resolution: {
                actor: 'social-orchestrator',
                reason: 'ambiguity budget exhausted without an unambiguous match',
                evidence: recon.evidence ?? null,
              },
              now,
            });
            if (outcome.outcome === 'indeterminate') {
              return { rows, haltAll: true, haltReason: 'AMBIGUITY_BUDGET_BLOCK_INDETERMINATE' };
            }
            if (outcome.state) currentState = outcome.state;
            rows.push({
              social_id: socialId,
              platform,
              result: 'BLOCKED',
              reason: 'ambiguity budget exhausted',
            });
            continue;
          }
          rows.push({ social_id: socialId, platform, result: 'STILL_AMBIGUOUS' });
          continue;
        }

        if (platform === 'bluesky' && blueskyClient) {
          const recon = await blueskyClient.reconcile({
            rkey: entry.rkey,
            frozenRecord: entry.frozen_payload,
          });
          const params = bluesky.reconciliationParams(recon);
          if (params.call === 'recordReconciliation') {
            const outcome = await recordReconciliation({
              store: stateStore,
              session,
              socialId,
              platform,
              intentId: entry.intent_id,
              kind: params.kind,
              target: params.target,
              uri: params.uri,
              cid: params.cid,
              resolution: params.resolution,
              now,
            });
            if (outcome.outcome === 'indeterminate') {
              return { rows, haltAll: true, haltReason: 'AMBIGUOUS_RECONCILE_INDETERMINATE' };
            }
            if (outcome.state) currentState = outcome.state;
            rows.push({
              social_id: socialId,
              platform,
              result: params.kind === 'block' ? 'BLOCKED' : 'ADOPTED',
            });
            continue;
          }
          if (recon.decision === 'retry-safe') {
            safeBlueskyRetryProposals.push({
              social_id: socialId,
              collection_id: article.collection_ids?.[0],
              platform: 'bluesky',
              canonical_url: article.canonical_urls?.[0],
              resume: true,
              deploy_proof: null, // re-validated by the caller against the CURRENT manifest before any send
              _existingEntry: entry,
            });
            rows.push({ social_id: socialId, platform, result: 'RETRY_PROPOSED' });
            continue;
          }
          rows.push({ social_id: socialId, platform, result: 'STILL_AMBIGUOUS' });
          continue;
        }

        rows.push({ social_id: socialId, platform, result: 'STILL_AMBIGUOUS' });
      }
    }
  }

  return { rows, state: currentState, safeBlueskyRetryProposals, haltAll: false };
}

// --- one candidate: build → reserve → send → persist -------------------

async function sendOneCandidate({
  candidate,
  article,
  verified,
  config,
  stateStore,
  session,
  bufferClient,
  blueskyClient,
  now,
  rng,
  fetchManifest,
  originalDigest,
}) {
  const platform = candidate.platform;
  const accountKey = config.platformAccounts?.[platform];
  if (!accountKey) {
    return { row: { social_id: candidate.social_id, platform, result: 'NOT_CONFIGURED' } };
  }

  const articleForContent = {
    title: article.title,
    description: article.description,
    canonical_url: article.canonical_url,
    image_url: verified.verified?.image_url ?? null,
  };

  const isSafeBlueskyRetry = candidate.resume === true && candidate._existingEntry != null;

  let post;
  let payloadInput;
  let resume;

  if (isSafeBlueskyRetry) {
    const entry = candidate._existingEntry;
    post = null;
    payloadInput = {
      frozenPayload: entry.frozen_payload,
      payloadHash: entry.payload_hash,
      generatorVersion: entry.generator_version,
    };
    resume = { safeBlueskyRetry: true };
  } else {
    post = makeSocialPost(articleForContent, { platform, account_key: accountKey });
    payloadInput = {
      frozenPayload: post,
      payloadHash: post.payload_hash,
      generatorVersion: post.generator_version,
    };
    if (platform === 'bluesky') {
      const { thumb } = await blueskyClient
        .resolveThumbnail({ verifiedImage: verified.verified })
        .catch(() => ({ thumb: null }));
      const nowMs = typeof now === 'function' ? now() : Date.now();
      const createdAt = new Date(nowMs).toISOString();
      const clockId = bluesky.mintClockId({ rng });
      // NOTE: TID/micros allocation happens inside sendBlueskyFirstAttempt via
      // recordIntent's own CAS loop (bounded stale-micros retry, never a halt).
      return sendBlueskyFirstAttempt({
        candidate,
        post,
        accountKey,
        stateStore,
        session,
        blueskyClient,
        now,
        rng,
        clockId,
        createdAt,
        thumb,
        fetchManifest,
        originalDigest,
      });
    }
  }

  return sendReservedCandidate({
    candidate,
    accountKey,
    payloadInput,
    resume,
    post,
    platform,
    stateStore,
    session,
    bufferClient,
    blueskyClient,
    fetchManifest,
    originalDigest,
    now,
  });
}

/**
 * First-time Bluesky reservation: allocate the TID, `prepareRecord`, and
 * retry the bounded `stale-micros` loop entirely through `recordIntent`'s own
 * CAS — never a halt (plan §14/§15).
 */
async function sendBlueskyFirstAttempt({
  candidate,
  post,
  accountKey,
  stateStore,
  session,
  blueskyClient,
  now,
  clockId,
  createdAt,
  thumb,
  fetchManifest,
  originalDigest,
}) {
  const article = {
    social_id: candidate.social_id,
    collection_id: candidate.collection_id,
    canonical_url: candidate.canonical_url,
  };
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const { state: freshState } = await loadState({ store: stateStore });
    const nowMs = typeof now === 'function' ? now() : Date.now();
    const micros = allocateBlueskyMicros(freshState, nowMs).micros;
    const prepared = bluesky.prepareRecord({
      post,
      blueskyMicros: micros,
      clockId,
      createdAt,
      thumb,
    });

    const reserved = await recordIntent({
      store: stateStore,
      session,
      article,
      platform: 'bluesky',
      destination: { account_key: accountKey },
      payload: {
        frozenPayload: prepared.record,
        payloadHash: post.payload_hash,
        generatorVersion: post.generator_version,
        rkey: prepared.rkey,
        createdAt: prepared.created_at,
        blueskyMicros: prepared.bluesky_micros,
      },
      now,
    });

    if (reserved.outcome === 'stale-micros') {
      if (attempts >= 5) {
        return {
          row: {
            social_id: candidate.social_id,
            platform: 'bluesky',
            result: 'RESERVATION_CONFLICT',
          },
        };
      }
      continue; // re-mint from the now-current state and try again
    }
    if (reserved.outcome === 'conflict') {
      return {
        row: { social_id: candidate.social_id, platform: 'bluesky', result: 'RESERVED_BY_OTHER' },
      };
    }
    if (reserved.outcome === 'indeterminate') {
      return {
        haltAll: true,
        haltReason: 'RESERVATION_INDETERMINATE',
        row: { social_id: candidate.social_id, platform: 'bluesky', result: 'INDETERMINATE' },
      };
    }
    if (reserved.outcome === 'noop') {
      return {
        row: { social_id: candidate.social_id, platform: 'bluesky', result: 'ALREADY_PUBLISHED' },
      };
    }

    return finishBlueskySend({
      candidate,
      rkey: prepared.rkey,
      record: prepared.record,
      intentId: reserved.intentId,
      stateStore,
      session,
      blueskyClient,
      fetchManifest,
      originalDigest,
      now,
    });
  }
}

async function finishBlueskySend({
  candidate,
  rkey,
  record,
  intentId,
  stateStore,
  session,
  blueskyClient,
  fetchManifest,
  originalDigest,
  now,
}) {
  const unchanged = await manifestUnchanged({ fetchManifest, originalDigest });
  if (!unchanged) {
    await releaseUnsentReservation({
      store: stateStore,
      session,
      socialId: candidate.social_id,
      platform: 'bluesky',
      intentId,
      sendInvoked: false,
    }).catch(() => {});
    return {
      manifestChanged: true,
      row: { social_id: candidate.social_id, platform: 'bluesky', result: 'MANIFEST_CHANGED' },
    };
  }

  const pub = await blueskyClient.putRecord({ rkey, record });
  const translated = bluesky.toRecordResult(pub, { now });
  if (translated.recordResult) {
    const persisted = await recordResult({
      store: stateStore,
      session,
      socialId: candidate.social_id,
      platform: 'bluesky',
      intentId,
      result: translated.recordResult,
      now,
    });
    if (persisted.outcome === 'indeterminate') {
      return {
        haltAll: true,
        haltReason: 'RESULT_PERSIST_INDETERMINATE',
        row: { social_id: candidate.social_id, platform: 'bluesky', result: 'INDETERMINATE' },
      };
    }
  }
  if (translated.halt) {
    return {
      haltAll: true,
      haltReason: translated.halt,
      row: {
        social_id: candidate.social_id,
        platform: 'bluesky',
        result: pub.outcome.toUpperCase(),
      },
    };
  }
  return {
    row: {
      social_id: candidate.social_id,
      platform: 'bluesky',
      result: translated.recordResult?.status ?? pub.outcome.toUpperCase(),
      uri: pub.uri,
    },
  };
}

async function sendReservedCandidate({
  candidate,
  accountKey,
  payloadInput,
  resume,
  post,
  platform,
  stateStore,
  session,
  bufferClient,
  fetchManifest,
  originalDigest,
  now,
}) {
  const article = {
    social_id: candidate.social_id,
    collection_id: candidate.collection_id,
    canonical_url: candidate.canonical_url,
  };

  const reserved = await recordIntent({
    store: stateStore,
    session,
    article,
    platform,
    destination: { account_key: accountKey },
    payload: payloadInput,
    resume,
    now,
  });

  if (reserved.outcome === 'conflict') {
    return { row: { social_id: candidate.social_id, platform, result: 'RESERVED_BY_OTHER' } };
  }
  if (reserved.outcome === 'indeterminate') {
    return {
      haltAll: true,
      haltReason: 'RESERVATION_INDETERMINATE',
      row: { social_id: candidate.social_id, platform, result: 'INDETERMINATE' },
    };
  }
  if (reserved.outcome === 'noop') {
    return { row: { social_id: candidate.social_id, platform, result: 'ALREADY_PUBLISHED' } };
  }

  const intentId = reserved.intentId;
  const unchanged = await manifestUnchanged({ fetchManifest, originalDigest });
  if (!unchanged) {
    await releaseUnsentReservation({
      store: stateStore,
      session,
      socialId: candidate.social_id,
      platform,
      intentId,
      sendInvoked: false,
    }).catch(() => {});
    return {
      manifestChanged: true,
      row: { social_id: candidate.social_id, platform, result: 'MANIFEST_CHANGED' },
    };
  }

  const framedPost = post ?? payloadInput.frozenPayload;
  const pub = await bufferClient.create({ channelId: accountKey, post: framedPost });
  const translated = buffer.toRecordResult(pub, { now });

  if (translated.recordResult) {
    const persisted = await recordResult({
      store: stateStore,
      session,
      socialId: candidate.social_id,
      platform,
      intentId,
      result: translated.recordResult,
      now,
    });
    if (persisted.outcome === 'indeterminate') {
      return {
        haltAll: true,
        haltReason: 'RESULT_PERSIST_INDETERMINATE',
        row: { social_id: candidate.social_id, platform, result: 'INDETERMINATE' },
      };
    }
  }

  const row = {
    social_id: candidate.social_id,
    platform,
    result: translated.recordResult?.status ?? pub.outcome.toUpperCase(),
    provider_id: pub.providerId ?? null,
    intent_id: intentId,
  };

  if (translated.halt === 'channel-misconfigured') {
    return { row, channelHalted: true };
  }
  if (translated.halt) {
    return { haltAll: true, haltReason: translated.halt, row };
  }
  return { row };
}

async function manifestUnchanged({ fetchManifest, originalDigest }) {
  try {
    const raw = await fetchManifest();
    return digestManifestBytes(raw) === originalDigest;
  } catch {
    // Cannot re-verify: conservatively treat as changed (never send blind).
    return false;
  }
}

// --- config / dependency wiring for the CLI -----------------------------

/** Read the closed §18 GitHub Variables + repository context from `process.env`. */
export function loadConfigFromEnv(env = process.env) {
  let enabledPlatforms = [];
  try {
    enabledPlatforms = JSON.parse(env.SOCIAL_PLATFORMS ?? '[]');
    if (!Array.isArray(enabledPlatforms)) enabledPlatforms = [];
  } catch {
    enabledPlatforms = [];
  }
  return {
    publishEnabled: env.SOCIAL_PUBLISH_ENABLED === 'true',
    enabledPlatforms,
    platformAccounts: {
      facebook: env.BUFFER_FACEBOOK_CHANNEL_ID || undefined,
      x: env.BUFFER_X_CHANNEL_ID || undefined,
      linkedin: env.BUFFER_LINKEDIN_CHANNEL_ID || undefined,
      bluesky: env.BLUESKY_DID || undefined,
    },
    bufferOrganizationId: env.BUFFER_ORGANIZATION_ID || undefined,
    repository: env.GITHUB_REPOSITORY,
    defaultBranch: env.GITHUB_DEFAULT_BRANCH || 'main',
    blueskyPdsUrl: env.BLUESKY_PDS_URL || undefined,
    manifestUrl: env.SOCIAL_MANIFEST_URL || 'https://noticiencias.com/social-manifest.json',
  };
}

/**
 * Build real (network-capable) dependencies from environment secrets — never
 * called by any test in this repo, and never invoked against a real account
 * by this task. Kept here so `main()` / `operate.js`'s CLI have one place to
 * assemble them.
 */
export async function createRealDependencies({ requireStateWrite = false } = {}) {
  const env = process.env;
  const config = loadConfigFromEnv(env);
  const session = {
    runId: env.GITHUB_RUN_ID || 'local',
    attempt: Number(env.GITHUB_RUN_ATTEMPT || '1'),
  };
  const fetchImpl = globalThis.fetch;
  const githubDeps = { fetchImpl, token: env.GITHUB_TOKEN };

  let stateStore;
  if (requireStateWrite) {
    const { createContentsStore } = await import('./state.js');
    stateStore = createContentsStore({
      fetchImpl,
      token: env.GITHUB_TOKEN,
      repository: env.GITHUB_REPOSITORY,
    });
  }

  let bufferClient;
  if (env.BUFFER_API_KEY) {
    bufferClient = buffer.createBufferClient({
      fetchImpl,
      apiKey: env.BUFFER_API_KEY,
      organizationId: config.bufferOrganizationId,
    });
  }

  let blueskyClient;
  if (env.BLUESKY_APP_PASSWORD && env.BLUESKY_DID && config.blueskyPdsUrl) {
    blueskyClient = bluesky.createBlueskyClient({
      fetchImpl,
      service: config.blueskyPdsUrl,
      did: env.BLUESKY_DID,
      appPassword: env.BLUESKY_APP_PASSWORD,
    });
  }

  return {
    config,
    session,
    githubDeps,
    stateStore,
    bufferClient,
    blueskyClient,
    fetchManifest: async () => {
      const res = await fetchImpl(config.manifestUrl);
      return res.text();
    },
  };
}

// --- CLI -----------------------------------------------------------------

/** Closed argv parsing: `--execute` (arms a real run: `publish`, or `reconcile` with `--reconcile`), `--dry-run` (default), `--article-id`, `--platform`, `--reconcile`. */
export function parseCliFlags(argv) {
  const flags = { execute: false, mode: 'dry-run', articleId: '', platform: 'all' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--execute') flags.execute = true;
    else if (arg === '--dry-run') flags.mode = 'dry-run';
    else if (arg === '--reconcile') flags.mode = 'reconcile';
    else if (arg === '--article-id') flags.articleId = argv[++i] ?? '';
    else if (arg === '--platform') flags.platform = argv[++i] ?? 'all';
  }
  return flags;
}

/**
 * Derive the run mode from parsed CLI flags. Pure and exported so the
 * safety-critical `--execute` → `publish` mapping is pinned by tests:
 * without `--execute` everything stays `dry-run` (fail closed), even if a
 * mode flag is also present.
 *
 * @param {{ execute?: boolean, mode?: string } | null | undefined} flags
 * @returns {'dry-run'|'publish'|'reconcile'}
 */
export function resolveMode(flags) {
  if (!flags?.execute) return 'dry-run';
  return flags.mode === 'reconcile' ? 'reconcile' : 'publish';
}

export async function main(argv = process.argv.slice(2)) {
  const flags = parseCliFlags(argv);
  const deps = await createRealDependencies({ requireStateWrite: flags.execute });
  // Real execution is trusted only inside the actual GitHub Actions job,
  // which sets the CI flag and drives `--execute` itself.
  const trustedContext = flags.execute && process.env.GITHUB_ACTIONS === 'true';
  const mode = resolveMode(flags);

  const summary = await runDistribution({
    mode,
    trustedContext,
    selectors: { articleId: flags.articleId, platform: flags.platform },
    config: deps.config,
    session: deps.session,
    fetchManifest: deps.fetchManifest,
    githubDeps: deps.githubDeps,
    stateStore: deps.stateStore,
    bufferClient: deps.bufferClient,
    blueskyClient: deps.blueskyClient,
  });

  console.log(JSON.stringify(summary, null, 2));
  return summary.exit_code ?? 0;
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error?.message ?? String(error));
      process.exit(1);
    });
}
