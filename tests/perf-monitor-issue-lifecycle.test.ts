import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { ISSUE_TITLE, syncLighthouseIssue } from '../scripts/perf-monitor-issue.cjs';

const WORKFLOW_PATH = fileURLToPath(
  new URL('../.github/workflows/perf-monitor.yml', import.meta.url)
);
const SCORES = 'P=72 A=100 S=92 B=96';

type Params = Record<string, unknown>;
type Issue = { number: number; title: string; pull_request?: object };

async function run(low: boolean, open: Issue[]) {
  const calls: Array<[string, Params]> = [];
  function push(name: string, params: Params) {
    calls.push([name, params]);
  }
  const github = {
    paginate: async () => open,
    rest: {
      issues: {
        listForRepo: 'listForRepo',
        create: async (params: Params) => push('create', params),
        createComment: async (params: Params) => push('createComment', params),
        update: async (params: Params) => push('update', params),
      },
    },
  };
  const context = { repo: { owner: 'o', repo: 'r' }, runId: 42 };
  await syncLighthouseIssue({ github, context, scores: SCORES, low });
  return calls;
}

describe('perf-monitor issue lifecycle', () => {
  it('opens one issue, with the scores, when low and none is open', async () => {
    const calls = await run(true, []);
    expect(calls.map(([name]) => name)).toEqual(['create']);
    expect(String(calls[0][1].body)).toContain(SCORES);
  });

  it('comments on the open issue instead of filing a duplicate', async () => {
    const calls = await run(true, [{ number: 294, title: ISSUE_TITLE }]);
    expect(calls.map(([name]) => name)).toEqual(['createComment']);
    expect(calls[0][1].issue_number).toBe(294);
  });

  it('closes the open issue once the scores recover', async () => {
    const calls = await run(false, [{ number: 294, title: ISSUE_TITLE }]);
    expect(calls.map(([name]) => name)).toEqual(['createComment', 'update']);
    expect(calls[1][1]).toMatchObject({ state: 'closed', state_reason: 'completed' });
  });

  it('ignores pull requests and unrelated issues carrying the same label', async () => {
    const open = [
      { number: 1, title: ISSUE_TITLE, pull_request: {} },
      { number: 2, title: 'Otro issue de rendimiento' },
    ];
    expect(await run(false, open)).toEqual([]);
    expect((await run(true, open)).map(([name]) => name)).toEqual(['create']);
  });
});

describe('perf-monitor workflow', () => {
  const workflow = load(readFileSync(WORKFLOW_PATH, 'utf8')) as {
    jobs: {
      lighthouse: { 'timeout-minutes': number; steps: Array<{ with?: { script?: string } }> };
    };
  };
  const job = workflow.jobs.lighthouse;

  it('leaves room for the production build before the audit (~9.5 min on 2026-10-21)', () => {
    expect(job['timeout-minutes']).toBeGreaterThanOrEqual(20);
  });

  it('delegates the issue lifecycle to the tested module', () => {
    const scripts = job.steps.map((step) => step.with?.script ?? '');
    expect(scripts.some((script) => script.includes('scripts/perf-monitor-issue.cjs'))).toBe(true);
  });
});
