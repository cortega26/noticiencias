import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from '../src/utils/json-ld';

describe('serializeJsonLd', () => {
  it('produces JSON that JSON.parse can read back unchanged', () => {
    const data = { headline: 'A <script> tag & "quotes"' };
    const serialized = serializeJsonLd(data);
    expect(JSON.parse(serialized)).toEqual(data);
  });

  it('escapes the closing </script> sequence so it cannot break out of an inline script', () => {
    const serialized = serializeJsonLd({
      excerpt: 'before</script><script>alert(1)</script>after',
    });
    expect(serialized).not.toContain('</script>');
    expect(serialized).toContain('\\u003C/script\\u003E');
  });

  it('escapes angle brackets and ampersands', () => {
    const serialized = serializeJsonLd({ a: '<b> & <c>' });
    expect(serialized).not.toMatch(/[<>&]/);
  });

  it('escapes U+2028/U+2029 line/paragraph separators that break JS string literals', () => {
    const original = 'line1 line2 line3';
    const serialized = serializeJsonLd({ text: original });
    expect(serialized).toContain('\\u2028');
    expect(serialized).toContain('\\u2029');
    expect(serialized).not.toContain(' ');
    expect(serialized).not.toContain(' ');
    expect(JSON.parse(serialized)).toEqual({ text: original });
  });
});
