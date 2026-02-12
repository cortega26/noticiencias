
export interface NormalizedImage {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    loading?: 'eager' | 'lazy';
    decoding?: 'async' | 'sync' | 'auto';
    kind: 'local' | 'remote';
}

/**
 * Examples of inputs we need to handle:
 * 1. "~/assets/images/foo.jpg" (Raw backend export)
 * 2. "/src/assets/images/foo.jpg" (Already resolved path)
 * 3. "https://example.com/foo.jpg" (Remote)
 * 4. ImageMetadata object (Astro import)
 */
export function normalizeImage(input: unknown): NormalizedImage | null {
    if (!input) return null;

    // Default shapes
    const result: NormalizedImage = {
        src: '',
        alt: '',
        kind: 'remote'
    };

    // Case 1: Input is already a string
    if (typeof input === 'string') {
        result.src = input;
        
        // Detect Local Alias
        if (input.startsWith('~/')) {
            result.kind = 'local';
            // We expose the raw alias here? Or resolve it? 
            // The Astro Image component needs the alias to resolve the import, 
            // BUT standard <img> tags need the final path.
            // Requirement 4.1 says "Centralize resolution".
            // Since we use Astro's <Image> component mostly, we keep the alias for it to handle,
            // OR we resolve it if we are using standard tags.
            // Let's keep the alias intact for Astro's <Image /> to digest, 
            // but mark it as 'local' so components know.
        } else if (input.startsWith('/') && !input.startsWith('//')) {
             // Root relative (usually public/)
             result.kind = 'local';
        }
        
    } 
    // Case 2: Input is an object (Astro ImageMetadata or Custom Object)
    else if (typeof input === 'object') {
        const obj = input as any;
        
        // 2a: NormalizedImage shape (already normalized)
        if ('kind' in obj && 'src' in obj) {
            return obj as NormalizedImage;
        }

        // 2b: Astro ImageMetadata (width, height, src, format)
        if ('src' in obj && 'width' in obj && 'height' in obj) {
             result.src = obj.src;
             result.width = obj.width;
             result.height = obj.height;
             result.kind = 'local'; // Astro imported images are local/bundled
        } 
        // 2c: Backend Object wrapper { src, alt, width, height }
        else {
             if (obj.src) result.src = obj.src;
             if (obj.alt) result.alt = obj.alt;
             if (obj.width) result.width = Number(obj.width);
             if (obj.height) result.height = Number(obj.height);
             
             if (result.src.startsWith('~/') || result.src.startsWith('/')) {
                 result.kind = 'local';
             }
        }
    }

    // Heuristics for Alt (if missing)
    if (!result.alt) {
        // Fallback or leave empty? 
        // I-03 says "No alt='alt'". Empty string is better than bad alt.
        result.alt = ''; 
    }

    return result;
}
