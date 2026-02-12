
export interface NormalizedImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  loading?: 'eager' | 'lazy';
  decoding?: 'async' | 'sync' | 'auto';
  kind: 'local' | 'remote';
}

const normalizeStringImage = (input: string): NormalizedImage => {
  const result: NormalizedImage = {
    src: input,
    alt: '',
    kind: 'remote',
  };

  if (input.startsWith('~/')) {
    result.kind = 'local';
  } else if (input.startsWith('/') && !input.startsWith('//')) {
    result.kind = 'local';
  }

  return result;
};

const normalizeObjectImage = (input: object): NormalizedImage => {
  // 2a: NormalizedImage shape (already normalized)
  if ('kind' in input && 'src' in input) {
    return input as NormalizedImage;
  }

  const result: NormalizedImage = {
    src: '',
    alt: '',
    kind: 'remote',
  };

  // 2b: Astro ImageMetadata (width, height, src, format)
  if ('src' in input && 'width' in input && 'height' in input) {
    const src = (input as { src: string }).src;
    const width = (input as { width: number }).width;
    const height = (input as { height: number }).height;
    
    result.src = src;
    result.width = width;
    result.height = height;
    result.kind = 'local'; // Astro imported images are local/bundled
    return result;
  }

  // 2c: Backend Object wrapper { src, alt, width, height }
  if ('src' in input) result.src = String((input as { src: unknown }).src);
  if ('alt' in input) result.alt = String((input as { alt: unknown }).alt);
  if ('width' in input) result.width = Number((input as { width: unknown }).width);
  if ('height' in input) result.height = Number((input as { height: unknown }).height);

  if (result.src.startsWith('~/') || result.src.startsWith('/')) {
    result.kind = 'local';
  }

  return result;
};

export function normalizeImage(input: unknown): NormalizedImage | null {
  if (!input) return null;

  let result: NormalizedImage | null = null;

  if (typeof input === 'string') {
    result = normalizeStringImage(input);
  } else if (typeof input === 'object') {
    result = normalizeObjectImage(input);
  }

  if (!result) return null;

  // Heuristics for Alt (if missing)
  if (!result.alt) {
    result.alt = '';
  }

  return result;
}
