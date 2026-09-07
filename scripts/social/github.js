import { ERROR_CLASS, HttpError, classifyStatus, requestJson } from './http.js';

/**
 * Deploy provenance verification for the social publisher (plan
 * social-distribution §7).
 *
 * The manifest's `provenance` block and the workflow *name* do not, by
 * themselves, authenticate a deploy: `workflow_run` events are privileged
 * even when their antecedent is not, and a stale finished run can wake up
 * after another manifest is already public. So before anything is published
 * we re-check, against the Actions REST API, that the snapshot the domain is
 * currently serving came from a trustworthy run of `.github/workflows/deploy.yml`
 * on the default branch, at the manifest's commit, with the required jobs
 * green — and we bind that decision to the SHA-256 digest of the manifest
 * bytes we actually read.
 *
 * ### The build→deploy→verify chain (plan §7, refined)
 *
 * A green job of the right name at the right SHA is not enough on its own: an
 * identical manifest digest can stay public while a *later* attempt of the
 * same run is mid-flight or has failed, so "the content already answers 200"
 * proves nothing. We reconstruct the chain from three read-only endpoints and
 * require the declared build and the deploy that published it, specifically:
 *
 * - `GET /repos/{o}/{r}/actions/runs/{id}` — the *latest* attempt's view:
 *   its `run_attempt` and `status` tell us whether a newer rerun of this run
 *   is still settling.
 * - `GET …/runs/{id}/attempts/{build_attempt}` — the attempt the manifest
 *   says produced it (`provenance.build_attempt`), for identity + "did that
 *   attempt finish".
 * - `GET …/runs/{id}/jobs?filter=all` — every job of every attempt, each
 *   carrying its own `run_attempt` + `head_sha`
 *   (https://docs.github.com/en/rest/actions/workflow-jobs). Re-running only
 *   the failed `deploy` job creates attempt N+1 while `gate`/`package` keep
 *   their attempt-N records, so this list is the source of truth for which
 *   attempt did what.
 *
 * Trust requires, at the manifest commit:
 * - `package` succeeded **at exactly `build_attempt`** (that attempt is the
 *   one that stamped `GITHUB_RUN_ATTEMPT` into the manifest);
 * - `gate` succeeded at an attempt `<= build_attempt` (it gated that build);
 * - `deploy` succeeded at an attempt `>= build_attempt` (the deploy — which
 *   contains the "Verify Deployment" step — that published this build);
 * - no later attempt of this run is still running, and the newest `deploy`
 *   job for the commit is not still running.
 *
 * A build/verify that cannot be shown this way is `deferred` (still settling)
 * or `blocked` (a required attempt failed / is missing / data is incomplete).
 * A *different* run's later deploy never enters this function — the manifest
 * fetched from the live site carries its own `provenance.run_id`, so an
 * independent newer deploy does not invalidate an older still-public snapshot
 * that has its own valid proof.
 *
 * This module performs read-only API calls and pure verification. It never
 * writes a ledger, never persists a proof to disk, never reads the Variables
 * API, and never executes anything from a run artifact.
 */

export const GITHUB_API_HOST = 'api.github.com';
export const DEPLOY_WORKFLOW_PATH = '.github/workflows/deploy.yml';
export const REQUIRED_DEPLOY_JOBS = Object.freeze(['gate', 'package', 'deploy']);
/**
 * Events a trustworthy production deploy run can originate from. `deploy.yml`
 * triggers on `push` (to a main branch) and `workflow_dispatch`; `dynamic` is
 * what the Actions API reports for some API-initiated re-runs of the same
 * workflow, so it is accepted too. `pull_request` / `pull_request_target` and
 * fork events are the ones this list is here to reject.
 */
const TRUSTED_RUN_EVENTS = Object.freeze(['push', 'workflow_dispatch', 'dynamic']);

const SHA_RE = /^[0-9a-f]{40}$/;
const DIGEST_RE = /^[0-9a-f]{64}$/;
const DECIMAL_RE = /^[0-9]+$/;
const REPO_RE = /^[^/\s]+\/[^/\s]+$/;

const API_HEADERS = Object.freeze({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'noticiencias-social-distribution',
});

