import { isUnpicCompatible, unpicOptimizer, astroAssetsOptimizer } from './images-optimization';
import type { ImageMetadata } from 'astro';
import type { OpenGraph } from '@astrolib/seo';
import type { ImagesOptimizer } from './images-optimization';
import { selectPreferredVariantSrc, type DerivativeAwareImageMetadata } from './image-derivatives';
import { getAsset } from './permalinks';
/** The optimized image shape returned by our ImagesOptimizer */
type OptimizedImage = Awaited<ReturnType<ImagesOptimizer>>[0];

const load = async function () {
  let images: Record<string, () => Promise<unknown>> | undefined = undefined;
  try {
    images = import.meta.glob([
      '~/assets/images/**/*.{jpeg,jpg,png,tiff,webp,avif,gif,svg,JPEG,JPG,PNG,TIFF,WEBP,AVIF,GIF,SVG}',
      '!~/assets/images/noti-logo.jpg',
    ]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // continue regardless of error
  }
  return images;
};

let _images: Record<string, () => Promise<unknown>> | undefined = undefined;

/** */
export const fetchLocalImages = async () => {
  _images = _images ?? (await load());
  return _images;
};

/** */
import { normalizeImage } from './normalizeImage';

const shouldIgnorePath = (imagePath: string): boolean => {
  const normalized = normalizeImage(imagePath);
  if (!normalized) return true;
  
  if (normalized.kind === 'remote') return true;
  
  // Local paths that are not assets
  if (normalized.src.startsWith('/')) {
      // If it starts with /, it's a public asset or root relative. 
      // The original logic ignored entries starting with /.
      // check if it's explicitly ~/assets
      return !normalized.src.startsWith('~/assets/images');
  }
  
  return !normalized.src.startsWith('~/assets/images');
};

const resolveImageKey = (imagePath: string): string => {
  // Use centralized Normalizer first
  const normalized = normalizeImage(imagePath);
  if (normalized && normalized.kind === 'local' && normalized.src.startsWith('~/')) {
      return normalized.src.replace('~/', '/src/');
  }
  return imagePath;
};

const resolveImageFromCollection = async (
  key: string,
  images: Record<string, () => Promise<unknown>> | undefined
): Promise<ImageMetadata | null> => {
  if (!images || typeof images[key] !== 'function') {
    return null;
  }
  const module = await images[key]();
  if (typeof module === 'object' && module !== null && 'default' in module) {
      const image = (module as { default: ImageMetadata }).default;
      return {
        ...image,
        __notiSourceKey: key.replace('/src/', '~/'),
      } as DerivativeAwareImageMetadata;
  }
  return null;
};

/** */
export const findImage = async (
  imagePath?: string | ImageMetadata | null
): Promise<string | ImageMetadata | undefined | null> => {
  // Return early if not a string
  if (typeof imagePath !== 'string') {
    return imagePath;
  }

  // Check if path should be ignored (absolute, external, or outside assets)
  if (shouldIgnorePath(imagePath)) {
    return imagePath;
  }

  const images = await fetchLocalImages();
  const key = resolveImageKey(imagePath);

  return resolveImageFromCollection(key, images);
};

/** */
export const resolveImageUrl = async (
  imagePath?: string | ImageMetadata | null,
  { width = 400, height }: { width?: number; height?: number } = {}
): Promise<string | null> => {
  const resolvedImage = await findImage(imagePath);

  if (!resolvedImage) {
    return null;
  }

  if (typeof resolvedImage === 'string') {
    if (resolvedImage.startsWith('/')) {
      return getAsset(resolvedImage);
    }

    return resolvedImage;
  }

  const optimizedImages = await astroAssetsOptimizer(resolvedImage, [width], width, height);
  const preferredSrc = selectPreferredVariantSrc(
    optimizedImages.map((image) => ({
      src: image.src,
      width: image.width,
    })),
    width
  );

  return preferredSrc ?? resolvedImage.src;
};

/** */
const optimizeOpenGraphImage = async (image: { url?: string } | undefined, astroSite: URL | undefined) => {
  const defaultWidth = 1200;
  const defaultHeight = 626;

  if (image?.url) {
    const resolvedImage = await findImage(image.url);
    if (!resolvedImage) {
      return {
        url: '',
      };
    }

    if (typeof resolvedImage === 'string' && resolvedImage.startsWith('/')) {
      return {
        url: String(new URL(getAsset(resolvedImage), astroSite)),
      };
    }

    let _image: OptimizedImage | undefined;

    if (
      typeof resolvedImage === 'string' &&
      (resolvedImage.startsWith('http://') || resolvedImage.startsWith('https://')) &&
      isUnpicCompatible(resolvedImage)
    ) {
      _image = (await unpicOptimizer(resolvedImage, [defaultWidth], defaultWidth, defaultHeight, 'jpg'))[0];
    } else if (resolvedImage) {
      const dimensions =
        typeof resolvedImage !== 'string' && resolvedImage?.width <= defaultWidth
          ? [resolvedImage?.width, resolvedImage?.height]
          : [defaultWidth, defaultHeight];
      _image = (await astroAssetsOptimizer(resolvedImage, [dimensions[0]], dimensions[0], dimensions[1], 'jpg'))[0];
    }

    if (typeof _image === 'object') {
      return {
        url: 'src' in _image && typeof _image.src === 'string' ? String(new URL(_image.src, astroSite)) : '',
        width: 'width' in _image && typeof _image.width === 'number' ? _image.width : undefined,
        height: 'height' in _image && typeof _image.height === 'number' ? _image.height : undefined,
      };
    }
    return {
      url: '',
    };
  }

  return {
    url: '',
  };
};

/** */
export const adaptOpenGraphImages = async (
  openGraph: OpenGraph = {},
  astroSite: URL | undefined = new URL('')
): Promise<OpenGraph> => {
  if (!openGraph?.images?.length) {
    return openGraph;
  }

  const images = openGraph.images;

  const adaptedImages = await Promise.all(images.map(async (image: { url?: string } | undefined) => optimizeOpenGraphImage(image, astroSite)));

  return { ...openGraph, ...(adaptedImages ? { images: adaptedImages } : {}) };
};
