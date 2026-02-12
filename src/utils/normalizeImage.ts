
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
  const obj = input as any;

  // 2a: NormalizedImage shape (already normalized)
  if ('kind' in obj && 'src' in obj) {
    return obj as NormalizedImage;
  }

  const result: NormalizedImage = {
    src: '',
    alt: '',
    kind: 'remote',
  };

  // 2b: Astro ImageMetadata (width, height, src, format)
  if ('src' in obj && 'width' in obj && 'height' in obj) {
    result.src = obj.src;
    result.width = obj.width;
    result.height = obj.height;
    result.kind = 'local'; // Astro imported images are local/bundled
    return result;
  }

  // 2c: Backend Object wrapper { src, alt, width, height }
  if (obj.src) result.src = obj.src;
  if (obj.alt) result.alt = obj.alt;
  if (obj.width) result.width = Number(obj.width);
  if (obj.height) result.height = Number(obj.height);

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