/**
 * @typedef {object} RunFacts observed workflow-run attempt fields.
 * @property {string|null} id
 * @property {number|null} run_attempt
 * @property {string|null} status
 * @property {string|null} conclusion
 * @property {string|null} head_sha lowercased
 * @property {string|null} head_branch
 * @property {string|null} path workflow file path
 * @property {string|null} event
 * @property {string|null} repository_full_name
 * @property {string|null} head_repository_full_name
 * @property {string|null} previous_attempt_url
 */

/**
 * @typedef {object} JobFacts
 * @property {string|null} name
 * @property {string|null} status
 * @property {string|null} conclusion
 * @property {number|null} run_attempt
 * @property {string|null} head_sha lowercased
 */

/**
 * @typedef {object} RunStatus
 * @property {boolean} found `false` when `GET /runs/{id}` returned 404 — the
 *   whole run is purged.
 * @property {RunFacts|null} run the `attempts/{build_attempt}` view; `null`
 *   when that specific attempt's data is gone (old logs deleted) even though
 *   the run still exists.
 * @property {RunFacts|null} latestRun the `GET /runs/{id}` view — the newest
 *   attempt's number and status, used to detect a rerun that is still
 *   settling.
 * @property {JobFacts[]} jobs every job of every attempt (`filter=all`).
 * @property {boolean} jobsComplete `false` when the job list could not be
 *   fully paginated — the chain then cannot be proven.
 */

/**
 * @typedef {object} DeployProof
 * @property {string} repository
 * @property {string} commit
 * @property {string} run_id
 * @property {number} build_attempt the manifest's originating attempt (kept
 *   as-is; not forced to the latest attempt).
 * @property {string} workflow_path
 * @property {string} manifest_digest binds the proof to one manifest snapshot.
 * @property {number|null} [verified_run_attempt]
 * @property {string} [verified_at]
 * @property {'live'|'stored'} [source]
 */

function apiRequestOptions(fetchImpl, token, timeoutMs) {
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
    maxBytes: 4 * 1024 * 1024,
    timeoutMs: timeoutMs ?? 15_000,
    secrets,
  };
}

function throwForStatus(host, status, headers) {
  const errorClass = classifyStatus(status, headers);
  throw new HttpError(errorClass, `${host} answered HTTP ${status}`, { status });
}

/**
 * Read the workflow run's latest-attempt view, the declared build attempt's
 * view, and the full job list (all attempts). Read-only. Returns facts; makes
 * no trust decision.
 *
 * @param {{
 *   fetchImpl: import('./http.js').FetchLike,
 *   token?: string,
 *   repository: string,
 *   runId: string | number,
 *   attempt: number,
 *   timeoutMs?: number,
 *   maxJobPages?: number,
 * }} params
 * @returns {Promise<RunStatus>}
 */
export async function getRunStatus(params) {
  const { fetchImpl, token, repository, runId, attempt, timeoutMs, maxJobPages = 10 } = params;
  if (!REPO_RE.test(String(repository))) {
    throw new HttpError(ERROR_CLASS.CLIENT_ERROR, 'repository must be "owner/repo"');
  }
  const opts = apiRequestOptions(fetchImpl, token, timeoutMs);
  const base = `https://${GITHUB_API_HOST}/repos/${repository}/actions/runs/${encodeURIComponent(
    String(runId)
  )}`;

  // 1) Latest-attempt view: newest attempt number + whether it is still going.
  const { result: runResult, json: runJson } = await requestJson(base, opts);
  if (runResult.status === 404) {
    return { found: false, run: null, latestRun: null, jobs: [], jobsComplete: true };
  }
  if (classifyStatus(runResult.status, runResult.headers) !== ERROR_CLASS.OK) {
    throwForStatus(GITHUB_API_HOST, runResult.status, runResult.headers);
  }
  const latestRun = normalizeRun(runJson);

  // 2) The specific attempt the manifest says produced it. A 404 here means
  //    that attempt's data is gone (old logs deleted) though the run remains;
  //    the caller then falls back to a previously stored proof.
  const attemptUrl = `${base}/attempts/${encodeURIComponent(String(attempt))}`;
  const { result: attemptResult, json: attemptJson } = await requestJson(attemptUrl, opts);
  let run = null;
  if (attemptResult.status !== 404) {
    if (classifyStatus(attemptResult.status, attemptResult.headers) !== ERROR_CLASS.OK) {
      throwForStatus(GITHUB_API_HOST, attemptResult.status, attemptResult.headers);
    }
    run = normalizeRun(attemptJson);
  }

  // 3) Jobs across all attempts of the run; each job carries its own
  //    run_attempt and head_sha.
  const jobs = [];
  let jobsComplete = true;
  let totalCount = null;
  for (let page = 1; page <= maxJobPages; page += 1) {
    const jobsUrl = `${base}/jobs?filter=all&per_page=100&page=${page}`;
    const { result: jobsResult, json: jobsJson } = await requestJson(jobsUrl, opts);
    if (jobsResult.status === 404) {
      return { found: false, run: null, latestRun: null, jobs: [], jobsComplete: true };
    }
    if (classifyStatus(jobsResult.status, jobsResult.headers) !== ERROR_CLASS.OK) {
      throwForStatus(GITHUB_API_HOST, jobsResult.status, jobsResult.headers);
    }
    const pageJobs = Array.isArray(jobsJson && jobsJson.jobs) ? jobsJson.jobs : [];
    totalCount = Number(jobsJson && jobsJson.total_count);
    for (const job of pageJobs) jobs.push(normalizeJob(job));
    if (pageJobs.length < 100) break;
    if (Number.isFinite(totalCount) && jobs.length >= totalCount) break;
    if (page === maxJobPages) jobsComplete = false;
  }
  if (Number.isFinite(totalCount) && jobs.length < totalCount) jobsComplete = false;

  return { found: true, run, latestRun, jobs, jobsComplete };
}

