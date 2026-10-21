import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const WORKFLOW_PATH = fileURLToPath(
  new URL('../.github/workflows/perf-monitor.yml', import.meta.url)
);
const TITLE = '📉 Lighthouse: Puntuaciones bajas detectadas';

interface Step {
  name?: string;
  with?: { script?: string };
}

const workflow = load(readFileSync(WORKFLOW_PATH, 'utf8')) as {
  jobs: { lighthouse: { 'timeout-minutes': number; steps: Step[] } };
};
const job = workflow.jobs.lighthouse;
const lifecycleScript = job.steps.find((step) => step.name?.startsWith('Open, update'))?.with
  ?.script as string;

type Call = [string, Record<string, unknown>];

async function runLifecycle(opts: { low: boolean; open: Array<Record<string, unknown>> }) {
  const calls: Call[] = [];
  const record =
    (name: string) =>
    async (params: Record<string, unknown>): Promise<void> => {
      calls.push([name, params]);
    };
  const github = {
    paginate: async () => opts.open,
    rest: {
      issues: {
        listForRepo: 'listForRepo',
        create: record('create'),
        createComment: record('createComment'),
        update: record('update'),
      },
    },
  };
  const context = { repo: { owner: 'o', repo: 'r' }, runId: 42 };
  const processStub = {
    env: { LOW_SCORES: opts.low ? 'true' : '', LIGHTHOUSE_SCORES: 'P=72 A=100 S=92 B=96' },
  };
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  await new AsyncFunction('github', 'context', 'process', lifecycleScript)(
    github,
    context,
    processStub
  );
  return calls;
}

describe('perf-monitor workflow', () => {
  it('leaves room for the production build before the audit (it took ~9.5 min on 2026-10-21)', () => {
    expect(job['timeout-minutes']).toBeGreaterThanOrEqual(20);
  });

  it('opens one issue when scores are low and none is open', async () => {
    const calls = await runLifecycle({ low: true, open: [] });
    expect(calls.map(([name]) => name)).toEqual(['create']);
    expect(String(calls[0][1].body)).toContain('P=72 A=100 S=92 B=96');
  });

  it('comments on the open issue instead of filing a duplicate', async () => {
    const open = [{ number: 294, title: TITLE }];
    const calls = await runLifecycle({ low: true, open });
    expect(calls.map(([name]) => name)).toEqual(['createComment']);
    expect(calls[0][1].issue_number).toBe(294);
  });

  it('closes the open issue once the scores recover', async () => {
    const open = [{ number: 294, title: TITLE }];
    const calls = await runLifecycle({ low: false, open });
    expect(calls.map(([name]) => name)).toEqual(['createComment', 'update']);
    expect(calls[1][1]).toMatchObject({
      issue_number: 294,
      state: 'closed',
      state_reason: 'completed',
    });
  });

  it('ignores pull requests and unrelated issues with the same label', async () => {
    const open = [
      { number: 1, title: TITLE, pull_request: {} },
      { number: 2, title: 'Otro issue de rendimiento' },
    ];
    expect((await runLifecycle({ low: false, open })).length).toBe(0);
    expect((await runLifecycle({ low: true, open })).map(([name]) => name)).toEqual(['create']);
  });
});
