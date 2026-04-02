import { describe, expect, it } from 'vitest';

import {
  R2_CLASS_B_FREE_TIER_LIMIT,
  decideImageDeliveryMode,
  summarizeClassBUsage,
} from '../scripts/utils/r2-image-quota.js';

describe('R2 image quota helpers', () => {
  it('counts only successful class B operations toward usage', () => {
    const summary = summarizeClassBUsage([
      {
        dimensions: { actionType: 'GetObject', actionStatus: 'success' },
        sum: { requests: 120 },
      },
      {
        dimensions: { actionType: 'HeadObject', actionStatus: 'success' },
        sum: { requests: 30 },
      },
      {
        dimensions: { actionType: 'PutObject', actionStatus: 'success' },
        sum: { requests: 400 },
      },
      {
        dimensions: { actionType: 'GetObject', actionStatus: 'userError' },
        sum: { requests: 500 },
      },
    ]);

    expect(summary.classBRequests).toBe(150);
    expect(summary.requestsByActionType).toEqual({
      GetObject: 120,
      HeadObject: 30,
    });
  });

  it('warns at 75 percent without auto-restoring github mode', () => {
    const warningDecision = decideImageDeliveryMode({
      currentMode: 'r2',
      usageRatio: 0.8,
      manualMode: 'auto',
    });
    const holdDecision = decideImageDeliveryMode({
      currentMode: 'github',
      usageRatio: 0.2,
      manualMode: 'auto',
    });

    expect(warningDecision.action).toBe('warn');
    expect(warningDecision.shouldSwitch).toBe(false);
    expect(holdDecision.targetMode).toBe('github');
    expect(holdDecision.shouldSwitch).toBe(false);
  });

  it('switches to github at or above the auto-degrade threshold', () => {
    const decision = decideImageDeliveryMode({
      currentMode: 'r2',
      usageRatio: 0.91,
      manualMode: 'auto',
    });

    expect(decision.action).toBe('auto-switch');
    expect(decision.targetMode).toBe('github');
    expect(decision.shouldSwitch).toBe(true);
  });

  it('supports manual overrides for restore and degrade flows', () => {
    const restoreDecision = decideImageDeliveryMode({
      currentMode: 'github',
      usageRatio: 0.99,
      manualMode: 'r2',
    });
    const degradeDecision = decideImageDeliveryMode({
      currentMode: 'r2',
      usageRatio: 0,
      manualMode: 'github',
    });

    expect(restoreDecision.targetMode).toBe('r2');
    expect(restoreDecision.shouldSwitch).toBe(true);
    expect(degradeDecision.targetMode).toBe('github');
    expect(degradeDecision.shouldSwitch).toBe(true);
  });

  it('reports usage percentage against the official free tier limit', () => {
    const summary = summarizeClassBUsage([
      {
        dimensions: { actionType: 'GetObject', actionStatus: 'success' },
        sum: { requests: R2_CLASS_B_FREE_TIER_LIMIT / 2 },
      },
    ]);

    expect(summary.usagePercent).toBe(50);
  });
});
