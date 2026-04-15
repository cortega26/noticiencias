import { parseImageDeliveryMode } from '../../src/utils/image-delivery-mode.js';

export const R2_CLASS_B_ACTION_TYPES = [
  'HeadBucket',
  'HeadObject',
  'GetObject',
  'UsageSummary',
  'GetBucketEncryption',
  'GetBucketLocation',
  'GetBucketCors',
  'GetBucketLifecycleConfiguration',
];

export const R2_CLASS_B_FREE_TIER_LIMIT = 10_000_000;
export const R2_CLASS_B_WARN_RATIO = 0.75;
export const R2_CLASS_B_SWITCH_RATIO = 0.9;

export function getCurrentMonthWindow(now = new Date()) {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)),
    end: now,
  };
}

export function summarizeClassBUsage(groups) {
  /** @type {Record<string, number>} */
  const requestsByActionType = {};
  let classBRequests = 0;

  for (const group of groups ?? []) {
    const actionType = group?.dimensions?.actionType;
    const actionStatus = group?.dimensions?.actionStatus;
    const requests = Number(group?.sum?.requests ?? 0);

    if (!R2_CLASS_B_ACTION_TYPES.includes(actionType)) {
      continue;
    }

    if (actionStatus !== 'success' || !Number.isFinite(requests) || requests <= 0) {
      continue;
    }

    classBRequests += requests;
    requestsByActionType[actionType] = (requestsByActionType[actionType] ?? 0) + requests;
  }

  const usageRatio = classBRequests / R2_CLASS_B_FREE_TIER_LIMIT;

  return {
    classBRequests,
    usageRatio,
    usagePercent: Number((usageRatio * 100).toFixed(2)),
    warnThresholdRequests: Math.round(R2_CLASS_B_FREE_TIER_LIMIT * R2_CLASS_B_WARN_RATIO),
    switchThresholdRequests: Math.round(R2_CLASS_B_FREE_TIER_LIMIT * R2_CLASS_B_SWITCH_RATIO),
    requestsByActionType,
  };
}

export function decideImageDeliveryMode({ currentMode, usageRatio, manualMode = 'auto' }) {
  const normalizedCurrentMode = parseImageDeliveryMode(currentMode);

  if (manualMode !== 'auto') {
    const targetMode = parseImageDeliveryMode(manualMode);

    return {
      action: 'manual',
      currentMode: normalizedCurrentMode,
      targetMode,
      shouldSwitch: targetMode !== normalizedCurrentMode,
      warningTriggered: false,
      switchThresholdTriggered: false,
      reason: `Manual override requested: ${targetMode}`,
    };
  }

  const switchThresholdTriggered = usageRatio >= R2_CLASS_B_SWITCH_RATIO;
  const warningTriggered = usageRatio >= R2_CLASS_B_WARN_RATIO;

  if (switchThresholdTriggered && normalizedCurrentMode === 'r2') {
    return {
      action: 'auto-switch',
      currentMode: normalizedCurrentMode,
      targetMode: 'github',
      shouldSwitch: true,
      warningTriggered: true,
      switchThresholdTriggered: true,
      reason: 'Class B usage reached the auto-switch threshold.',
    };
  }

  if (normalizedCurrentMode === 'github') {
    return {
      action: 'hold',
      currentMode: normalizedCurrentMode,
      targetMode: normalizedCurrentMode,
      shouldSwitch: false,
      warningTriggered,
      switchThresholdTriggered,
      reason: 'GitHub mode is already active; auto-restore is disabled.',
    };
  }

  if (warningTriggered) {
    return {
      action: 'warn',
      currentMode: normalizedCurrentMode,
      targetMode: normalizedCurrentMode,
      shouldSwitch: false,
      warningTriggered: true,
      switchThresholdTriggered: false,
      reason: 'Class B usage reached the warning threshold.',
    };
  }

  return {
    action: 'hold',
    currentMode: normalizedCurrentMode,
    targetMode: normalizedCurrentMode,
    shouldSwitch: false,
    warningTriggered: false,
    switchThresholdTriggered: false,
    reason: 'Usage is below the warning threshold.',
  };
}
