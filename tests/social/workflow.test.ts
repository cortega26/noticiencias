import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../scripts/social/http.js';
import {
  DEPLOY_WORKFLOW_PATH,
  getRunStatus,
  verifyDeployProof,
} from '../../scripts/social/github.js';

/**
 * Plan social-distribution §7: GitHub deploy-trust functions.
 *
 * Scope note: this file covers only `getRunStatus` / `verifyDeployProof`.
 * The `.github/workflows/social-distribution.yml` YAML assertions from §20
 * (trigger literal, branch/repo/success guard, no PR triggers, concurrency,
 * per-job scopes, dry-run default) are deferred with the workflow file
 * itself — package 3 does not create it.
 */

const REPO = 'cortega26/noticiencias';
const SHA = 'a'.repeat(40);
const DIGEST = 'd'.repeat(64);

const provenance = () => ({
  repository: REPO,
  commit: SHA,
  run_id: '123',
  build_attempt: 1,
  workflow: 'Deploy to GitHub Pages',
});

const job = (name: string, over: Record<string, unknown> = {}) => ({
  name,
  status: 'completed',
  conclusion: 'success',
  run_attempt: 1,
  head_sha: SHA,
  ...over,
});

type RunStatus = import('../../scripts/social/github.js').RunStatus;

const runFacts = () => ({
  id: '123',
  run_attempt: 1,
  status: 'completed',
  conclusion: 'success',
  head_sha: SHA,
  head_branch: 'main',
  path: DEPLOY_WORKFLOW_PATH,
  event: 'push',
  repository_full_name: REPO,
  head_repository_full_name: REPO,
  previous_attempt_url: null,
});

const runStatus = (over: Record<string, unknown> = {}): RunStatus => {
  const { run: runOver, latestRun: latestOver, jobs: jobsOver, ...rest } = over;
  return {
    found: true,
    jobsComplete: true,
    // `run` = the declared build attempt's view; `latestRun` = the newest
    // attempt's view. Both default to a clean single attempt 1.
    run: { ...runFacts(), ...((runOver as object) ?? {}) },
    latestRun: { ...runFacts(), ...((latestOver as object) ?? {}) },
    jobs: (jobsOver as RunStatus['jobs']) ?? [job('gate'), job('package'), job('deploy')],
    ...rest,
  } as RunStatus;
};

const expected = { repository: REPO, defaultBranch: 'main' };
const now = () => Date.parse('2026-09-06T12:00:00Z');

