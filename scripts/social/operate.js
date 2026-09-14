import { loadState, initializeState, recordReconciliation } from './state.js';

/**
 * Administrative CLI surface for the social publisher (plan
 * social-distribution §12 / §15 "Resolución humana segura" / §22 / §23).
 *
 * Three closed operations, none of which ever publish:
 *
 * - `doctor`       — read-only diagnostics: ledger summary, Buffer
 *   organization/channel discovery, a Bluesky session check. Never calls
 *   `create` / `putRecord` / `initializeState` / a ledger write.
 * - `init-state`   — explicit, idempotent ledger bootstrap
 *   (`state.initializeState`). Verifies-not-replaces an existing branch.
 * - `resolve-state`— the only sanctioned path for a human to move a BLOCKED /
 *   AMBIGUOUS entry, requiring the article, platform, a live `intent_id`, an
 *   expected revision, a reason and evidence obtained from a real read (this
 *   module never performs that read itself — an operator gathers it via
 *   `doctor` or the provider's own UI/API and supplies it here). There is no
 *   `--force-publish` and no "reset all": every call is one entry, one
 *   transition, fully audited in Git history via `state.js`.
 *
 * This module never decides eligibility, never builds copy, and never talks
 * to a provider's write endpoint. It is intentionally small.
 */

export class OperateError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'OperateError';
    this.code = code;
  }
}

const RESOLVE_ACTIONS = new Set(['adopt', 'block', 'authorize-retry']);

function nowIso(now) {
  return new Date(typeof now === 'function' ? now() : Date.now()).toISOString();
}

/**
 * Read-only diagnostics. Every section is independently optional and
 * independently fails soft (an error is reported, not thrown), so a partial
 * environment (e.g. Buffer configured, Bluesky not yet) still produces a
 * useful report.
 *
 * @param {{
 *   stateStore?: import('./state.js').StateStore,
 *   bufferClient?: import('./providers/buffer.js').ReturnType<typeof import('./providers/buffer.js').createBufferClient>,
 *   bufferOrganizationId?: string,
 *   blueskyClient?: ReturnType<typeof import('./providers/bluesky.js').createBlueskyClient>,
 *   now?: () => number,
 * }} deps
 */
export async function doctor({
  stateStore,
  bufferClient,
  bufferOrganizationId,
  blueskyClient,
  now,
} = {}) {
  const report = { generated_at: nowIso(now), state: null, buffer: null, bluesky: null };

  if (stateStore) {
    try {
      const { state } = await loadState({ store: stateStore });
      report.state = {
        ok: true,
        revision: state.revision,
        initialized_at: state.initialized_at,
        article_count: Object.keys(state.articles ?? {}).length,
        proven_deploy_count: Object.keys(state.proven_deploys ?? {}).length,
      };
    } catch (error) {
      report.state = {
        ok: false,
        code: error?.code ?? 'ERROR',
        message: error?.message ?? String(error),
      };
    }
  }

  if (bufferClient) {
    try {
      const organizations = await bufferClient.discoverOrganizations();
      const channels = await bufferClient.inspectChannels(
        bufferOrganizationId ? { organizationId: bufferOrganizationId } : {}
      );
      report.buffer = { ok: true, organizations, channels };
    } catch (error) {
      report.buffer = {
        ok: false,
        code: error?.code ?? 'ERROR',
        message: error?.message ?? String(error),
      };
    }
  }

  if (blueskyClient) {
    try {
      // A session read (login) only — never `putRecord` / `uploadBlob`.
      await blueskyClient.ensureSession();
      report.bluesky = { ok: true, did: blueskyClient.did };
    } catch (error) {
      report.bluesky = {
        ok: false,
        code: error?.code ?? 'ERROR',
        message: error?.message ?? String(error),
      };
    }
  }

  return report;
}

/**
 * Explicit, one-time ledger bootstrap. A thin, documented pass-through to
 * `state.initializeState` — kept here (not in `publish.js`) so normal
 * publisher runs can never accidentally create the branch (plan §15 "el
 * publisher normal falla cerrado si falta archivo/rama").
 *
 * @param {{ stateStore: import('./state.js').StateStore, now?: () => number }} deps
 */
export async function initState({ stateStore, now }) {
  if (!stateStore) throw new OperateError('CONFIG', 'init-state needs a stateStore');
  return initializeState({ store: stateStore, now });
}

/**
 * The only sanctioned human-resolution path (plan §15 "Resolución humana
 * segura"). `evidence` MUST already reflect a real read the operator
 * performed (a Buffer `get`/`list`, a Bluesky `getRecord`, or equivalent
 * manual verification via the provider's UI) — this function refuses to
 * write without it, and never performs that read itself.
 *
 * `action`:
 * - `adopt`           — AMBIGUOUS/ACCEPTED → ACCEPTED/PUBLISHED, needs
 *   `providerId` (Buffer) or `uri`/`cid` (Bluesky) confirmed by the evidence.
 * - `block`           — → BLOCKED, always allowed from a non-terminal status.
 * - `authorize-retry` — AMBIGUOUS → RETRYABLE, needs `retryAt`; this is the
 *   ONLY way a Buffer pair leaves AMBIGUOUS toward a new send, and only after
 *   the operator has explicitly accepted the residual duplication risk
 *   (plan §15 "sólo tras comprobar ausencia y aceptar explícitamente el
 *   riesgo residual").
 *
 * @param {{
 *   stateStore: import('./state.js').StateStore,
 *   session: { runId: string, attempt: number },
 *   socialId: string,
 *   platform: string,
 *   intentId: string,
 *   expectedRevision: number,
 *   action: 'adopt' | 'block' | 'authorize-retry',
 *   actor: string,
 *   reason: string,
 *   evidence: string | object,
 *   target?: 'ACCEPTED' | 'PUBLISHED',
 *   providerId?: string,
 *   uri?: string,
 *   cid?: string,
 *   externalUrl?: string,
 *   retryAt?: string,
 *   now?: () => number,
 * }} params
 */
