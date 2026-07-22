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

  it('returns {error} and does not throw when the fetch itself fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await sendWebhookNotification({
      webhookUrl: 'https://backend.example/webhook',
      payload: {},
      fetchImpl,
    });

    expect(result).toEqual({ error: 'network down' });
  });

  it('reports a non-ok response without throwing', async () => {
    const fetchImpl = fakeFetch(500, { error: 'boom' });
    const result = await sendWebhookNotification({
      webhookUrl: 'https://backend.example/webhook',
      payload: {},
      fetchImpl,
    });

    expect(result).toEqual({ ok: false, status: 500 });
  });
});