function normalizeRun(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    id: r.id != null ? String(r.id) : null,
    run_attempt: Number.isFinite(Number(r.run_attempt)) ? Number(r.run_attempt) : null,
    status: r.status ?? null,
    conclusion: r.conclusion ?? null,
    head_sha: typeof r.head_sha === 'string' ? r.head_sha.toLowerCase() : null,
    head_branch: r.head_branch ?? null,
    path: r.path ?? null,
    event: r.event ?? null,
    repository_full_name:
      r.repository && typeof r.repository === 'object' ? (r.repository.full_name ?? null) : null,
    head_repository_full_name:
      r.head_repository && typeof r.head_repository === 'object'
        ? (r.head_repository.full_name ?? null)
        : null,
    previous_attempt_url: r.previous_attempt_url ?? null,
  };
}

function normalizeJob(raw) {
  const j = raw && typeof raw === 'object' ? raw : {};
  return {
    name: j.name ?? null,
    status: j.status ?? null,
    conclusion: j.conclusion ?? null,
    run_attempt: Number.isFinite(Number(j.run_attempt)) ? Number(j.run_attempt) : null,
    head_sha: typeof j.head_sha === 'string' ? j.head_sha.toLowerCase() : null,
  };
}

function isMalformedProvenance(p) {
  if (!p || typeof p !== 'object') return true;
  if (!REPO_RE.test(String(p.repository ?? ''))) return true;
  if (!SHA_RE.test(String(p.commit ?? ''))) return true;
  if (!DECIMAL_RE.test(String(p.run_id ?? ''))) return true;
  const attempt = Number(p.build_attempt);
  if (!Number.isInteger(attempt) || attempt < 1) return true;
  return false;
}

function findStoredProof(provenDeploys, provenance, manifestDigest) {
  const list = Array.isArray(provenDeploys)
    ? provenDeploys
    : provenDeploys && typeof provenDeploys === 'object'
      ? Object.values(provenDeploys)
      : [];
  return (
    list.find(
      (p) =>
        p &&
        String(p.repository) === String(provenance.repository) &&
        String(p.commit).toLowerCase() === String(provenance.commit).toLowerCase() &&
        String(p.run_id) === String(provenance.run_id) &&
        Number(p.build_attempt) === Number(provenance.build_attempt) &&
        // A proof of a different manifest digest does NOT authorise this
        // snapshot (plan §8/§190).
        String(p.manifest_digest) === String(manifestDigest)
    ) || null
  );
}

function blocked(reasons) {
  return { trust: 'blocked', reasons, proof: null };
}
function deferred(reasons) {
  return { trust: 'deferred', reasons, proof: null };
}

/**
 * Decide whether the current public manifest snapshot may be distributed.
 *
 * @param {{
 *   provenance: import('../../src/pages/social-manifest.json').SocialManifestProvenance | null,
 *   manifestDigest: string,
 *   runStatus: RunStatus,
 *   expected: { repository: string, defaultBranch: string, workflowPath?: string },
 *   provenDeploys?: DeployProof[] | Record<string, DeployProof>,
 *   requiredJobs?: string[],
 *   now?: () => number,
 * }} params
 * @returns {{ trust: 'verified'|'deferred'|'blocked', reasons: string[], proof: DeployProof | null }}
 */