describe('verifyDeployProof', () => {
  it('verifies a clean deploy and binds the proof to the manifest digest', () => {
    const out = verifyDeployProof({
      provenance: provenance(),
      manifestDigest: DIGEST,
      runStatus: runStatus(),
      expected,
      now,
    });
    expect(out.trust).toBe('verified');
    expect(out.proof).toMatchObject({
      commit: SHA,
      run_id: '123',
      build_attempt: 1,
      workflow_path: DEPLOY_WORKFLOW_PATH,
      manifest_digest: DIGEST,
      source: 'live',
    });
  });

  it('accepts a deploy-only rerun: attempt 1 concluded failure, deploy@2 succeeded, build_attempt stays 1', () => {
    const out = verifyDeployProof({
      provenance: provenance(), // build_attempt stays 1
      manifestDigest: DIGEST,
      runStatus: runStatus({
        run: { run_attempt: 1, conclusion: 'failure' }, // attempt 1 overall failed
        latestRun: { run_attempt: 2, status: 'completed', conclusion: 'success' },
        jobs: [
          job('gate', { run_attempt: 1 }),
          job('package', { run_attempt: 1 }),
          job('deploy', { run_attempt: 1, conclusion: 'failure' }),
          job('deploy', { run_attempt: 2, conclusion: 'success' }),
        ],
      }),
      expected,
      now,
    });
    expect(out.trust).toBe('verified');
    expect(out.proof?.build_attempt).toBe(1);
  });

  it('defers while a later attempt of the same run is still in progress', () => {
    const out = verifyDeployProof({
      provenance: provenance(), // build_attempt 1, digest unchanged
      manifestDigest: DIGEST,
      runStatus: runStatus({
        latestRun: { run_attempt: 2, status: 'in_progress', conclusion: null },
      }),
      expected,
      now,
    });
    expect(out.trust).toBe('deferred');
  });

  it('defers when the newest deploy job has not settled, even if an earlier attempt is green', () => {
    // API state where the run reads "completed" but a deploy job still shows
    // in_progress: the chain has not settled — do not verify off deploy@1.
    const out = verifyDeployProof({
      provenance: provenance(),
      manifestDigest: DIGEST,
      runStatus: runStatus({
        latestRun: { run_attempt: 2, status: 'completed', conclusion: 'success' },
        jobs: [
          job('gate', { run_attempt: 1 }),
          job('package', { run_attempt: 1 }),
          job('deploy', { run_attempt: 1, conclusion: 'success' }),
          job('deploy', { run_attempt: 2, status: 'in_progress', conclusion: null }),
        ],
      }),
      expected,
      now,
    });
    expect(out.trust).toBe('deferred');
  });

  it('does not approve off historical successes when the relevant deploy failed', () => {
    // gate@1 + package@1 green, but every deploy at the commit failed.
    const out = verifyDeployProof({
      provenance: provenance(),
      manifestDigest: DIGEST,
      runStatus: runStatus({
        run: { run_attempt: 1, conclusion: 'failure' },
        latestRun: { run_attempt: 2, status: 'completed', conclusion: 'failure' },
        jobs: [
          job('gate', { run_attempt: 1 }),
          job('package', { run_attempt: 1 }),
          job('deploy', { run_attempt: 1, conclusion: 'failure' }),
          job('deploy', { run_attempt: 2, conclusion: 'failure' }),
        ],
      }),
      expected,
      now,
    });
    expect(out.trust).toBe('blocked');
  });

  it('blocks when package succeeded only at an attempt other than the declared build_attempt', () => {
    // Manifest claims build_attempt 2, but package only ran at attempt 1.
    const out = verifyDeployProof({
      provenance: { ...provenance(), build_attempt: 2 },
      manifestDigest: DIGEST,
      runStatus: runStatus({
        run: { run_attempt: 2 },
        latestRun: { run_attempt: 2 },
        jobs: [
          job('gate', { run_attempt: 1 }),
          job('package', { run_attempt: 1 }),
          job('deploy', { run_attempt: 2 }),
        ],
      }),
      expected,
      now,
    });
    expect(out.trust).toBe('blocked');
    expect(out.reasons.join(' ')).toMatch(/package.*was not found/);
  });

  it('blocks a missing / malformed provenance', () => {
    expect(
      verifyDeployProof({
        provenance: null,
        manifestDigest: DIGEST,
        runStatus: runStatus(),
        expected,
      }).trust
    ).toBe('blocked');
    expect(
      verifyDeployProof({
        provenance: { ...provenance(), commit: 'nothex' },
        manifestDigest: DIGEST,
        runStatus: runStatus(),
        expected,
      }).trust
    ).toBe('blocked');
  });

  it('blocks a missing manifest digest', () => {
    expect(
      verifyDeployProof({
        provenance: provenance(),
        manifestDigest: '',
        runStatus: runStatus(),
        expected,
      }).trust
    ).toBe('blocked');
  });

  it('blocks the wrong repository, branch, workflow path or SHA', () => {
    expect(
      verifyDeployProof({
        provenance: { ...provenance(), repository: 'attacker/noticiencias' },
        manifestDigest: DIGEST,
        runStatus: runStatus(),
        expected,
      }).trust
    ).toBe('blocked');
    expect(
      verifyDeployProof({
        provenance: provenance(),
        manifestDigest: DIGEST,
        runStatus: runStatus({ run: { head_branch: 'feature/x' } }),
        expected,
      }).trust
    ).toBe('blocked');
    expect(
      verifyDeployProof({
        provenance: provenance(),
        manifestDigest: DIGEST,
        runStatus: runStatus({ run: { path: '.github/workflows/attacker.yml' } }),
        expected,
      }).trust
    ).toBe('blocked');
    expect(
      verifyDeployProof({
        provenance: provenance(),
        manifestDigest: DIGEST,
        runStatus: runStatus({ run: { head_sha: 'b'.repeat(40) } }),
        expected,
      }).trust
    ).toBe('blocked');
  });

  it('blocks a forked head_repository and an untrusted event', () => {
    expect(
      verifyDeployProof({
        provenance: provenance(),
        manifestDigest: DIGEST,
        runStatus: runStatus({ run: { head_repository_full_name: 'attacker/noticiencias' } }),
        expected,
      }).trust
    ).toBe('blocked');
    expect(
      verifyDeployProof({
        provenance: provenance(),
        manifestDigest: DIGEST,
        runStatus: runStatus({ run: { event: 'pull_request' } }),
        expected,
      }).trust
    ).toBe('blocked');
  });

  it('defers while the deploy is still in progress', () => {
    expect(
      verifyDeployProof({
        provenance: provenance(),
        manifestDigest: DIGEST,
        runStatus: runStatus({ run: { status: 'in_progress', conclusion: null } }),
        expected,
      }).trust
    ).toBe('deferred');
    expect(
      verifyDeployProof({
        provenance: provenance(),
        manifestDigest: DIGEST,
        runStatus: runStatus({
          jobs: [
            job('gate'),
            job('package'),
            job('deploy', { status: 'in_progress', conclusion: null }),
          ],
        }),
        expected,
      }).trust
    ).toBe('deferred');
  });

  it('blocks a failed required job', () => {
    expect(
      verifyDeployProof({
        provenance: provenance(),
        manifestDigest: DIGEST,
        runStatus: runStatus({
          jobs: [job('gate'), job('package'), job('deploy', { conclusion: 'failure' })],
        }),
        expected,
      }).trust
    ).toBe('blocked');
  });

  it('blocks when the job list could not be fully enumerated', () => {
    expect(
      verifyDeployProof({
        provenance: provenance(),
        manifestDigest: DIGEST,
        runStatus: runStatus({ jobsComplete: false }),
        expected,
      }).trust
    ).toBe('blocked');
  });

  it("blocks a build_attempt greater than the run's latest attempt", () => {
    expect(
      verifyDeployProof({
        provenance: { ...provenance(), build_attempt: 5 },
        manifestDigest: DIGEST,
        runStatus: runStatus({ latestRun: { run_attempt: 2 } }),
        expected,
      }).trust
    ).toBe('blocked');
  });

  describe('run deleted (logs purged)', () => {
    const storedProof = {
      repository: REPO,
      commit: SHA,
      run_id: '123',
      build_attempt: 1,
      workflow_path: DEPLOY_WORKFLOW_PATH,
      manifest_digest: DIGEST,
      verified_at: '2026-09-01T00:00:00Z',
    };

    it('uses a previously verified proof for the same digest', () => {
      const out = verifyDeployProof({
        provenance: provenance(),
        manifestDigest: DIGEST,
        runStatus: { found: false, run: null, latestRun: null, jobs: [], jobsComplete: true },
        expected,
        provenDeploys: [storedProof],
      });
      expect(out.trust).toBe('verified');
      expect(out.proof?.source).toBe('stored');
    });

    it('does not accept a stored proof bound to a different digest', () => {
      const out = verifyDeployProof({
        provenance: provenance(),
        manifestDigest: DIGEST,
        runStatus: { found: false, run: null, latestRun: null, jobs: [], jobsComplete: true },
        expected,
        provenDeploys: [{ ...storedProof, manifest_digest: 'e'.repeat(64) }],
      });
      expect(out.trust).toBe('blocked');
    });

    it('blocks when there is no stored proof at all', () => {
      const out = verifyDeployProof({
        provenance: provenance(),
        manifestDigest: DIGEST,
        runStatus: { found: false, run: null, latestRun: null, jobs: [], jobsComplete: true },
        expected,
      });
      expect(out.trust).toBe('blocked');
    });
  });
});

