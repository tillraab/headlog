import { afterEach, describe, expect, it } from 'vitest';
import { formatLiters, pickRangeDay, rangeDayCount } from './days';
import { i18n } from './i18n.svelte';

afterEach(() => {
  i18n.lang = 'en';
});

describe('formatLiters', () => {
  it.each([
    ['en', '1.5 l'],
    ['de', '1,5 l']
  ] as const)('writes the decimal mark of the app language %s', (lang, text) => {
    i18n.lang = lang;
    expect(formatLiters(1500)).toBe(text);
  });
});

describe('pickRangeDay', () => {
  it('sets the end on a later day', () => {
    expect(pickRangeDay({ from: '2026-03-01', to: null }, '2026-03-10')).toEqual({ from: '2026-03-01', to: '2026-03-10' });
  });

  it('accepts the start day as a one-day range', () => {
    expect(pickRangeDay({ from: '2026-03-01', to: null }, '2026-03-01')).toEqual({ from: '2026-03-01', to: '2026-03-01' });
  });

  it.each([
    ['an earlier day', { from: '2026-03-05', to: null }],
    ['a complete range', { from: '2026-03-01', to: '2026-03-10' }]
  ])('starts over after %s', (_, range) => {
    expect(pickRangeDay(range, '2026-03-02')).toEqual({ from: '2026-03-02', to: null });
  });
});

describe('rangeDayCount', () => {
  it('counts both ends', () => {
    expect(rangeDayCount('2026-03-01', '2026-03-30')).toBe(30);
  });
});
