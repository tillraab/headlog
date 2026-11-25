import { afterEach, describe, expect, it } from 'vitest';
import { de } from './i18n/de';
import { en } from './i18n/en';
import { fill, i18n, relativeDay } from './i18n.svelte';

const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();

describe('dictionaries', () => {
  it('use the same placeholders in English and German', () => {
    const differing = (Object.keys(en) as (keyof typeof en)[]).filter((key) => placeholders(en[key]).join() !== placeholders(de[key]).join());
    expect(differing).toEqual([]);
  });
});

describe('fill', () => {
  it('replaces a placeholder every time it appears', () => {
    expect(fill('{n} of {n} days', { n: 3 })).toBe('3 of 3 days');
  });
});

describe('relativeDay', () => {
  afterEach(() => {
    i18n.lang = 'en';
  });

  const now = new Date(2026, 10, 25, 0, 30);

  it.each([
    ['en', new Date(2026, 10, 25, 0, 5), 'Today'],
    ['en', new Date(2026, 10, 24, 23, 55), 'Yesterday'],
    ['en', new Date(2026, 10, 23, 12, 0), '23 Nov'],
    ['de', new Date(2026, 10, 25, 0, 5), 'Heute'],
    ['de', new Date(2026, 10, 24, 23, 55), 'Gestern'],
    ['de', new Date(2026, 10, 23, 12, 0), '23. Nov.']
  ] as const)('names the day in %s for %s', (lang, date, label) => {
    i18n.lang = lang;
    expect(relativeDay(date, now, 'd. MMM')).toBe(label);
  });
});
