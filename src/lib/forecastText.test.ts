import { describe, expect, it } from 'vitest';
import type { Drink } from './db';
import { pressureChangeText, weatherOkText, whyText } from './forecastText';
import { prognosis } from './prognosis';

const at = (s: string) => new Date(s).getTime();
const drink = (time: string, ml: number, alcohol = false): Drink => ({ id: 1, time: at(time), presetId: 1, name: 'Glass', emoji: '🥛', ml, alcohol });
const now = at('2026-03-10T15:00');
const forecast = (drinks: Drink[]) => prognosis({ drinks, sleep: new Map(), weather: new Map(), goalMl: 2000 }, now);

describe('whyText', () => {
  it('says there is no weather without a home town', () => {
    expect(whyText(forecast([]), 'weather', false)).toBe('no home town set');
  });

  it('says the forecast is not loaded yet when a home town is set', () => {
    expect(whyText(forecast([]), 'weather', true)).toBe('no forecast loaded yet');
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

describe('pressureChangeText', () => {
  it.each([
    [10.4, '+10 hPa'],
    [-3.2, '−3 hPa'],
    [0.3, 'stable']
  ])('writes a change of %s hPa as %s', (change, text) => {
    expect(pressureChangeText(change)).toBe(text);
  });
});

describe('weatherOkText', () => {
  it.each([
    [10, 'rising to tomorrow (+10 hPa)'],
    [-2, 'no big drop to tomorrow (−2 hPa)'],
    [0.2, 'stable to tomorrow']
  ])('names a change of %s hPa', (change, text) => {
    expect(weatherOkText(change)).toBe(text);
  });
});
