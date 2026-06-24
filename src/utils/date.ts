import { I18N } from 'astrowind:config';

const compactFormatter: Intl.DateTimeFormat = new Intl.DateTimeFormat(I18N?.language, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const longFormatter: Intl.DateTimeFormat = new Intl.DateTimeFormat(I18N?.language, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

const relativeFormatter = new Intl.RelativeTimeFormat(I18N?.language ?? 'es', { numeric: 'auto' });

export const getFormattedDate = (
  date: Date,
  variant: 'compact' | 'long' | 'relative' = 'compact'
): string => {
  if (!date) return '';

  if (variant === 'long') return longFormatter.format(date);

  if (variant === 'relative') {
    const diffMs = date.valueOf() - Date.now();
    const diffDays = diffMs / 86_400_000;
    if (Math.abs(diffDays) < 7) {
      if (Math.abs(diffDays) < 1) {
        return relativeFormatter.format(Math.round(diffMs / 3_600_000), 'hour');
      }
      return relativeFormatter.format(Math.round(diffDays), 'day');
    }
    return compactFormatter.format(date);
  }

  return compactFormatter.format(date);
};
