import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildEnvelope, sendWebhookNotification } from '../scripts/backend-notify.js';

const githubEnv = {
  GITHUB_SHA: 'abc123',
  GITHUB_REF_NAME: 'main',
  GITHUB_REPOSITORY: 'org/repo',
  GITHUB_RUN_ID: '999',
};

function fakeFetch(status = 202, body: unknown = { accepted: true }) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
}

function fakeFetchSequence(statuses: number[]) {
  const impl = vi.fn();
  for (const status of statuses) {
    impl.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify({ status }),
    });
  }
  return impl;
}

const noSleep = vi.fn().mockResolvedValue(undefined);

describe('buildEnvelope', () => {
  it('wraps a single diagnostic object as a one-element diagnostics array', () => {
    const envelope = buildEnvelope({
      event: 'publish_complete',
      status: 'success',
      diagnostics: { check: 'deploy', status: 'pass' },
      publicationIds: [],
      githubEnv,
    });

    expect(envelope.diagnostics).toEqual([{ check: 'deploy', status: 'pass' }]);
    expect(envelope.commit_sha).toBe('abc123');
    expect(envelope.branch).toBe('main');
    expect(envelope.run_url).toBe('https://github.com/org/repo/actions/runs/999');
    expect(envelope.publication_ids).toEqual([]);
  });

  it('preserves an already-array diagnostics payload without double-wrapping', () => {
    const envelope = buildEnvelope({
      event: 'validation_result',
      status: 'fail',
      diagnostics: [
        { check: 'a', status: 'pass' },
        { check: 'b', status: 'fail' },
      ],
      publicationIds: [],
      githubEnv,
    });

    expect(envelope.diagnostics).toEqual([
      { check: 'a', status: 'pass' },
      { check: 'b', status: 'fail' },
    ]);
  });

  it('passes through publication_ids unchanged', () => {
    const envelope = buildEnvelope({
      event: 'publish_complete',
      status: 'success',
      diagnostics: { check: 'deploy', status: 'pass' },
      publicationIds: ['refinery-1', 'refinery-2'],
      githubEnv,
    });

    expect(envelope.publication_ids).toEqual(['refinery-1', 'refinery-2']);
  });

  it('defaults publication_ids to an empty array when omitted', () => {
    const envelope = buildEnvelope({
      event: 'publish_complete',
      status: 'success',
      diagnostics: { check: 'deploy', status: 'pass' },
      githubEnv,
    });

    expect(envelope.publication_ids).toEqual([]);
  });
});

describe('buildEnvelope delivery_id', () => {
  it('emits a versioned delivery id when a run id is present', () => {
    const envelope = buildEnvelope({
      event: 'publish_complete',
      status: 'success',
      diagnostics: { check: 'deploy', status: 'pass' },
      githubEnv,
    });

    expect(envelope.delivery_id).toBe('v1:999:publish_complete');
  });

  it('omits delivery_id without a real run id so the backend derives its own key', () => {
    const envelope = buildEnvelope({
      event: 'validation_result',
      status: 'fail',
      diagnostics: { check: 'x', status: 'fail' },
      githubEnv: { ...githubEnv, GITHUB_RUN_ID: undefined },
    });

    expect(envelope.delivery_id).toBeUndefined();
  });

  it('is stable across repeated builds of the same run and event', () => {
    const build = () =>
      buildEnvelope({
        event: 'publish_complete',
        status: 'success',
        diagnostics: { check: 'deploy', status: 'pass' },
        githubEnv,
      });

    expect(build().delivery_id).toBe(build().delivery_id);
  });

  it('differs per event within the same run', () => {
    const first = buildEnvelope({
      event: 'publish_complete',
      status: 'success',
      diagnostics: [],
      githubEnv,
    });
    const second = buildEnvelope({
      event: 'validation_result',
      status: 'fail',
      diagnostics: [],
      githubEnv,
    });

    expect(first.delivery_id).not.toBe(second.delivery_id);
  });
});

