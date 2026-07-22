import { describe, expect, it } from 'vitest';
import { getRelativeUrlByFilePath } from '../src/utils/directories';

describe('getRelativeUrlByFilePath', () => {
  it('strips the project src folder prefix from an absolute path', () => {
    const withinSrc = `${process.cwd()}/src/pages/example.astro`;
    expect(getRelativeUrlByFilePath(withinSrc)).toBe('/pages/example.astro');
  });

  it('leaves a path with no src-folder prefix unchanged', () => {
    const outsideSrc = '/some/other/place/file.astro';
    expect(getRelativeUrlByFilePath(outsideSrc)).toBe(outsideSrc);
  });
});
