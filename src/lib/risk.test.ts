import { describe, expect, it } from 'vitest';
import type { Drink, Episode, Night, WeatherDay } from './db';
import { dayKey, lastDays } from './days';
import { assessRisk, factorStats } from './risk';

const at = (s: string) => new Date(s).getTime();
const now = at('2026-03-31T18:00');
const t = { dropHpa: 6, goalMl: 2000 };

/** 60 days: a pressure drop every 5th day, a headache on 3 of every 4 drop days and on 1 in 12 other days. */
function history() {
  const days = lastDays(at('2026-03-30T12:00'), 60);
  const weather = new Map<string, WeatherDay>();
  const episodes: Episode[] = [];
  const drinks: Drink[] = [];
  days.forEach((day, i) => {
    const drop = i % 5 === 0;
    weather.set(day, { day, pressure: 1010, pressureDrop: drop ? 8 : 1, tempMax: 10, tempMin: 2, humidity: 70, precipitation: 0, code: 0 });
    drinks.push({ id: i, time: at(`${day}T10:00`), presetId: 1, name: 'Glass', emoji: '🥛', ml: 2000 });
    if ((drop && i % 20 !== 0) || (!drop && i % 12 === 1)) episodes.push({ id: i, start: at(`${day}T09:00`), end: at(`${day}T11:00`), intensity: 5, tags: [], note: '' });
  });
  return { episodes, drinks, sleep: new Map<string, Night>(), weather };
}

describe('factorStats', () => {
  it('finds headaches more likely on pressure drop days', () => {
    const pressure = factorStats(history(), t, now).find((s) => s.key === 'pressure')!;
    expect([pressure.nWith, pressure.nWithout, pressure.ratio! > 3]).toEqual([12, 48, true]);
  });

  it('gives no ratio with too few days', () => {
    expect(factorStats(history(), t, now).find((s) => s.key === 'sleep')!.ratio).toBeNull();
  });
});

describe('assessRisk', () => {
  it('raises tomorrow with a forecast pressure drop', () => {
    const data = history();
    const tomorrow = dayKey(at('2026-04-01T12:00'));
    data.weather.set(tomorrow, { ...data.weather.get('2026-03-30')!, day: tomorrow, pressureDrop: 9 });
    const risk = assessRisk(data, t, now, 'tomorrow');
    expect([risk.level, risk.factors.map((f) => f.key), risk.estimate! > risk.usual]).toEqual(['high', ['pressure'], true]);
  });

  it('stays calm without risk factors', () => {
    expect(assessRisk(history(), t, now, 'tomorrow').level).toBe('none');
  });

  it('counts little to drink today toward tomorrow in the evening', () => {
    const data = history();
    data.drinks.push({ id: 999, time: at('2026-03-31T09:00'), presetId: 1, name: 'Glass', emoji: '🥛', ml: 500 });
    expect(assessRisk(data, t, now, 'tomorrow').factors.map((f) => f.key)).toEqual(['hydration']);
  });

  it('names a known trigger without an estimate when there is too little data', () => {
    const data = history();
    data.sleep.set('2026-03-31', { day: '2026-03-31', start: 0, end: 0, asleepMs: 4.5 * 3600000, breaks: [], source: 'manual' });
    const risk = assessRisk(data, t, now, 'today');
    expect([risk.level, risk.factors.map((f) => f.key), risk.estimate]).toEqual(['possible', ['sleep'], null]);
  });
});