export function verifyDeployProof(params) {
  const {
    provenance,
    manifestDigest,
    runStatus,
    expected,
    provenDeploys = [],
    requiredJobs = REQUIRED_DEPLOY_JOBS,
    now = () => Date.now(),
  } = params;

  const workflowPath = expected?.workflowPath ?? DEPLOY_WORKFLOW_PATH;

  if (!expected || !REPO_RE.test(String(expected.repository ?? '')) || !expected.defaultBranch) {
    return blocked(['expected repository / default branch was not supplied']);
  }
  if (!DIGEST_RE.test(String(manifestDigest ?? ''))) {
    return blocked(['manifest digest is missing or not a SHA-256 hex string']);
  }
  if (!provenance) {
    return blocked([
      'manifest has no provenance; only builds from the deploy workflow can be distributed',
    ]);
  }
  if (isMalformedProvenance(provenance)) {
    return blocked(['manifest provenance block is malformed']);
  }
  if (String(provenance.repository) !== String(expected.repository)) {
    return blocked([
      `provenance repository "${provenance.repository}" is not the expected "${expected.repository}"`,
    ]);
  }

  const storedProof = findStoredProof(provenDeploys, provenance, manifestDigest);

  // No live evidence for the declared build attempt: the whole run is purged
  // (`found === false`), or that attempt's data is gone though the run remains
  // (`run == null`), or the latest-attempt view is missing. Old logs are
  // deleted over time (plan §167), so fall back to a proof verified earlier
  // and bound to this exact digest.
  const liveEvidenceUnavailable =
    !runStatus || runStatus.found === false || !runStatus.run || !runStatus.latestRun;
  if (liveEvidenceUnavailable) {
    if (storedProof) {
      return {
        trust: 'verified',
        reasons: ['run evidence is unavailable; using a previously verified proof for this digest'],
        proof: { ...normalizeStoredProof(storedProof, workflowPath), source: 'stored' },
      };
    }
    return blocked([
      `run ${provenance.run_id} / attempt ${provenance.build_attempt} evidence is unavailable and no previously verified proof is on file`,
    ]);
  }

  const run = runStatus.run;
  const latestRun = runStatus.latestRun;
  const buildAttempt = Number(provenance.build_attempt);

  const reasons = [];
  if (String(run.id) !== String(provenance.run_id)) {
    reasons.push(`run id ${run.id} does not match provenance run_id ${provenance.run_id}`);
  }
  if (run.path !== workflowPath) {
    reasons.push(
      `run workflow path "${run.path}" is not "${workflowPath}" (name alone is not proof)`
    );
  }
  if (run.head_branch !== expected.defaultBranch) {
    reasons.push(
      `run branch "${run.head_branch}" is not the default branch "${expected.defaultBranch}"`
    );
  }
  if (String(run.head_sha).toLowerCase() !== String(provenance.commit).toLowerCase()) {
    reasons.push(
      `run head_sha "${run.head_sha}" does not match manifest commit "${provenance.commit}"`
    );
  }
  if (run.repository_full_name && run.repository_full_name !== expected.repository) {
    reasons.push(`run repository "${run.repository_full_name}" is not "${expected.repository}"`);
  }
  if (run.head_repository_full_name && run.head_repository_full_name !== expected.repository) {
    reasons.push(
      `run head_repository "${run.head_repository_full_name}" is a fork, not "${expected.repository}"`
    );
  }
  if (run.event && !TRUSTED_RUN_EVENTS.includes(run.event)) {
    reasons.push(`run event "${run.event}" is not a trusted production trigger`);
  }
  // The manifest cannot have been produced by an attempt that does not exist.
  if (latestRun.run_attempt == null) {
    return blocked(["could not determine the run's latest attempt"]);
  }
  if (buildAttempt > latestRun.run_attempt) {
    return blocked([
      `manifest build_attempt ${buildAttempt} exceeds the run's latest attempt ${latestRun.run_attempt}`,
    ]);
  }
  if (reasons.length > 0) return blocked(reasons);

  // The declared build attempt must itself have finished. (Its `conclusion` is
  // deliberately NOT required to be "success": a "re-run failed jobs" leaves
  // attempt N concluded "failure" while deploy@N+1 succeeds — that is the
  // legitimate case §7 protects.)
  if (run.status && run.status !== 'completed') {
    return deferred([`the manifest's build attempt ${buildAttempt} is still "${run.status}"`]);
  }

  // A later attempt of THIS run that has not settled: the chain that keeps the
  // current content public may be about to change. "Answers 200" is not proof
  // the rerun finished.
  if (latestRun.run_attempt > buildAttempt && latestRun.status !== 'completed') {
    return deferred([
      `a later attempt (${latestRun.run_attempt}) of run ${provenance.run_id} is "${
        latestRun.status ?? 'unknown'
      }"; deferring until it settles`,
    ]);
  }

  if (!runStatus.jobsComplete) {
    return blocked([
      'could not enumerate every job for the run; the deploy chain cannot be proven',
    ]);
  }

  const commit = String(provenance.commit).toLowerCase();

  // Reconstruct build → deploy → verify from the job list, pinning each link
  // to the right attempt relative to the declared build_attempt.
  const attemptRule = {
    // `package` stamped GITHUB_RUN_ATTEMPT into the manifest: it must have
    // succeeded at *exactly* the declared attempt.
    package: (a) => a === buildAttempt,
    // `gate` gated that build: same attempt or an earlier one it was carried
    // from.
    gate: (a) => a <= buildAttempt,
    // `deploy` (which contains "Verify Deployment") published it: at the build
    // attempt or a later deploy-only rerun.
    deploy: (a) => a >= buildAttempt,
  };

  for (const jobName of requiredJobs) {
    const rule = attemptRule[jobName] ?? ((a) => a === buildAttempt);
    const state = evaluateChainJob(runStatus.jobs, jobName, commit, rule);
    if (state === 'success') continue;
    if (state === 'running') {
      return deferred([`required job "${jobName}" for the build/deploy chain has not settled`]);
    }
    if (state === 'failed') {
      return blocked([
        `required job "${jobName}" did not succeed for commit ${commit} at the required attempt`,
      ]);
    }
    return blocked([
      `required job "${jobName}" was not found for commit ${commit} at the required attempt (build_attempt ${buildAttempt})`,
    ]);
  }

  return {
    trust: 'verified',
    reasons: [],
    proof: {
      repository: String(provenance.repository),
      commit,
      run_id: String(provenance.run_id),
      build_attempt: buildAttempt,
      workflow_path: workflowPath,
      manifest_digest: String(manifestDigest),
      verified_run_attempt: latestRun.run_attempt ?? run.run_attempt ?? null,
      verified_at: new Date(now()).toISOString(),
      source: 'live',
    },
  };
}

