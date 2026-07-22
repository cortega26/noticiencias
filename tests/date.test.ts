import { describe, expect, it, vi } from 'vitest';

vi.mock('astrowind:config', () => ({
  I18N: { language: 'es' },
}));

import { getFormattedDate } from '../src/utils/date';

describe('getFormattedDate', () => {
  it('returns an empty string for a falsy date', () => {
    expect(getFormattedDate(undefined as unknown as Date)).toBe('');
  });

  it('formats the default (compact) variant', () => {
    const result = getFormattedDate(new Date('2026-01-15T00:00:00Z'));
    expect(result).toContain('2026');
  });

  it('formats the long variant', () => {
    const result = getFormattedDate(new Date('2026-01-15T00:00:00Z'), 'long');
    expect(result).toContain('2026');
    expect(result.length).toBeGreaterThan(
      getFormattedDate(new Date('2026-01-15T00:00:00Z')).length
    );
  });

  it('formats a relative date within the last day in hours', () => {
    const soon = new Date(Date.now() + 2 * 3_600_000);
    const result = getFormattedDate(soon, 'relative');
    expect(result).toMatch(/hora/);
  });

  it('formats a relative date within the last week in days', () => {
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000);
    const result = getFormattedDate(inThreeDays, 'relative');
    expect(result).toMatch(/día/);
  });

  it('falls back to the compact format for relative dates beyond a week', () => {
    const farFuture = new Date(Date.now() + 30 * 86_400_000);
    const relative = getFormattedDate(farFuture, 'relative');
    const compact = getFormattedDate(farFuture);
    expect(relative).toBe(compact);
  });
});
