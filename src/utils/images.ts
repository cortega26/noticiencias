import { isUnpicCompatible, unpicOptimizer, astroAssetsOptimizer } from './images-optimization';
import type { ImageMetadata } from 'astro';
import type { OpenGraph } from '@astrolib/seo';
import type { ImagesOptimizer } from './images-optimization';
/** The optimized image shape returned by our ImagesOptimizer */
type OptimizedImage = Awaited<ReturnType<ImagesOptimizer>>[0];

const load = async function () {
  let images: Record<string, () => Promise<unknown>> | undefined = undefined;
  try {
    images = import.meta.glob('~/assets/images/**/*.{jpeg,jpg,png,tiff,webp,gif,svg,JPEG,JPG,PNG,TIFF,WEBP,GIF,SVG}');
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
const shouldIgnorePath = (imagePath: string): boolean => {
  return (
    imagePath.startsWith('http://') ||
    imagePath.startsWith('https://') ||
    imagePath.startsWith('/') ||
    !imagePath.startsWith('~/assets/images')
  );
};

const resolveImageKey = (imagePath: string): string => {
  if (imagePath.startsWith('~/')) {
    return imagePath.replace('~/', '/src/');
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
  const module = (await images[key]()) as { default: ImageMetadata };
  return module.default;
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
export const adaptOpenGraphImages = async (
  openGraph: OpenGraph = {},
  astroSite: URL | undefined = new URL('')
): Promise<OpenGraph> => {
  if (!openGraph?.images?.length) {
    return openGraph;
  }

  const images = openGraph.images;
  const defaultWidth = 1200;
  const defaultHeight = 626;

  const adaptedImages = await Promise.all(
    images.map(async (image) => {
      if (image?.url) {
        const resolvedImage = (await findImage(image.url));
        if (!resolvedImage) {
          return {
            url: '',
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
    })
  );

  return { ...openGraph, ...(adaptedImages ? { images: adaptedImages } : {}) };
};