// --- fake Actions REST API -------------------------------------------------
type ApiResp = { status: number; body: unknown };

const runBody = (over: Record<string, unknown> = {}) => ({
  id: 123,
  run_attempt: 1,
  status: 'completed',
  conclusion: 'success',
  head_sha: SHA,
  head_branch: 'main',
  path: DEPLOY_WORKFLOW_PATH,
  event: 'push',
  repository: { full_name: REPO },
  head_repository: { full_name: REPO },
  ...over,
});
const jobsBody = (jobs: unknown[], total = jobs.length) => ({ total_count: total, jobs });
const apiJob = (name: string, over: Record<string, unknown> = {}) => ({
  name,
  status: 'completed',
  conclusion: 'success',
  run_attempt: 1,
  head_sha: SHA,
  ...over,
});

/**
 * Routes by URL shape: bare `…/runs/{id}` → `run`; `…/attempts/{n}` →
 * `attempt`; `…/jobs…` → successive entries of `jobs` (one per page).
 */
function actionsApi(opts: { run?: ApiResp; attempt?: ApiResp; jobs?: ApiResp | ApiResp[] }) {
  const jobPages: ApiResp[] = Array.isArray(opts.jobs)
    ? [...opts.jobs]
    : opts.jobs
      ? [opts.jobs]
      : [];
  const notFound: ApiResp = { status: 404, body: { message: 'Not Found' } };
  return vi.fn(async (url: string) => {
    const pick = url.includes('/jobs')
      ? (jobPages.shift() ?? { status: 200, body: jobsBody([]) })
      : url.includes('/attempts/')
        ? (opts.attempt ?? notFound)
        : (opts.run ?? notFound);
    return new Response(JSON.stringify(pick.body), { status: pick.status });
  });
}

