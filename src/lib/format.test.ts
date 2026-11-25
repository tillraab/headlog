import { describe, expect, it } from 'vitest';
import { entryDetailLines, formatComparison, ifTakenTodayLine, limitReason } from './format';
import { i18n } from './i18n.svelte';

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
    expect(lines).toEqual(['⚡ Headache 09:00–…, intensity 6', '💊 09:30 Ibuprofen', '🥛 10:00']);
  });

  it('writes entries of the same minute under one time', () => {
    const intake = (id: number, time: string, name: string) => ({ id, time: at(time), medId: id, name, dose: '', category: 'analgesic' as const, relief: null });
    const drink = (id: number, time: string, emoji: string) => ({ id, time: at(time), presetId: id, name: '', emoji, ml: 250 });
    const lines = entryDetailLines({
      episodes: [],
      intakes: [intake(1, '2026-03-02T14:00', 'Ibuprofen'), intake(2, '2026-03-02T14:00', 'Sumatriptan')],
      drinks: [drink(1, '2026-03-02T14:00', '💧'), drink(2, '2026-03-02T13:35', '🥛'), drink(3, '2026-03-02T14:00', '🍵')]
    });
    expect(lines).toEqual(['💊 14:00 Ibuprofen, Sumatriptan', '🥛 13:35 · 💧🍵 14:00']);
  });
});

describe('limitReason', () => {
  it.each([
    [[], 10, 'No acute medication: fewer than 10 days'],
    [['analgesic'], 15, 'Only pain relievers: fewer than 15 days'],
    [['triptan'], 10, 'Triptan: fewer than 10 days'],
    [['other'], 10, 'Other medication: fewer than 10 days'],
    [['analgesic', 'triptan'], 10, 'Pain reliever and triptan: fewer than 10 days together'],
    [['analgesic', 'triptan', 'opioid'], 10, '3 classes: fewer than 10 days together']
  ] as const)('explains %j with limit %i', (classes, limit, text) => {
    expect(limitReason({ classes: [...classes], limit })).toBe(text);
  });

  it('writes German when the app language is German', () => {
    i18n.lang = 'de';
    const text = limitReason({ classes: ['other', 'opioid'], limit: 10 });
    i18n.lang = 'en';
    expect(text).toBe('Sonstiges Mittel und Opioid: zusammen weniger als 10 Tage');
  });
});

describe('ifTakenTodayLine', () => {
  it.each([
    [13, 15, 'A pain reliever today makes it 13 of 15, any other class 13 of 10.'],
    [7, 10, 'Taking medication today makes it 7 of 10.']
  ])('writes %i against %i', (n, limit, text) => {
    expect(ifTakenTodayLine({ ifTakenToday: n, limit })).toBe(text);
  });
});