export async function resolveState({
  stateStore,
  session,
  socialId,
  platform,
  intentId,
  expectedRevision,
  action,
  actor,
  reason,
  evidence,
  target,
  providerId,
  uri,
  cid,
  externalUrl,
  retryAt,
  now,
}) {
  if (!stateStore) throw new OperateError('CONFIG', 'resolve-state needs a stateStore');
  if (!RESOLVE_ACTIONS.has(action)) {
    throw new OperateError(
      'CONFIG',
      `resolve-state action must be one of ${[...RESOLVE_ACTIONS].join('/')}, got ${JSON.stringify(action)}`
    );
  }
  if (evidence == null) {
    throw new OperateError(
      'CONFIG',
      'resolve-state requires evidence from a real read; this module never performs that read itself'
    );
  }
  if (!Number.isInteger(expectedRevision)) {
    throw new OperateError(
      'CONFIG',
      'resolve-state requires an expectedRevision (optimistic guard)'
    );
  }

  return recordReconciliation({
    store: stateStore,
    session,
    socialId,
    platform,
    intentId,
    kind: 'resolve',
    action,
    target,
    providerId,
    uri,
    cid,
    externalUrl,
    retryAt,
    expectedRevision,
    resolution: { actor, reason, evidence },
    now,
  });
}

// --- CLI --------------------------------------------------------------

// eslint-disable-next-line no-secrets/no-secrets -- platform list in usage text, not a secret
const USAGE = `Usage:
  node scripts/social/operate.js doctor
  node scripts/social/operate.js init-state
  node scripts/social/operate.js resolve-state --social-id <hex64> --platform <facebook|x|linkedin|bluesky> \\
    --intent-id <id> --expected-revision <n> --action <adopt|block|authorize-retry> \\
    --actor <name> --reason <text> --evidence-file <path> [--target ACCEPTED|PUBLISHED] \\
    [--provider-id <id>] [--uri <at://...>] [--cid <cid>] [--external-url <url>] [--retry-at <iso>]

No flag bypasses evidence or guards; there is no --force-publish.`;

/** Minimal, closed argv parser — no shell interpolation, no free-form flags reaching state.js untyped. */
export function parseCliArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = rest[i + 1];
    const hasValue = next !== undefined && !next.startsWith('--');
    flags[key] = hasValue ? next : true;
    if (hasValue) i += 1;
  }
  return { command, flags };
}

/**
 * CLI entry point. Builds real dependencies from environment variables only
 * when actually invoked as a script (never on import, so tests can import
 * `doctor`/`initState`/`resolveState` without side effects).
 */
export async function main(argv = process.argv.slice(2)) {
  const { command, flags } = parseCliArgs(argv);

  if (!command || flags.help) {
    console.log(USAGE);
    return command ? 0 : 1;
  }

  const { createRealDependencies } = await import('./publish.js');
  const deps = await createRealDependencies({ requireStateWrite: true });

  if (command === 'doctor') {
    const report = await doctor({
      stateStore: deps.stateStore,
      bufferClient: deps.bufferClient,
      bufferOrganizationId: deps.config?.bufferOrganizationId,
      blueskyClient: deps.blueskyClient,
    });
    console.log(JSON.stringify(report, null, 2));
    const failed =
      (report.state && report.state.ok === false) ||
      (report.buffer && report.buffer.ok === false) ||
      (report.bluesky && report.bluesky.ok === false);
    return failed ? 1 : 0;
  }

  if (command === 'init-state') {
    const outcome = await initState({ stateStore: deps.stateStore });
    console.log(JSON.stringify(outcome, null, 2));
    return 0;
  }

  if (command === 'resolve-state') {
    const evidence = flags['evidence-file']
      ? await import('node:fs/promises').then((fs) => fs.readFile(flags['evidence-file'], 'utf8'))
      : undefined;
    const outcome = await resolveState({
      stateStore: deps.stateStore,
      session: deps.session,
      socialId: flags['social-id'],
      platform: flags.platform,
      intentId: flags['intent-id'],
      expectedRevision: Number(flags['expected-revision']),
      action: flags.action,
      actor: flags.actor,
      reason: flags.reason,
      evidence,
      target: flags.target,
      providerId: flags['provider-id'],
      uri: flags.uri,
      cid: flags.cid,
      externalUrl: flags['external-url'],
      retryAt: flags['retry-at'],
    });
    console.log(JSON.stringify(outcome, null, 2));
    return outcome.outcome === 'applied' ? 0 : 1;
  }

  console.error(`unknown command ${JSON.stringify(command)}\n\n${USAGE}`);
  return 1;
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error?.message ?? String(error));
      process.exit(1);
    });
}
