import { describe, expect, it } from 'vitest';
import loadConfig, { safeYamlLoad } from '../src/integration/utils/loadConfig';

describe('safeYamlLoad', () => {
  it('parses a YAML object', () => {
    expect(safeYamlLoad('name: Noticiencias\nbase: /')).toEqual({
      name: 'Noticiencias',
      base: '/',
    });
  });

  it('rejects empty YAML', () => {
    expect(() => safeYamlLoad('')).toThrow('Invalid YAML: empty');
  });

  it('rejects YAML that parses to a non-object (a bare scalar)', () => {
    expect(() => safeYamlLoad('just-a-string')).toThrow(
      'Invalid YAML: expected object, got string'
    );
  });
});

describe('loadConfig', () => {
  it('passes an already-parsed object straight through', async () => {
    const data = { site: { name: 'X' } };
    await expect(loadConfig(data)).resolves.toBe(data);
  });

  it('reads and YAML-parses a .yaml file path via the safe-fs guard', async () => {
    const result = await loadConfig('src/config.yaml');
    expect(result).toMatchObject({ site: expect.any(Object) });
  });

  it('propagates the safe-fs traversal guard for a path outside the project root', async () => {
    await expect(loadConfig('../../etc/passwd')).rejects.toThrow('Path traversal attempt');
  });
});
