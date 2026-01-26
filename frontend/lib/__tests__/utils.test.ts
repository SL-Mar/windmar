/**
 * Tests for utility functions.
 */

import {
  cn,
  formatNumber,
  formatDistance,
  formatFuel,
  formatPower,
  formatDuration,
  formatSpeed,
  formatDate,
} from '../utils';

describe('cn (className merge)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('merges Tailwind classes correctly', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles empty inputs', () => {
    expect(cn()).toBe('');
  });
});

describe('formatNumber', () => {
  it('formats number with default decimals', () => {
    expect(formatNumber(123.456)).toBe('123.5');
  });

  it('formats number with custom decimals', () => {
    expect(formatNumber(123.456, 2)).toBe('123.46');
  });

  it('formats number with zero decimals', () => {
    expect(formatNumber(123.456, 0)).toBe('123');
  });

  it('handles whole numbers', () => {
    expect(formatNumber(100, 2)).toBe('100.00');
  });

  it('handles negative numbers', () => {
    expect(formatNumber(-45.678, 1)).toBe('-45.7');
  });
});

describe('formatDistance', () => {
  it('formats distance with nm unit', () => {
    expect(formatDistance(1234.5)).toBe('1235 nm');
  });

  it('formats small distance', () => {
    expect(formatDistance(50.3)).toBe('50 nm');
  });

  it('formats zero distance', () => {
    expect(formatDistance(0)).toBe('0 nm');
  });
});

describe('formatFuel', () => {
  it('formats fuel with MT unit', () => {
    expect(formatFuel(23.456)).toBe('23.5 MT');
  });

  it('formats small fuel amount', () => {
    expect(formatFuel(0.5)).toBe('0.5 MT');
  });

  it('formats large fuel amount', () => {
    expect(formatFuel(1234.5)).toBe('1234.5 MT');
  });
});

describe('formatPower', () => {
  it('formats power with kW unit', () => {
    expect(formatPower(8840)).toBe('8840 kW');
  });

  it('formats power with decimals', () => {
    expect(formatPower(5637.5)).toBe('5638 kW');
  });
});

describe('formatDuration', () => {
  it('formats hours only', () => {
    expect(formatDuration(5)).toBe('5h');
  });

  it('formats days and hours', () => {
    expect(formatDuration(30)).toBe('1d 6h');
  });

  it('formats multiple days', () => {
    expect(formatDuration(72)).toBe('3d 0h');
  });

  it('handles fractional hours', () => {
    expect(formatDuration(25.5)).toBe('1d 1h');
  });

  it('handles zero duration', () => {
    expect(formatDuration(0)).toBe('0h');
  });
});

describe('formatSpeed', () => {
  it('formats speed with kts unit', () => {
    expect(formatSpeed(14.5)).toBe('14.5 kts');
  });

  it('formats whole number speed', () => {
    expect(formatSpeed(12)).toBe('12.0 kts');
  });

  it('formats high speed', () => {
    expect(formatSpeed(20.75)).toBe('20.8 kts');
  });
});

describe('formatDate', () => {
  it('formats date string', () => {
    const result = formatDate('2026-01-05T14:30:00Z');
    // The exact format depends on locale, but should include key components
    expect(result).toContain('Jan');
    expect(result).toContain('5');
    expect(result).toContain('2026');
  });

  it('formats Date object', () => {
    const date = new Date('2026-06-15T10:00:00Z');
    const result = formatDate(date);
    expect(result).toContain('Jun');
    expect(result).toContain('15');
  });
});
