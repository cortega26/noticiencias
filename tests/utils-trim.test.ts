import { describe, expect, it, vi } from 'vitest';

vi.mock('astrowind:config', () => ({
  I18N: { language: 'es' },
}));

import { trim } from '../src/utils/utils';

describe('trim', () => {
  it('does nothing when called with no character to trim (no whitespace default)', () => {
    // `trim` compares each edge char against `ch`; with `ch` undefined,
    // no character (not even whitespace) ever matches, so the string
    // passes through unchanged. Callers that want whitespace trimming
    // must use String.prototype.trim() directly.
    expect(trim('  hello  ')).toBe('  hello  ');
  });

  it('trims a custom character from both ends', () => {
    expect(trim('/blog/', '/')).toBe('blog');
  });

  it('trims only the leading run when the trailing side has no match', () => {
    expect(trim('//blog', '/')).toBe('blog');
  });

  it('returns the original string when nothing matches', () => {
    expect(trim('blog', '/')).toBe('blog');
  });

  it('returns an empty string for the default empty input', () => {
    expect(trim()).toBe('');
  });
});
