import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

interface Step {
  id?: string;
  name?: string;
  if?: string;
  run?: string;
  env?: Record<string, string>;
  'continue-on-error'?: boolean;
}

function workflowSteps(name: string): Step[] {
  const path = new URL(`../.github/workflows/${name}.yml`, import.meta.url);
  const workflow = load(readFileSync(path, 'utf8')) as {
    jobs: Record<string, { steps: Step[] }>;
  };
  return Object.values(workflow.jobs).flatMap((job) => job.steps);
}

describe('bot landing diagnostics', () => {
  it.each([
    ['generate-metrics', ['land']],
    ['sync-contract-snapshot', ['land']],
    ['image-delivery-quota', ['evaluate', 'commit_mode', 'create_pr']],
  ] as const)('%s reports only failures of earlier automation steps', (workflow, phases) => {
    const steps = workflowSteps(workflow);
    const index = steps.findIndex((step) => step.name?.startsWith('Report '));
    const report = steps[index];

    expect(report?.if).toContain('failure() &&');
    for (const phase of phases) {
      const operation = steps.findIndex((step) => step.id === phase);
      expect(operation).toBeGreaterThanOrEqual(0);
      expect(operation).toBeLessThan(index);
      expect(steps[operation]['continue-on-error']).not.toBe(true);
      expect(report.if).toContain(`steps.${phase}.outcome == 'failure'`);
    }
    expect(report.run).toContain('::error title=');
    expect(report.run).toContain('$GITHUB_STEP_SUMMARY');
    expect(report.run).toContain('[Pull request]');
    expect(report.env?.PR_URL).toContain(`steps.${phases.at(-1)}.outputs.url`);
    expect(JSON.stringify(steps)).not.toMatch(
      /bot_landing_failed|backend-notify-failure|BACKEND_WEBHOOK/
    );
  });

  it('preserves quota and deploy diagnostic artifacts', () => {
    const quotaSteps = workflowSteps('image-delivery-quota');
    expect(quotaSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Publish workflow summary', if: 'always()' }),
      ])
    );
    expect(workflowSteps('deploy')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Upload backend notification diagnostics',
          if: 'always()',
        }),
      ])
    );
  });
});