describe('getRunStatus', () => {
  it('returns the declared-attempt view, the latest view and the job list', async () => {
    const fetchImpl = actionsApi({
      run: { status: 200, body: runBody({ run_attempt: 2, head_sha: SHA.toUpperCase() }) },
      attempt: { status: 200, body: runBody({ run_attempt: 1, head_sha: SHA.toUpperCase() }) },
      jobs: { status: 200, body: jobsBody([apiJob('gate'), apiJob('deploy')], 2) },
    });

    const out = await getRunStatus({ fetchImpl, repository: REPO, runId: '123', attempt: 1 });
    expect(out.found).toBe(true);
    expect(out.run?.run_attempt).toBe(1);
    expect(out.run?.head_sha).toBe(SHA); // lowercased
    expect(out.latestRun?.run_attempt).toBe(2);
    expect(out.jobs).toHaveLength(2);
    expect(out.jobsComplete).toBe(true);
  });

  it('reports run=null (attempt data gone) while the run itself still exists', async () => {
    const fetchImpl = actionsApi({
      run: { status: 200, body: runBody() },
      attempt: { status: 404, body: { message: 'Not Found' } },
      jobs: { status: 200, body: jobsBody([]) },
    });
    const out = await getRunStatus({ fetchImpl, repository: REPO, runId: '123', attempt: 1 });
    expect(out.found).toBe(true);
    expect(out.run).toBeNull();
    expect(out.latestRun).not.toBeNull();
  });

  it('reports found=false when the whole run is 404', async () => {
    const fetchImpl = actionsApi({ run: { status: 404, body: { message: 'Not Found' } } });
    const out = await getRunStatus({ fetchImpl, repository: REPO, runId: '123', attempt: 1 });
    expect(out.found).toBe(false);
  });

  it('throws a classified HttpError on 401', async () => {
    const fetchImpl = actionsApi({ run: { status: 401, body: { message: 'Bad credentials' } } });
    await expect(
      getRunStatus({
        fetchImpl,
        repository: REPO,
        runId: '123',
        attempt: 1,
        token: 'ghp_' + 'x'.repeat(36),
      })
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('flags an incompletely paginated job list', async () => {
    const fetchImpl = actionsApi({
      run: { status: 200, body: runBody() },
      attempt: { status: 200, body: runBody() },
      jobs: {
        status: 200,
        body: jobsBody(
          Array.from({ length: 100 }, (_, i) => apiJob(`j${i}`)),
          500
        ),
      },
    });
    const out = await getRunStatus({
      fetchImpl,
      repository: REPO,
      runId: '123',
      attempt: 1,
      maxJobPages: 1,
    });
    expect(out.jobsComplete).toBe(false);
  });
});

// ===========================================================================
// Integration: real getRunStatus output piped into verifyDeployProof.
// The plan (§7 / §20 §677) requires the trust decision to be exercised end to
// end against Actions-API-shaped payloads, not only hand-built RunStatus
// objects. F2: the build→deploy→verify chain must be demonstrated, not
// inferred from same-SHA successes.
// ===========================================================================
describe('getRunStatus → verifyDeployProof (integration)', () => {
  const DIG = 'a1b2c3'.padEnd(64, '0');

  const verify = (
    runStatus: import('../../scripts/social/github.js').RunStatus,
    over: Record<string, unknown> = {}
  ) =>
    verifyDeployProof({
      provenance: provenance(),
      manifestDigest: DIG,
      runStatus,
      expected,
      now,
      ...over,
    });

  it('build@1 ok, deploy@1 failed, deploy@2 ok, build_attempt=1 → verified', async () => {
    // Attempt 1 concluded "failure" (deploy@1 failed); "re-run failed jobs"
    // made attempt 2 where only deploy re-ran and succeeded. Legitimate — and
    // it verifies because the deploy JOB is checked, not run.conclusion.
    const fetchImpl = actionsApi({
      run: {
        status: 200,
        body: runBody({ run_attempt: 2, status: 'completed', conclusion: 'success' }),
      },
      attempt: { status: 200, body: runBody({ run_attempt: 1, conclusion: 'failure' }) },
      jobs: {
        status: 200,
        body: jobsBody([
          apiJob('gate', { run_attempt: 1 }),
          apiJob('package', { run_attempt: 1 }),
          apiJob('deploy', { run_attempt: 1, conclusion: 'failure' }),
          apiJob('deploy', { run_attempt: 2, conclusion: 'success' }),
        ]),
      },
    });
    const runStatus = await getRunStatus({ fetchImpl, repository: REPO, runId: '123', attempt: 1 });
    const out = verify(runStatus);
    expect(out.trust).toBe('verified');
    expect(out.proof?.build_attempt).toBe(1);
  });

  it('same digest, a later attempt of the same run still in progress → deferred', async () => {
    const fetchImpl = actionsApi({
      run: {
        status: 200,
        body: runBody({ run_attempt: 2, status: 'in_progress', conclusion: null }),
      },
      attempt: { status: 200, body: runBody({ run_attempt: 1 }) },
      jobs: {
        status: 200,
        body: jobsBody([
          apiJob('gate', { run_attempt: 1 }),
          apiJob('package', { run_attempt: 1 }),
          apiJob('deploy', { run_attempt: 1 }),
        ]),
      },
    });
    const runStatus = await getRunStatus({ fetchImpl, repository: REPO, runId: '123', attempt: 1 });
    expect(verify(runStatus).trust).toBe('deferred');
  });

  it('historical gate/package successes present but every deploy at the commit failed → blocked', async () => {
    const fetchImpl = actionsApi({
      run: {
        status: 200,
        body: runBody({ run_attempt: 2, status: 'completed', conclusion: 'failure' }),
      },
      attempt: { status: 200, body: runBody({ run_attempt: 1, conclusion: 'failure' }) },
      jobs: {
        status: 200,
        body: jobsBody([
          apiJob('gate', { run_attempt: 1 }),
          apiJob('package', { run_attempt: 1 }),
          apiJob('deploy', { run_attempt: 1, conclusion: 'failure' }),
          apiJob('deploy', { run_attempt: 2, conclusion: 'failure' }),
        ]),
      },
    });
    const runStatus = await getRunStatus({ fetchImpl, repository: REPO, runId: '123', attempt: 1 });
    const out = verify(runStatus);
    expect(out.trust).toBe('blocked');
    expect(out.reasons.join(' ')).toMatch(/deploy/);
  });

  it('package succeeded only at an attempt other than the declared build_attempt → blocked', async () => {
    // Manifest claims build_attempt 2, but package only ever ran at attempt 1.
    const fetchImpl = actionsApi({
      run: { status: 200, body: runBody({ run_attempt: 2 }) },
      attempt: { status: 200, body: runBody({ run_attempt: 2 }) },
      jobs: {
        status: 200,
        body: jobsBody([
          apiJob('gate', { run_attempt: 1 }),
          apiJob('package', { run_attempt: 1 }),
          apiJob('deploy', { run_attempt: 2 }),
        ]),
      },
    });
    const runStatus = await getRunStatus({ fetchImpl, repository: REPO, runId: '123', attempt: 2 });
    const out = verify(runStatus, { provenance: { ...provenance(), build_attempt: 2 } });
    expect(out.trust).toBe('blocked');
    expect(out.reasons.join(' ')).toMatch(/package.*was not found/);
  });

  it('a required job only green at a different head_sha → blocked', async () => {
    const fetchImpl = actionsApi({
      run: { status: 200, body: runBody() },
      attempt: { status: 200, body: runBody() },
      jobs: {
        status: 200,
        body: jobsBody([
          apiJob('gate'),
          apiJob('package'),
          apiJob('deploy', { head_sha: 'b'.repeat(40) }),
        ]),
      },
    });
    const runStatus = await getRunStatus({ fetchImpl, repository: REPO, runId: '123', attempt: 1 });
    const out = verify(runStatus);
    expect(out.trust).toBe('blocked');
    expect(out.reasons.join(' ')).toMatch(/deploy.*was not found for commit/);
  });

  it('truncated job pagination → blocked, never inferred as success', async () => {
    const fetchImpl = actionsApi({
      run: { status: 200, body: runBody() },
      attempt: { status: 200, body: runBody() },
      jobs: {
        status: 200,
        body: jobsBody(
          Array.from({ length: 100 }, (_, i) => apiJob(`j${i}`)),
          500
        ),
      },
    });
    const runStatus = await getRunStatus({
      fetchImpl,
      repository: REPO,
      runId: '123',
      attempt: 1,
      maxJobPages: 1,
    });
    expect(runStatus.jobsComplete).toBe(false);
    expect(verify(runStatus).trust).toBe('blocked');
  });

  it('purged run: no stored proof → blocked; stored proof for another commit → blocked', async () => {
    const fetchImpl = actionsApi({ run: { status: 404, body: { message: 'Not Found' } } });
    const runStatus = await getRunStatus({ fetchImpl, repository: REPO, runId: '123', attempt: 1 });
    expect(runStatus.found).toBe(false);
    expect(verify(runStatus).trust).toBe('blocked');

    const wrongIdentity = verify(runStatus, {
      provenDeploys: [
        {
          repository: REPO,
          commit: 'b'.repeat(40), // digest matches, commit does not
          run_id: '123',
          build_attempt: 1,
          workflow_path: DEPLOY_WORKFLOW_PATH,
          manifest_digest: DIG,
        },
      ],
    });
    expect(wrongIdentity.trust).toBe('blocked');
  });

  it('purged attempt (run intact) with a matching stored proof → verified from stored', async () => {
    const fetchImpl = actionsApi({
      run: { status: 200, body: runBody() },
      attempt: { status: 404, body: { message: 'Not Found' } },
      jobs: { status: 200, body: jobsBody([]) },
    });
    const runStatus = await getRunStatus({ fetchImpl, repository: REPO, runId: '123', attempt: 1 });
    const out = verify(runStatus, {
      provenDeploys: [
        {
          repository: REPO,
          commit: SHA,
          run_id: '123',
          build_attempt: 1,
          workflow_path: DEPLOY_WORKFLOW_PATH,
          manifest_digest: DIG,
        },
      ],
    });
    expect(out.trust).toBe('verified');
    expect(out.proof?.source).toBe('stored');
  });

  it('verifies a clean single-attempt deploy end to end', async () => {
    const fetchImpl = actionsApi({
      run: { status: 200, body: runBody() },
      attempt: { status: 200, body: runBody() },
      jobs: { status: 200, body: jobsBody([apiJob('gate'), apiJob('package'), apiJob('deploy')]) },
    });
    const runStatus = await getRunStatus({ fetchImpl, repository: REPO, runId: '123', attempt: 1 });
    const out = verify(runStatus);
    expect(out.trust).toBe('verified');
    expect(out.proof).toMatchObject({ manifest_digest: DIG, source: 'live' });
  });
});
