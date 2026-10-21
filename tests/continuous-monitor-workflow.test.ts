import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const WORKFLOW_PATH = fileURLToPath(
  new URL('../.github/workflows/continuous-monitor.yml', import.meta.url)
);

interface Step {
  id?: string;
  name?: string;
  if?: string;
  run?: string;
  'continue-on-error'?: boolean;
}

function monitorSteps(): Step[] {
  const workflow = load(readFileSync(WORKFLOW_PATH, 'utf8')) as {
    jobs: Record<string, { steps: Step[] }>;
  };
  return Object.values(workflow.jobs).flatMap((job) => job.steps);
}

describe('continuous-monitor workflow', () => {
  // `continue-on-error` keeps the later steps running but hides the step from
  // `failure()`; without an explicit outcome check a broken link never opens
  // the monitoring issue and the run stays green.
  const steps = monitorSteps();
  const links = steps.find((step) => step.id === 'links');

  it('keeps the link checker non-blocking so dist sanity still runs', () => {
    expect(links?.['continue-on-error']).toBe(true);
  });

  it('opens the monitoring issue when the link checker fails', () => {
    const issue = steps.find((step) => step.name?.startsWith('Create monitoring issue'));
    expect(issue?.if).toContain('failure()');
    expect(issue?.if).toContain("steps.links.outcome == 'failure'");
  });

  it('turns the run red when the link checker fails', () => {
    const last = steps[steps.length - 1];
    expect(last.if).toContain("steps.links.outcome == 'failure'");
    expect(last.run).toMatch(/::error::/);
    expect(last.run).toMatch(/exit 1/);
  });
});
