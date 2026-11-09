import { describe, expect, it } from 'vitest';
import type { Drink } from './db';
import { whyText } from './forecastText';
import { prognosis } from './prognosis';

const at = (s: string) => new Date(s).getTime();
const drink = (time: string, ml: number, alcohol = false): Drink => ({ id: 1, time: at(time), presetId: 1, name: 'Glass', emoji: '🥛', ml, alcohol });
const now = at('2026-03-10T15:00');
const forecast = (drinks: Drink[]) => prognosis({ drinks, sleep: new Map(), weather: new Map(), goalMl: 2000 }, now);

describe('whyText', () => {
  it('says there is no weather without a home town', () => {
    expect(whyText(forecast([]), 'weather')).toBe('no home town set');
  });

  it('names the amount and the pace when behind on drinks', () => {
    expect(whyText(forecast([drink('2026-03-09T12:00', 2000), drink('2026-03-10T09:00', 300)]), 'hydration')).toContain('0.3 l');
  });

  it('names the day of the alcohol', () => {
    expect(whyText(forecast([drink('2026-03-09T20:00', 330, true), drink('2026-03-10T09:00', 1500)]), 'alcohol')).toBe('alcohol yesterday');
  });

  it('says when no night is known yet', () => {
    expect(whyText(forecast([]), 'sleep')).toBe(whyText(forecast([drink('2026-03-10T09:00', 250)]), 'sleep'));
  });
});
