import { afterEach, describe, expect, it } from 'vitest';
import { formatLiters, setRangeEnd } from './days';
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

describe('setRangeEnd', () => {
  const range = { from: '2026-02-09', to: '2026-03-10' };

  it('moves the other end along when the ends would cross', () => {
    expect(setRangeEnd(range, 'from', '2026-03-12', '2026-03-12', 30)).toEqual({ from: '2026-03-12', to: '2026-03-12' });
  });

  it('keeps the end at today at most', () => {
    expect(setRangeEnd(range, 'to', '2026-04-01', '2026-03-12', 30)).toEqual({ from: '2026-02-09', to: '2026-03-12' });
  });

  it('is null for the default range', () => {
    expect(setRangeEnd({ from: '2026-01-01', to: '2026-03-12' }, 'from', '2026-02-11', '2026-03-12', 30)).toBeNull();
  });
});