/**
 * Collapse every job of a given name at the manifest commit whose attempt
 * satisfies `attemptOk` into a single chain state. A job with no usable
 * `run_attempt` or `head_sha` cannot be placed and is ignored — the Actions
 * API always populates both, and "can't place it" must never read as success.
 *
 * @param {JobFacts[]} jobs
 * @param {string} name
 * @param {string} commit lowercased
 * @param {(attempt: number) => boolean} attemptOk
 * @returns {'success'|'running'|'failed'|'missing'}
 */
function evaluateChainJob(jobs, name, commit, attemptOk) {
  const matching = (Array.isArray(jobs) ? jobs : []).filter(
    (j) =>
      j.name === name &&
      j.head_sha === commit &&
      j.run_attempt != null &&
      attemptOk(Number(j.run_attempt))
  );
  // "Still running" is checked before "some attempt succeeded": if the newest
  // relevant run of this job has not settled, the chain has not settled —
  // even when an earlier attempt of it is green. This keeps the function
  // fail-safe on its own rather than relying on the run-level guard above
  // having fired first.
  if (matching.some((j) => !j.status || j.status !== 'completed')) return 'running';
  if (matching.some((j) => j.conclusion === 'success')) return 'success';
  if (matching.some((j) => j.conclusion && j.conclusion !== 'success')) return 'failed';
  return 'missing';
}

function normalizeStoredProof(p, workflowPath) {
  return {
    repository: String(p.repository),
    commit: String(p.commit).toLowerCase(),
    run_id: String(p.run_id),
    build_attempt: Number(p.build_attempt),
    workflow_path: p.workflow_path ?? workflowPath,
    manifest_digest: String(p.manifest_digest),
    verified_run_attempt: p.verified_run_attempt ?? null,
    verified_at: p.verified_at ?? null,
  };
}
