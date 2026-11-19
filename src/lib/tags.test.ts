import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from './i18n.svelte';
import { myTags, tagFromText, tagIdeas } from './tags';

afterEach(() => {
  i18n.lang = 'en';
});

describe('myTags', () => {
  it('keeps the saved list', () => {
    expect(myTags(['period'], [{ tags: ['stress'] }])).toEqual(['period']);
  });

  it('starts from the tags already used, most used first', () => {
    expect(myTags(null, [{ tags: ['stress'] }, { tags: ['nausea', 'stress'] }])).toEqual(['stress', 'nausea']);
  });

  it('is empty for a diary without tags', () => {
    expect(myTags(null, [{ tags: [] }])).toEqual([]);
  });
});

describe('tagFromText', () => {
  it.each([
    ['en', ' stress ', 'stress'],
    ['de', 'Periode', 'period'],
    ['en', 'Neck pain', 'Neck pain']
  ] as const)('reads "%s" text %s as %s', (lang, text, tag) => {
    i18n.lang = lang;
    expect(tagFromText(text)).toBe(tag);
  });
});

describe('tagIdeas', () => {
  it('leaves out tags already on the list', () => {
    expect(tagIdeas(['stress'])).not.toContain('stress');
  });
});
