import { describe, expect, it } from 'vitest';
import { de } from './i18n/de';
import { en } from './i18n/en';
import { fill, tagLabel } from './i18n.svelte';

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

describe('tagLabel', () => {
  it.each([
    ['nausea', 'Nausea'],
    ['my own tag', 'my own tag']
  ])('labels %s as %s', (tag, label) => {
    expect(tagLabel(tag)).toBe(label);
  });
});
