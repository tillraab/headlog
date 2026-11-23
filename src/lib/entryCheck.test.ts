import { describe, expect, it } from 'vitest';
import type { Episode } from './db';
import { entryProblem } from './entryCheck';

describe('entryProblem', () => {
  const episode = (start: number, end: number | null): Episode => ({ id: 1, start, end, intensity: 5, tags: [], note: '' });

  it.each([
    ['an end before the start', { kind: 'episode' as const, item: episode(200, 100) }, 'edit.endBeforeStart'],
    ['an invalid time', { kind: 'drink' as const, item: { time: NaN, presetId: 1, name: 'Glass', emoji: '🥛', ml: 250 } }, 'edit.invalidTime'],
    ['a fine drink', { kind: 'drink' as const, item: { time: 1, presetId: 1, name: 'Glass', emoji: '🥛', ml: 250 } }, null]
  ])('reports %s', (_, entry, problem) => {
    expect(entryProblem(entry, [])).toBe(problem);
  });

  it('refuses a second ongoing headache', () => {
    const running: Episode = { id: 2, start: 50, end: null, intensity: 5, tags: [], note: '' };
    expect(entryProblem({ kind: 'episode', item: { ...episode(100, null), id: undefined } }, [running])).toBe('edit.otherOngoing');
  });
});
