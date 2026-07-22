import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');

function currentHeadSha(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf-8' }).trim();
}

describe('post-publish-callback.js', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('../scripts/backend-notify.js');
    vi.unstubAllEnvs();
  });

  it('sends a single-envelope payload, never a double-nested one', async () => {
    const head = currentHeadSha();

    const sendWebhookNotification = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.doMock('../scripts/backend-notify.js', async () => {
      const actual = await vi.importActual<typeof import('../scripts/backend-notify.js')>(
        '../scripts/backend-notify.js'
      );
      return { ...actual, sendWebhookNotification };
    });

    vi.stubEnv('BACKEND_WEBHOOK_URL', 'https://backend.example/webhook');
    vi.stubEnv('GITHUB_SHA', head);
    // Own parent commit — always exists in this checkout, whatever it is.
    vi.stubEnv('GITHUB_BASE_SHA', `${head}~1`);
    vi.stubEnv('GITHUB_REF_NAME', 'main');
    vi.stubEnv('GITHUB_REPOSITORY', 'org/repo');
    vi.stubEnv('GITHUB_RUN_ID', '42');

    const { main } = await import('../scripts/post-publish-callback.js');
    await main();

    expect(sendWebhookNotification).toHaveBeenCalledTimes(1);
    const call = sendWebhookNotification.mock.calls[0][0];
    const payload = call.payload;

    expect(payload.event).toBe('publish_complete');
    expect(payload.status).toBe('success');
    expect(payload.commit_sha).toBe(head);

    // Exactly one, flat diagnostic entry — the previous bug produced a
    // second envelope's worth of fields (event/branch/frontend_ref/...)
    // nested one level inside diagnostics[0] instead of this shape.
    expect(payload.diagnostics).toHaveLength(1);
    expect(payload.diagnostics[0]).toMatchObject({ check: 'deploy', status: 'pass' });
    expect(payload.diagnostics[0].event).toBeUndefined();
    expect(payload.diagnostics[0].diagnostics).toBeUndefined();
    expect(payload.diagnostics[0].commit_sha).toBeUndefined();

    expect(Array.isArray(payload.publication_ids)).toBe(true);
  });

  it('skips notification (and never calls sendWebhookNotification) when BACKEND_WEBHOOK_URL is unset', async () => {
    const head = currentHeadSha();

    const sendWebhookNotification = vi.fn();
    vi.doMock('../scripts/backend-notify.js', async () => {
      const actual = await vi.importActual<typeof import('../scripts/backend-notify.js')>(
        '../scripts/backend-notify.js'
      );
      return { ...actual, sendWebhookNotification };
    });

    vi.stubEnv('BACKEND_WEBHOOK_URL', '');
    vi.stubEnv('GITHUB_SHA', head);
    vi.stubEnv('GITHUB_BASE_SHA', `${head}~1`);

    const { main } = await import('../scripts/post-publish-callback.js');
    await main();

    expect(sendWebhookNotification).not.toHaveBeenCalled();
  });
});
