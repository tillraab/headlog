import { afterEach, describe, expect, it } from 'vitest';
import { formatLiters } from './days';
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
