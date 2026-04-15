import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  getImageDeliveryMode,
  shouldUsePublishedDerivativeUrls,
} from '../src/utils/image-delivery-mode.js';

import {
  MANIFEST_PATH,
  buildPublicUrl,
  collectLocalPostImageSources,
  computeContentHash,
  computeVariantHeight,
  computeVariantWidths,
  deriveObjectKey,
  getAssetImagePathFromSourceKey,
  getImageMetadata,
  loadManifest,
  writeManifest,
} from './utils/image-derivatives.js';

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const R2_ENDPOINT = process.env.R2_ENDPOINT || '';
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL || 'https://www.cdn.noticiencias.com';
const imageDeliveryMode = getImageDeliveryMode();

const hasUploadConfig = Boolean(
  R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_ENDPOINT && R2_PUBLIC_BASE_URL
);

function createClient() {
  if (!hasUploadConfig || !shouldUsePublishedDerivativeUrls(imageDeliveryMode)) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

async function objectExists(client, key) {
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

async function uploadVariant(client, absPath, width, objectKey) {
  const body = await sharp(absPath)
    .resize({ width, withoutEnlargement: true })
    .avif({ quality: 55 })
    .toBuffer();

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      Body: body,
      ContentType: 'image/avif',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
}

async function buildManifestEntry(sourceKey, client) {
  const absPath = getAssetImagePathFromSourceKey(sourceKey);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Local source image not found: ${absPath}`);
  }

  const { width: originalWidth, height: originalHeight } = await getImageMetadata(absPath);
  const hash = computeContentHash(absPath);
  const variantWidths = computeVariantWidths(originalWidth);

  const variants = [];
  for (const width of variantWidths) {
    const height = computeVariantHeight(originalWidth, originalHeight, width);
    const objectKey = deriveObjectKey(sourceKey, hash, width, 'avif');
    const url = buildPublicUrl(R2_PUBLIC_BASE_URL, objectKey);

    if (client) {
      const exists = await objectExists(client, objectKey);
      if (!exists) {
        await uploadVariant(client, absPath, width, objectKey);
      }
    }

    variants.push({
      width,
      height,
      format: 'avif',
      objectKey,
      url,
    });
  }

  return {
    originalWidth,
    originalHeight,
    hash,
    variants,
  };
}

async function main() {
  const client = createClient();
  const existingManifest = loadManifest();
  const nextManifest = {};
  const sourceKeys = collectLocalPostImageSources();

  for (const sourceKey of sourceKeys) {
    nextManifest[sourceKey] = await buildManifestEntry(sourceKey, client);
  }

  const changed = writeManifest(nextManifest);
  const uploadMode = client
    ? 'upload-enabled'
    : imageDeliveryMode === 'github'
      ? 'github-local-only'
      : 'manifest-only';

  console.log(
    `Image derivative publish completed for ${sourceKeys.length} source image(s) in ${uploadMode} mode (delivery=${imageDeliveryMode}).`
  );

  if (changed) {
    console.log(`Updated manifest: ${path.relative(process.cwd(), MANIFEST_PATH)}`);
  } else {
    console.log('Manifest already up to date.');
  }

  const removedKeys = Object.keys(existingManifest).filter((key) => !(key in nextManifest));
  if (removedKeys.length > 0) {
    console.log(
      `Dropped ${removedKeys.length} stale manifest entr${removedKeys.length === 1 ? 'y' : 'ies'}.`
    );
  }

  if (!client && imageDeliveryMode === 'github') {
    console.warn(
      'GitHub image delivery mode is active; skipping R2 derivative existence checks and uploads.'
    );
  } else if (!client) {
    console.warn(
      'R2 upload skipped because one or more env vars are missing: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT, R2_PUBLIC_BASE_URL.'
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
