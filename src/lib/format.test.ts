import { describe, expect, it } from 'vitest';
import { entryDetailLines, formatComparison } from './format';

const at = (s: string) => new Date(s).getTime();

describe('formatComparison', () => {
  it.each([
    ['hydration', 1500, '1.5 l'],
    ['sleep', 7.5, '7h 30m'],
    ['caffeine', 123.4, '123 mg'],
    ['pressure', 0.25, '25 %'],
    ['alcohol', 0.5, '50 %']
  ] as const)('writes %s %d as %s', (key, value, text) => {
    expect(formatComparison(key, value)).toBe(text);
  });
});

describe('entryDetailLines', () => {
  it('writes a line per headache, one for the medication and one for the drinks', () => {
    const lines = entryDetailLines({
      episodes: [{ id: 1, start: at('2026-03-02T09:00'), end: null, intensity: 6, tags: [], note: '' }],
      intakes: [{ id: 1, time: at('2026-03-02T09:30'), medId: 1, name: 'Ibuprofen', dose: '400 mg', category: 'analgesic', relief: null }],
      drinks: [{ id: 1, time: at('2026-03-02T10:00'), presetId: 1, name: 'Glass', emoji: '🥛', ml: 250 }]
    });
    expect(lines).toEqual(['⚡ Headache 09:00–…, intensity 6', '💊 Ibuprofen 09:30', '🥛 10:00']);
  });
});
