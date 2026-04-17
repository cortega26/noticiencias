import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  getImageDeliveryMode,
  writeImageDeliveryModeConfig,
} from '../src/utils/image-delivery-mode.js';
import {
  R2_CLASS_B_FREE_TIER_LIMIT,
  R2_CLASS_B_WARN_RATIO,
  R2_CLASS_B_SWITCH_RATIO,
  decideImageDeliveryMode,
  getCurrentMonthWindow,
  summarizeClassBUsage,
} from './utils/r2-image-quota.js';

const GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

export const MISSING_CONFIG_ERROR =
  'Missing Cloudflare quota lookup configuration. Expected CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ACCOUNT_ANALYTICS_READ_TOKEN, and CLOUDFLARE_R2_BUCKET_NAME.';

const OPERATIONS_QUERY = `
  query R2QuotaUsage(
    $accountTag: string!
    $bucketName: string!
    $startDate: Time
    $endDate: Time
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        r2OperationsAdaptiveGroups(
          limit: 10000
          filter: {
            datetime_geq: $startDate
            datetime_leq: $endDate
            bucketName: $bucketName
          }
        ) {
          sum {
            requests
          }
          dimensions {
            actionType
            actionStatus
          }
        }
      }
    }
  }
`;

export function parseArgs(argv) {
  const args = {
    mode: 'auto',
    summaryFile: '',
    write: false,
  };

  for (const arg of argv) {
    if (arg === '--write') {
      args.write = true;
      continue;
    }

    if (arg.startsWith('--mode=')) {
      args.mode = arg.slice('--mode='.length);
      continue;
    }

    if (arg.startsWith('--summary-file=')) {
      args.summaryFile = arg.slice('--summary-file='.length);
    }
  }

  return args;
}

export function getQuotaLookupConfig(env = process.env) {
  return {
    accountId: env.CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: env.CLOUDFLARE_ACCOUNT_ANALYTICS_READ_TOKEN || '',
    bucketName: env.R2_BUCKET_NAME || env.CLOUDFLARE_R2_BUCKET_NAME || '',
  };
}

export function hasQuotaLookupConfig(env = process.env) {
  const config = getQuotaLookupConfig(env);
  return Boolean(config.accountId && config.apiToken && config.bucketName);
}

export function shouldSkipMissingConfig({ mode, eventName }) {
  return mode === 'auto' && eventName === 'schedule';
}

export function createSummary({
  currentMode = getImageDeliveryMode(),
  checkedAt = new Date(),
} = {}) {
  return {
    checkedAt: checkedAt.toISOString(),
    currentMode,
    targetMode: currentMode,
    modeChanged: false,
    action: 'hold',
    reason: '',
    usage: null,
    status: 'pending',
    missingConfig: false,
    prCreated: false,
    pullRequestUrl: null,
    thresholds: {
      freeTierLimit: R2_CLASS_B_FREE_TIER_LIMIT,
      warnRatio: R2_CLASS_B_WARN_RATIO,
      switchRatio: R2_CLASS_B_SWITCH_RATIO,
      warnRequests: Math.round(R2_CLASS_B_FREE_TIER_LIMIT * R2_CLASS_B_WARN_RATIO),
      switchRequests: Math.round(R2_CLASS_B_FREE_TIER_LIMIT * R2_CLASS_B_SWITCH_RATIO),
    },
  };
}

export async function fetchR2Usage({
  accountId,
  apiToken,
  bucketName,
  now = new Date(),
  fetchImpl = fetch,
}) {
  if (!accountId || !apiToken || !bucketName) {
    throw new Error(MISSING_CONFIG_ERROR);
  }

  const { start, end } = getCurrentMonthWindow(now);
  const response = await fetchImpl(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: OPERATIONS_QUERY,
      variables: {
        accountTag: accountId,
        bucketName,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Cloudflare usage query failed with HTTP ${response.status}: ${body}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const message = payload.errors.map((error) => error.message).join('; ');
    throw new Error(`Cloudflare usage query returned GraphQL errors: ${message}`);
  }

  const groups = payload?.data?.viewer?.accounts?.[0]?.r2OperationsAdaptiveGroups;
  if (!Array.isArray(groups)) {
    throw new Error('Cloudflare usage query returned an unexpected response payload.');
  }

  return {
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    summary: summarizeClassBUsage(groups),
  };
}

export function writeSummaryFile(summaryFile, summary) {
  if (!summaryFile) {
    return;
  }

  fs.writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

export async function runQuotaGuard({
  argv = process.argv.slice(2),
  env = process.env,
  now = new Date(),
  fetchImpl = fetch,
} = {}) {
  const args = parseArgs(argv);
  const currentMode = getImageDeliveryMode();
  const summary = createSummary({ currentMode, checkedAt: now });

  let usageSummary = null;

  if (args.mode === 'auto') {
    if (!hasQuotaLookupConfig(env)) {
      summary.missingConfig = true;

      if (shouldSkipMissingConfig({ mode: args.mode, eventName: env.GITHUB_EVENT_NAME || '' })) {
        summary.status = 'skipped_missing_config';
        summary.reason =
          'Cloudflare quota lookup configuration is missing; scheduled auto evaluation was skipped.';
        writeSummaryFile(args.summaryFile, summary);
        console.log(`Image delivery mode: ${currentMode}`);
        console.log('Monthly Class B usage: skipped (missing Cloudflare quota configuration)');
        console.log(`Decision: ${summary.reason}`);
        console.log(`Target mode: ${summary.targetMode}`);
        console.log(`Mode changed: ${summary.modeChanged ? 'yes' : 'no'}`);
        return summary;
      }

      summary.status = 'failed_missing_config';
      summary.reason =
        'Cloudflare quota lookup configuration is missing; auto evaluation requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ACCOUNT_ANALYTICS_READ_TOKEN, and CLOUDFLARE_R2_BUCKET_NAME.';
      writeSummaryFile(args.summaryFile, summary);
      throw new Error(MISSING_CONFIG_ERROR);
    }

    const usage = await fetchR2Usage({
      ...getQuotaLookupConfig(env),
      now,
      fetchImpl,
    });

    usageSummary = usage.summary;
    summary.usage = {
      ...usage.summary,
      windowStart: usage.windowStart,
      windowEnd: usage.windowEnd,
    };
  }

  const decision = decideImageDeliveryMode({
    currentMode,
    usageRatio: usageSummary?.usageRatio ?? 0,
    manualMode: args.mode,
  });

  summary.action = decision.action;
  summary.reason = decision.reason;
  summary.targetMode = decision.targetMode;
  summary.status = args.mode === 'auto' ? 'evaluated' : 'manual_override';

  if (args.write && decision.shouldSwitch) {
    summary.modeChanged = writeImageDeliveryModeConfig(decision.targetMode);
  }

  console.log(`Image delivery mode: ${currentMode}`);
  if (summary.usage) {
    console.log(
      `Monthly Class B usage: ${summary.usage.classBRequests}/${R2_CLASS_B_FREE_TIER_LIMIT} (${summary.usage.usagePercent}%)`
    );
  } else if (args.mode === 'auto') {
    console.log('Monthly Class B usage: unavailable');
  } else {
    console.log('Monthly Class B usage: skipped (manual mode override)');
  }
  console.log(`Decision: ${summary.reason}`);
  console.log(`Target mode: ${summary.targetMode}`);
  console.log(`Mode changed: ${summary.modeChanged ? 'yes' : 'no'}`);

  writeSummaryFile(args.summaryFile, summary);
  return summary;
}

const isMainModule =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  runQuotaGuard().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
