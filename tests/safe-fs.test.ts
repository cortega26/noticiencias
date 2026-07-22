import { describe, expect, it } from 'vitest';
import { safeRead, safeReadDir, safeResolve } from '../src/utils/safeFs';

describe('safeResolve', () => {
  it('resolves a relative path against the process working directory', () => {
    expect(safeResolve('src')).toBe(`${process.cwd()}/src`);
  });

  it('rejects a path-traversal attempt that escapes the project root', () => {
    expect(() => safeResolve('../../etc/passwd')).toThrow('Path traversal attempt');
  });

  it('rejects an absolute path outside the project root', () => {
    expect(() => safeResolve('/etc/passwd')).toThrow('Path traversal attempt');
  });
});

describe('safeRead / safeReadDir', () => {
  it('reads a known file within the project root', () => {
    const content = safeRead('package.json');
    expect(content).toContain('"name"');
  });

  it('lists a known directory within the project root', () => {
    const entries = safeReadDir('src');
    expect(entries.length).toBeGreaterThan(0);
  });

  it('propagates the traversal guard when reading outside the root', () => {
    expect(() => safeRead('../../etc/passwd')).toThrow('Path traversal attempt');
  });
});
