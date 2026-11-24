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

  it('passes through exact publication-attempt references unchanged', () => {
    const refs = [
      {
        refinery_id: 'refinery-1',
        pull_request_number: 42,
        content_sha256: 'a'.repeat(64),
      },
    ];
    const envelope = buildEnvelope({
      event: 'publish_complete',
      status: 'success',
      diagnostics: { check: 'deploy', status: 'pass' },
      publicationIds: ['refinery-1'],
      publicationAttemptRefs: refs,
      githubEnv,
    });

    expect(envelope.publication_attempt_refs).toEqual(refs);
  });

  it('defaults publication_ids to an empty array when omitted', () => {
    const envelope = buildEnvelope({
      event: 'publish_complete',
      status: 'success',
      diagnostics: { check: 'deploy', status: 'pass' },
      githubEnv,
    });

    expect(envelope.publication_ids).toEqual([]);
    expect(envelope.publication_attempt_refs).toEqual([]);
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

    expect(envelope.delivery_id).toMatch(/^v2:[a-f0-9]{64}$/);
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
    const first = buildEnvelope({
      event: 'publish_complete',
      status: 'success',
      diagnostics: { check: 'deploy', status: 'pass' },
      githubEnv,
    });
    const second = buildEnvelope({
      event: 'publish_complete',
      status: 'success',
      diagnostics: { check: 'deploy', status: 'pass' },
      githubEnv,
    });

    expect(first.delivery_id).toBe(second.delivery_id);
  });

  it('deduplicates equivalent evidence and identifies corrected attempts separately', () => {
    const evidence = {
      event: 'publish_complete',
      status: 'success',
      diagnostics: [{ check: 'deploy', status: 'pass' }],
      publicationIds: ['a', 'b'],
      githubEnv,
    };
    const refs = [
      { refinery_id: 'a', pull_request_number: 10, content_sha256: 'a'.repeat(64) },
      { refinery_id: 'b', pull_request_number: 11, content_sha256: 'b'.repeat(64) },
    ];
    const original = buildEnvelope(evidence);
    const corrected = buildEnvelope({ ...evidence, publicationAttemptRefs: refs });
    const reordered = buildEnvelope({
      ...evidence,
      publicationIds: ['b', 'a'],
      publicationAttemptRefs: [...refs].reverse(),
      diagnostics: [{ status: 'pass', check: 'deploy' }],
    });
    expect(corrected.delivery_id).not.toBe(original.delivery_id);
    expect(reordered.delivery_id).toBe(corrected.delivery_id);
    expect(
      buildEnvelope({
        ...evidence,
        publicationAttemptRefs: [{ ...refs[0], content_sha256: 'c'.repeat(64) }, refs[1]],
      }).delivery_id
    ).not.toBe(corrected.delivery_id);
    expect(
      buildEnvelope({
        ...evidence,
        publicationAttemptRefs: refs,
        githubEnv: {
          ...githubEnv,
          GITHUB_REPOSITORY: 'other/repo',
        },
      }).delivery_id
    ).not.toBe(corrected.delivery_id);
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

    expect(result).toEqual({ ok: false, attempts: 3, error: 'Webhook transport error' });
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

  it.each([
    { statuses: [422], status: 422 },
    { statuses: [500, 500, 500], status: 500 },
  ])('writes a diagnostic artifact for terminal HTTP $status', async ({ statuses, status }) => {
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
        fetchImpl: fakeFetchSequence(statuses),
        sleepImpl: noSleep,
        failureArtifactPath: artifact,
      });

      expect(result).toEqual({
        ok: false,
        status,
        attempts: statuses.length,
        artifactWritten: true,
      });
      const record = JSON.parse(readFileSync(artifact, 'utf-8'));
      expect(record.event).toBe('publish_complete');
      expect(record.delivery_id).toMatch(/^v2:[a-f0-9]{64}$/);
      expect(record.run_url).toBe('https://github.com/org/repo/actions/runs/999');
      expect(record.attempts).toBe(statuses.length);
      expect(record.status).toBe(status);
      expect(record.generated_at).toBeTruthy();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not write an artifact when a throttled request succeeds on retry', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'notify-artifact-ok-'));
    const artifact = join(dir, 'failure.json');

    try {
      await sendWebhookNotification({
        webhookUrl: 'https://backend.example/webhook',
        payload: {},
        fetchImpl: fakeFetchSequence([429, 202]),
        sleepImpl: noSleep,
        failureArtifactPath: artifact,
      });

      expect(existsSync(artifact)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports a write failure without replacing the delivery outcome', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'notify-artifact-write-error-'));
    try {
      const result = await sendWebhookNotification({
        webhookUrl: 'https://backend.example/webhook',
        payload: {},
        fetchImpl: fakeFetch(422),
        failureArtifactPath: dir,
      });
      expect(result).toEqual({ ok: false, status: 422, attempts: 1, artifactWritten: false });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps transport diagnostics bounded and excludes request and exception details', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'notify-artifact-transport-'));
    const artifact = join(dir, 'failure.json');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const detail = 'private transport detail';
      const result = await sendWebhookNotification({
        webhookUrl: 'https://backend.example/webhook',
        webhookToken: 'fixture-private-token',
        payload: { diagnostics: ['private request data'] },
        fetchImpl: vi.fn().mockRejectedValue(new Error(detail)),
        maxAttempts: 1,
        failureArtifactPath: artifact,
      });
      expect(result).toEqual({
        ok: false,
        attempts: 1,
        error: 'Webhook transport error',
        artifactWritten: true,
      });
      const output = readFileSync(artifact, 'utf8') + JSON.stringify(log.mock.calls);
      expect(output).not.toMatch(/private|backend\.example/);
    } finally {
      log.mockRestore();
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
