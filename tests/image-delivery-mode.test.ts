import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_IMAGE_DELIVERY_MODE,
  parseImageDeliveryMode,
  readImageDeliveryModeConfig,
  shouldUsePublishedDerivativeUrls,
  writeImageDeliveryModeConfig,
} from '../src/utils/image-delivery-mode.js';

describe('image delivery mode config', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('defaults to r2 when the config file is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noti-image-mode-'));
    tempDirs.push(tempDir);

    expect(readImageDeliveryModeConfig(path.join(tempDir, 'missing.json')).mode).toBe(
      DEFAULT_IMAGE_DELIVERY_MODE
    );
  });

  it('writes and reads tracked delivery modes', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noti-image-mode-'));
    tempDirs.push(tempDir);
    const configPath = path.join(tempDir, 'image-delivery-mode.json');

    expect(writeImageDeliveryModeConfig('github', configPath)).toBe(true);
    expect(readImageDeliveryModeConfig(configPath).mode).toBe('github');
    expect(writeImageDeliveryModeConfig('github', configPath)).toBe(false);
  });

  it('rejects unsupported delivery modes', () => {
    expect(() => parseImageDeliveryMode('edge')).toThrow('Unsupported image delivery mode');
  });

  it('only enables published derivative urls in r2 mode', () => {
    expect(shouldUsePublishedDerivativeUrls('r2')).toBe(true);
    expect(shouldUsePublishedDerivativeUrls('github')).toBe(false);
  });
});
