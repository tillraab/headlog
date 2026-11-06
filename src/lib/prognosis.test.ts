import { describe, expect, it } from 'vitest';
import type { Drink, Night, WeatherDay } from './db';
import { expectedByNow, prognosis, type PrognosisInput } from './prognosis';

const at = (s: string) => new Date(s).getTime();
const now = at('2026-03-10T14:30');
const drink = (time: string, ml: number, extra: Partial<Drink> = {}): Drink => ({ id: 1, time: at(time), presetId: 1, name: 'Glass', emoji: '🥛', ml, ...extra });
const night = (hours: number): Night => ({ day: '2026-03-10', start: 0, end: 0, asleepMs: hours * 3600000, breaks: [], source: 'screen' });
const weather = (day: string, drop: number): WeatherDay => ({ day, pressure: 1010, pressureDrop: drop, tempMax: 10, tempMin: 2, humidity: 70, precipitation: 0, code: 0 });

function input(overrides: Partial<PrognosisInput> = {}): PrognosisInput {
  return {
    drinks: [drink('2026-03-09T12:00', 2200), drink('2026-03-10T09:00', 1200)],
    sleep: new Map([['2026-03-10', night(7.5)]]),
    weather: new Map([['2026-03-10', weather('2026-03-10', 1)], ['2026-03-11', weather('2026-03-11', 2)]]),
    goalMl: 2000,
    ...overrides
  };
}

describe('expectedByNow', () => {
  it.each([
    ['2026-03-10T06:00', 0],
    ['2026-03-10T14:30', 1000],
    ['2026-03-10T23:00', 2000]
  ])('at %s expects %i ml of 2 l', (time, ml) => {
    expect(expectedByNow(2000, at(time))).toBe(ml);
  });
});

describe('prognosis', () => {
  it('is green when everything is fine', () => {
    const p = prognosis(input(), now);
    expect([p.light, p.bad, p.weather.status, p.hydration.status, p.sleep.status]).toEqual(['green', 0, 'ok', 'ok', 'ok']);
  });

  it('turns yellow with one unfavourable factor', () => {
    expect(prognosis(input({ sleep: new Map([['2026-03-10', night(4.5)]]) }), now).light).toBe('yellow');
  });

  it('turns red with two', () => {
    const p = prognosis(input({ sleep: new Map([['2026-03-10', night(4.5)]]), weather: new Map([['2026-03-11', weather('2026-03-11', 8)]]) }), now);
    expect([p.light, p.weather.drop]).toEqual(['red', 8]);
  });

  it('stays red with three or more', () => {
    const p = prognosis(
      input({
        drinks: [drink('2026-03-09T12:00', 800), drink('2026-03-09T20:00', 150, { alcohol: true }), drink('2026-03-10T09:00', 300)],
        sleep: new Map([['2026-03-10', night(4.5)]])
      }),
      now
    );
    expect([p.light, p.bad, p.hydration.status, p.alcohol.status]).toEqual(['red', 3, 'bad', 'bad']);
  });

  it('does not count the day before the first logged drink as a dry day', () => {
    const p = prognosis(input({ drinks: [drink('2026-03-10T09:00', 1200)] }), now);
    expect([p.hydration.yesterday, p.hydration.status]).toEqual([null, 'ok']);
  });

  it("is fine once today's goal is reached, even after a dry day", () => {
    const p = prognosis(input({ drinks: [drink('2026-03-09T12:00', 500), drink('2026-03-10T09:00', 3000)] }), now);
    expect(p.hydration.status).toBe('ok');
  });

  it('still counts a dry yesterday while today is below the goal', () => {
    const p = prognosis(input({ drinks: [drink('2026-03-09T12:00', 500), drink('2026-03-10T09:00', 1200)] }), now);
    expect(p.hydration.status).toBe('bad');
  });

  it('does not count unknown factors', () => {
    const p = prognosis(input({ sleep: new Map(), weather: new Map() }), now);
    expect([p.sleep.status, p.weather.status, p.light]).toEqual(['unknown', 'unknown', 'green']);
  });

  it.each([
    ['2026-03-10T14:30', 250, 'ok'],
    ['2026-03-10T10:30', 0, 'bad'],
    ['2026-03-10T09:30', 0, 'unknown']
  ])('at %s with %i mg today, after three days of 200 mg, caffeine is %s', (time, mg, status) => {
    const coffees = ['2026-03-07', '2026-03-08', '2026-03-09'].map((d) => drink(`${d}T08:00`, 200, { caffeineMg: 200 }));
    const today = mg ? [drink('2026-03-10T08:00', 200, { caffeineMg: mg })] : [];
    expect(prognosis(input({ drinks: [...coffees, ...today, drink('2026-03-10T09:00', 1200)] }), at(time)).caffeine.status).toBe(status);
  });

  it('counts a caffeine drop from 10:00', () => {
    const coffees = Array.from({ length: 9 }, (_, i) => drink(`2026-03-0${i + 1}T08:00`, 200, { caffeineMg: 200 }));
    const p = prognosis(input({ drinks: [...input().drinks, ...coffees] }), now);
    expect([p.caffeine.status, p.caffeine.today]).toEqual(['bad', 0]);
  });
});
