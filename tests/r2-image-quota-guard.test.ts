import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  MISSING_CONFIG_ERROR,
  runQuotaGuard,
  shouldSkipMissingConfig,
} from '../scripts/r2-image-quota-guard.js';

describe('R2 image quota guard', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips scheduled auto evaluation when quota config is missing', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noti-r2-quota-guard-'));
    tempDirs.push(tempDir);
    const summaryFile = path.join(tempDir, 'summary.json');

    const summary = await runQuotaGuard({
      argv: [`--summary-file=${summaryFile}`],
      env: { GITHUB_EVENT_NAME: 'schedule' },
    });

    expect(summary.status).toBe('skipped_missing_config');
    expect(summary.missingConfig).toBe(true);
    expect(summary.modeChanged).toBe(false);
    expect(JSON.parse(fs.readFileSync(summaryFile, 'utf8')).status).toBe('skipped_missing_config');
  });

  it('fails manual auto evaluation when quota config is missing', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noti-r2-quota-guard-'));
    tempDirs.push(tempDir);
    const summaryFile = path.join(tempDir, 'summary.json');

    await expect(
      runQuotaGuard({
        argv: [`--summary-file=${summaryFile}`],
        env: { GITHUB_EVENT_NAME: 'workflow_dispatch' },
      })
    ).rejects.toThrow(MISSING_CONFIG_ERROR);

    expect(JSON.parse(fs.readFileSync(summaryFile, 'utf8')).status).toBe('failed_missing_config');
  });

  it('does not require quota config for manual mode overrides', async () => {
    const summary = await runQuotaGuard({
      argv: ['--mode=github'],
      env: { GITHUB_EVENT_NAME: 'workflow_dispatch' },
    });

    expect(summary.status).toBe('manual_override');
    expect(summary.targetMode).toBe('github');
    expect(summary.missingConfig).toBe(false);
  });

  it('treats only scheduled auto runs as skippable when config is missing', () => {
    expect(shouldSkipMissingConfig({ mode: 'auto', eventName: 'schedule' })).toBe(true);
    expect(shouldSkipMissingConfig({ mode: 'auto', eventName: 'workflow_dispatch' })).toBe(false);
    expect(shouldSkipMissingConfig({ mode: 'github', eventName: 'schedule' })).toBe(false);
  });
});
