'use strict';

/**
 * Issue lifecycle of the monthly Lighthouse monitor (.github/workflows/perf-monitor.yml).
 *
 * - low score, no open issue  -> open one
 * - low score, issue open     -> comment on it instead of filing a duplicate
 * - scores recovered          -> comment and close the open issue as completed
 *
 * CommonJS on purpose: actions/github-script loads it with `require`.
 */

const ISSUE_TITLE = '📉 Lighthouse: Puntuaciones bajas detectadas';

/**
 * @param {{ github: any, context: any, scores: string, low: boolean }} args
 */
async function syncLighthouseIssue({ github, context, scores, low }) {
  const { owner, repo } = context.repo;
  const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${context.runId}`;

  const open = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: 'open',
    labels: 'performance',
    per_page: 100,
  });
  const existing = open.filter((issue) => !issue.pull_request && issue.title === ISSUE_TITLE);

  if (low && existing.length === 0) {
    await github.rest.issues.create({
      owner,
      repo,
      title: ISSUE_TITLE,
      body: [
        'El monitoreo mensual de Lighthouse detectó puntuaciones por debajo del umbral de 80.',
        '',
        `- Puntuaciones: ${scores}`,
        '- Revisa los reportes en `reports/lighthouse-home.json` para más detalles.',
        `- [Ver ejecución](${runUrl})`,
      ].join('\n'),
      labels: ['performance'],
    });
    return;
  }

  if (low) {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: existing[0].number,
      body: `Sigue por debajo del umbral de 80 (${scores}). [Ver ejecución](${runUrl})`,
    });
    return;
  }

  for (const issue of existing) {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: issue.number,
      body: `Puntuaciones recuperadas (${scores}). Cierro el issue. [Ver ejecución](${runUrl})`,
    });
    await github.rest.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      state: 'closed',
      state_reason: 'completed',
    });
  }
}

module.exports = { ISSUE_TITLE, syncLighthouseIssue };
