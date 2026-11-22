import { describe, expect, it } from 'vitest';
import { myTags, withTag } from './tags';

describe('myTags', () => {
  it('keeps the saved list', () => {
    expect(myTags(['Period'], [{ tags: ['Stress'] }])).toEqual(['Period']);
  });

  it('starts from the tags already used, most used first', () => {
    expect(myTags(null, [{ tags: ['Stress'] }, { tags: ['Nausea', 'Stress'] }])).toEqual(['Stress', 'Nausea']);
  });

  it('is empty for a diary without tags', () => {
    expect(myTags(null, [{ tags: [] }])).toEqual([]);
  });
});

describe('withTag', () => {
  it('adds the typed words, trimmed', () => {
    expect(withTag(['Stress'], ' Neck pain ')).toEqual({ list: ['Stress', 'Neck pain'], tag: 'Neck pain' });
  });

  it('reuses an entry that differs only in case', () => {
    expect(withTag(['Stress'], 'stress')).toEqual({ list: ['Stress'], tag: 'Stress' });
  });
});
