import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {'r2' | 'github'} ImageDeliveryMode
 */

export const IMAGE_DELIVERY_MODE_PATH = path.resolve(
  process.cwd(),
  'data',
  'image-delivery-mode.json'
);

export const DEFAULT_IMAGE_DELIVERY_MODE = 'r2';

/**
 * @param {unknown} mode
 * @returns {ImageDeliveryMode}
 */
export function parseImageDeliveryMode(mode) {
  if (mode === 'r2' || mode === 'github') {
    return mode;
  }

  throw new Error(`Unsupported image delivery mode: ${String(mode)}`);
}

/**
 * @param {string} [filePath]
 * @returns {{ mode: ImageDeliveryMode }}
 */
export function readImageDeliveryModeConfig(filePath = IMAGE_DELIVERY_MODE_PATH) {
  if (!fs.existsSync(filePath)) {
    return { mode: DEFAULT_IMAGE_DELIVERY_MODE };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid image delivery mode config: ${filePath}`);
  }

  return {
    mode: parseImageDeliveryMode(parsed.mode),
  };
}

/**
 * @param {ImageDeliveryMode} mode
 * @param {string} [filePath]
 * @returns {boolean}
 */
export function writeImageDeliveryModeConfig(mode, filePath = IMAGE_DELIVERY_MODE_PATH) {
  const nextMode = parseImageDeliveryMode(mode);
  const serialized = `${JSON.stringify({ mode: nextMode }, null, 2)}\n`;
  const previous = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;

  if (previous === serialized) {
    return false;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, serialized, 'utf8');
  return true;
}

/**
 * @returns {ImageDeliveryMode}
 */
export function getImageDeliveryMode() {
  return readImageDeliveryModeConfig().mode;
}

/**
 * @param {ImageDeliveryMode} [mode]
 * @returns {boolean}
 */
export function shouldUsePublishedDerivativeUrls(mode = getImageDeliveryMode()) {
  return parseImageDeliveryMode(mode) === 'r2';
}