describe('sendWebhookNotification', () => {
  it('sends an Authorization bearer header when a token is provided', async () => {
    const fetchImpl = fakeFetch(202);
    await sendWebhookNotification({
      webhookUrl: 'https://backend.example/webhook',
      webhookToken: 'super-secret-token',
      payload: { hello: 'world' },
      fetchImpl,
    });

    const [, requestInit] = fetchImpl.mock.calls[0];
    expect(requestInit.headers.Authorization).toBe('Bearer super-secret-token');
  });

  it('sends no Authorization header when no token is provided', async () => {
    const fetchImpl = fakeFetch(202);
    await sendWebhookNotification({
      webhookUrl: 'https://backend.example/webhook',
      payload: { hello: 'world' },
      fetchImpl,
    });

    const [, requestInit] = fetchImpl.mock.calls[0];
    expect(requestInit.headers.Authorization).toBeUndefined();
  });

  it('sends the exact JSON-serialized payload as the request body', async () => {
    const fetchImpl = fakeFetch(202);
    const payload = { event: 'publish_complete', publication_ids: ['a', 'b'] };
    await sendWebhookNotification({
      webhookUrl: 'https://backend.example/webhook',
      payload,
      fetchImpl,
    });

    const [url, requestInit] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://backend.example/webhook');
    expect(requestInit.method).toBe('POST');
    expect(JSON.parse(requestInit.body)).toEqual(payload);
  });

  it('skips sending and returns {skipped: true} when webhookUrl is empty', async () => {
    const fetchImpl = fakeFetch(202);
    const result = await sendWebhookNotification({
      webhookUrl: '',
      payload: {},
      fetchImpl,
    });

    expect(result).toEqual({ skipped: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never logs the webhook token value', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = fakeFetch(202);

    await sendWebhookNotification({
      webhookUrl: 'https://backend.example/webhook',
      webhookToken: 'super-secret-token-xyz',
      payload: {},
      fetchImpl,
    });

    const allLoggedText = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().join(' ');
    expect(allLoggedText).not.toContain('super-secret-token-xyz');

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('returns {error} after exhausting retries and does not throw when fetch always fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await sendWebhookNotification({
      webhookUrl: 'https://backend.example/webhook',
      payload: {},
      fetchImpl,
      sleepImpl: noSleep,
    });

    expect(result).toEqual({ ok: false, attempts: 3, error: 'network down' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('retries 5xx and reports the final status without throwing', async () => {
    const fetchImpl = fakeFetch(500, { error: 'boom' });
    const result = await sendWebhookNotification({
      webhookUrl: 'https://backend.example/webhook',
      payload: {},
      fetchImpl,
      sleepImpl: noSleep,
    });

    expect(result).toEqual({ ok: false, status: 500, attempts: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('sendWebhookNotification retries and diagnostics', () => {
  it('retries transient 5xx with exponential backoff until success', async () => {
    const fetchImpl = fakeFetchSequence([500, 503, 202]);
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    const result = await sendWebhookNotification({
      webhookUrl: 'https://backend.example/webhook',
      payload: {},
      fetchImpl,
      sleepImpl,
      baseDelayMs: 1000,
    });

    expect(result).toEqual({ ok: true, status: 202, attempts: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleepImpl.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000]);
  });

  it('retries 429 but not other deterministic 4xx', async () => {
    const throttled = fakeFetchSequence([429, 202]);
    const retried = await sendWebhookNotification({
      webhookUrl: 'https://backend.example/webhook',
      payload: {},
      fetchImpl: throttled,
      sleepImpl: noSleep,
    });
    expect(retried).toEqual({ ok: true, status: 202, attempts: 2 });

    const rejected = fakeFetchSequence([422, 202]);
    const sleepImpl = vi.fn();
    const deterministic = await sendWebhookNotification({
      webhookUrl: 'https://backend.example/webhook',
      payload: {},
      fetchImpl: rejected,
      sleepImpl,
    });
    expect(deterministic).toEqual({ ok: false, status: 422, attempts: 1 });
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(sleepImpl).not.toHaveBeenCalled();
  });

  it('retries a network error and can recover', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, status: 202, text: async () => '{}' });

    const result = await sendWebhookNotification({
      webhookUrl: 'https://backend.example/webhook',
      payload: {},
      fetchImpl,
      sleepImpl: noSleep,
    });

    expect(result).toEqual({ ok: true, status: 202, attempts: 2 });
  });

  it('writes a diagnostic artifact only after the final failed attempt', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'notify-artifact-'));
    const artifact = join(dir, 'failure.json');
    const payload = buildEnvelope({
      event: 'publish_complete',
      status: 'success',
      diagnostics: { check: 'deploy', status: 'pass' },
      githubEnv,
    });

    try {
      const result = await sendWebhookNotification({
        webhookUrl: 'https://backend.example/webhook',
        payload,
        fetchImpl: fakeFetchSequence([500, 500, 500]),
        sleepImpl: noSleep,
        failureArtifactPath: artifact,
      });

      expect(result).toEqual({ ok: false, status: 500, attempts: 3 });
      const record = JSON.parse(readFileSync(artifact, 'utf-8'));
      expect(record.event).toBe('publish_complete');
      expect(record.delivery_id).toBe('v1:999:publish_complete');
      expect(record.run_url).toBe('https://github.com/org/repo/actions/runs/999');
      expect(record.attempts).toBe(3);
      expect(record.status).toBe(500);
      expect(record.generated_at).toBeTruthy();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not write an artifact on success', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'notify-artifact-ok-'));
    const artifact = join(dir, 'failure.json');

    try {
      await sendWebhookNotification({
        webhookUrl: 'https://backend.example/webhook',
        payload: {},
        fetchImpl: fakeFetch(202),
        failureArtifactPath: artifact,
      });

      expect(existsSync(artifact)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('honors BACKEND_WEBHOOK_MAX_ATTEMPTS from the environment', async () => {
    vi.stubEnv('BACKEND_WEBHOOK_MAX_ATTEMPTS', '1');
    try {
      const fetchImpl = fakeFetchSequence([500]);
      const result = await sendWebhookNotification({
        webhookUrl: 'https://backend.example/webhook',
        payload: {},
        fetchImpl,
        sleepImpl: noSleep,
      });
      expect(result).toEqual({ ok: false, status: 500, attempts: 1 });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
