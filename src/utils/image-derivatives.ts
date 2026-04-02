import fs from 'node:fs';
import path from 'node:path';
import type { ImageMetadata } from 'astro';
import { shouldUsePublishedDerivativeUrls } from './image-delivery-mode.js';

export interface ImageDerivativeVariant {
  width: number;
  height: number;
  format: string;
  objectKey: string;
  url: string | null;
}

export interface ImageDerivativeEntry {
  originalWidth: number;
  originalHeight: number;
  hash: string;
  variants: ImageDerivativeVariant[];
}

export type DerivativeAwareImageMetadata = ImageMetadata & {
  __notiSourceKey?: string;
};

type ImageDerivativeManifest = Record<string, ImageDerivativeEntry>;

const manifestPath = path.resolve(process.cwd(), 'data', 'image-derivatives-manifest.json');

let manifestCache: ImageDerivativeManifest | null = null;

export const IMAGE_DERIVATIVE_WIDTHS = [400, 900, 1400];

export function loadImageDerivativeManifest(): ImageDerivativeManifest {
  if (manifestCache) {
    return manifestCache;
  }

  if (!fs.existsSync(manifestPath)) {
    manifestCache = {};
    return manifestCache;
  }

  manifestCache = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ImageDerivativeManifest;
  return manifestCache;
}

export function getDerivativeSourceKey(image: unknown): string | null {
  if (
    typeof image === 'object' &&
    image !== null &&
    '__notiSourceKey' in image &&
    typeof (image as DerivativeAwareImageMetadata).__notiSourceKey === 'string'
  ) {
    return (image as DerivativeAwareImageMetadata).__notiSourceKey ?? null;
  }

  return null;
}

export function getImageDerivativeEntry(sourceKey: string | null): ImageDerivativeEntry | null {
  if (!sourceKey) return null;
  const manifest = loadImageDerivativeManifest();
  return manifest[sourceKey] ?? null;
}

export function hasPublishedDerivativeUrls(entry: ImageDerivativeEntry | null): boolean {
  if (!entry || !Array.isArray(entry.variants) || entry.variants.length === 0) {
    return false;
  }

  return entry.variants.some((variant) => typeof variant.url === 'string' && variant.url.length > 0);
}

export function isStrictDerivativeModeEnabled(): boolean {
  return shouldUsePublishedDerivativeUrls();
}

export function resolveDerivativeVariants(
  entry: ImageDerivativeEntry | null,
  requestedBreakpoints: number[]
): ImageDerivativeVariant[] {
  if (!entry || !Array.isArray(entry.variants)) {
    return [];
  }

  const variantsWithUrls = entry.variants.filter(
    (variant) => typeof variant.url === 'string' && variant.url.length > 0
  );

  if (variantsWithUrls.length === 0) {
    return [];
  }

  if (requestedBreakpoints.length === 0) {
    return variantsWithUrls.sort((a, b) => a.width - b.width);
  }

  const requestedMax = Math.max(...requestedBreakpoints);
  const matching = variantsWithUrls.filter((variant) => variant.width <= requestedMax);
  const candidates = matching.length > 0 ? matching : variantsWithUrls;

  return candidates.sort((a, b) => a.width - b.width);
}

export function resolveDerivativeWidths(
  entry: ImageDerivativeEntry | null,
  requestedBreakpoints: number[]
): number[] {
  if (!entry || !Array.isArray(entry.variants) || entry.variants.length === 0) {
    return [];
  }

  const variantWidths = entry.variants.map((variant) => variant.width);
  if (requestedBreakpoints.length === 0) {
    return [...new Set(variantWidths)].sort((a, b) => a - b);
  }

  const requestedMax = Math.max(...requestedBreakpoints);
  const matching = variantWidths.filter((width) => width <= requestedMax);
  const widths = matching.length > 0 ? matching : variantWidths;

  return [...new Set(widths)].sort((a, b) => a - b);
}

export function selectPreferredVariantSrc(
  variants: { src: string; width: number }[],
  desiredWidth?: number
): string | null {
  if (variants.length === 0) return null;

  const sorted = [...variants].sort((a, b) => a.width - b.width);
  if (!desiredWidth) {
    return sorted[sorted.length - 1]?.src ?? null;
  }

  const candidate = sorted.find((variant) => variant.width >= desiredWidth);
  return candidate?.src ?? sorted[sorted.length - 1]?.src ?? null;
}

export function resetImageDerivativeManifestCache() {
  manifestCache = null;
}
