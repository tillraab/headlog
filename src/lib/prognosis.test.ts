import { describe, expect, it } from 'vitest';
import type { Drink, Night, WeatherDay } from './db';
import { dayKey as dayKeyOf } from './days';
import { expectedByNow, prognosis, tomorrowRisk, type PrognosisInput } from './prognosis';

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

  it('does not count a pressure drop today', () => {
    const p = prognosis(input({ weather: new Map([['2026-03-10', weather('2026-03-10', 9)], ['2026-03-11', weather('2026-03-11', 1)]]) }), now);
    expect([p.weather.status, p.weather.drop]).toEqual(['ok', 1]);
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

  describe('caffeine', () => {
    /** Mar 1 to 9: coffee at 8:00 and 14:00, 100 mg each; Mar 10 is today. */
    const usualDays = Array.from({ length: 9 }, (_, i) => `2026-03-0${i + 1}`);
    const history = usualDays.flatMap((d) => [drink(`${d}T08:00`, 200, { caffeineMg: 100 }), drink(`${d}T14:00`, 200, { caffeineMg: 100 })]);
    const water = [drink('2026-03-09T12:00', 2200), drink('2026-03-10T09:00', 1200)];
    const caffeineAt = (time: string, today: Drink[], past = history) => prognosis(input({ drinks: [...past, ...today, ...water] }), at(time)).caffeine;

    it.each([
      ['07:00', [], 'ok', 'too early: nothing is usual by now'],
      ['10:00', [], 'bad', 'the usual morning coffee is missing'],
      ['10:00', [drink('2026-03-10T08:00', 200, { caffeineMg: 100 })], 'ok', 'the morning coffee is there'],
      ['15:00', [drink('2026-03-10T08:00', 200, { caffeineMg: 100 })], 'ok', 'half of the usual 200 mg by 15:00 is enough']
    ])('at %s with %j today is %s (%s)', (time, today, status) => {
      expect(caffeineAt(`2026-03-10T${time}`, today).status).toBe(status);
    });

    it('compares today with the usual amount by this time of day, not the whole day', () => {
      const c = caffeineAt('2026-03-10T10:00', [drink('2026-03-10T08:00', 200, { caffeineMg: 100 })]);
      expect([c.usualByNow, c.usual]).toEqual([100, 200]);
    });

    it('counts a drop yesterday, even early in the morning', () => {
      const lowYesterday = history.filter((d) => dayKeyOf(d.time) !== '2026-03-09');
      const c = caffeineAt('2026-03-10T07:00', [], [...lowYesterday, drink('2026-03-09T08:00', 200, { caffeineMg: 50 })]);
      expect([c.status, c.yesterdayLow, c.todayLow]).toEqual(['bad', true, false]);
    });

    it('is not judged with fewer than 7 logged days', () => {
      const short = history.filter((d) => dayKeyOf(d.time) >= '2026-03-05');
      expect(caffeineAt('2026-03-10T10:00', [], short).status).toBe('unknown');
    });
  });
});

describe('prognosis at the thresholds', () => {
  it('counts a pressure drop from today to tomorrow', () => {
    expect(prognosis(input({ weather: new Map([['2026-03-11', weather('2026-03-11', 8)]]) }), now).weather.status).toBe('bad');
  });

  it.each([
    ['a night of exactly 6 h', input({ sleep: new Map([['2026-03-10', night(6)]]) }), 'sleep'],
    ['yesterday at exactly three quarters of the goal', input({ drinks: [drink('2026-03-09T12:00', 1500), drink('2026-03-10T09:00', 1200)] }), 'hydration'],
    ['a pressure drop of exactly 5 hPa', input({ weather: new Map([['2026-03-11', weather('2026-03-11', 5)]]) }), 'weather']
  ] as const)('is fine with %s', (_, data, factor) => {
    expect(prognosis(data, now)[factor].status).toBe('ok');
  });

  it('lists the unfavourable factors in a fixed order', () => {
    const p = prognosis(
      input({
        drinks: [drink('2026-03-09T12:00', 800), drink('2026-03-09T20:00', 150, { alcohol: true }), drink('2026-03-10T09:00', 300)],
        sleep: new Map([['2026-03-10', night(4.5)]]),
        weather: new Map([['2026-03-11', weather('2026-03-11', 8)]])
      }),
      now
    );
    expect((['weather', 'hydration', 'sleep', 'alcohol', 'caffeine'] as const).filter((k) => p[k].status === 'bad')).toEqual(['weather', 'hydration', 'sleep', 'alcohol']);
  });

  it('counts alcohol yesterday, which tomorrowRisk leaves out', () => {
    const data = input({ drinks: [drink('2026-03-09T12:00', 2200), drink('2026-03-09T20:00', 150, { alcohol: true }), drink('2026-03-10T09:00', 1800)] });
    expect([prognosis(data, now).alcohol.status, tomorrowRisk(data, at('2026-03-10T20:00')).factors]).toEqual(['bad', []]);
  });

  it('counts the alcoholic drinks of today and yesterday', () => {
    const data = input({ drinks: [drink('2026-03-09T19:00', 150, { alcohol: true }), drink('2026-03-09T21:00', 150, { alcohol: true }), drink('2026-03-10T09:00', 1800)] });
    const { alcohol } = prognosis(data, now);
    expect([alcohol.drinksToday, alcohol.drinksYesterday]).toEqual([0, 2]);
  });
});

describe('tomorrowRisk', () => {
  const evening = at('2026-03-10T20:00');

  it('leaves out drinks logged after the hour it looks from', () => {
    const r = tomorrowRisk(input({ drinks: [drink('2026-03-10T09:00', 1000), drink('2026-03-10T21:00', 1000)] }), evening);
    expect(r.factors).toEqual(['hydration']);
  });

  it.each([
    ['no drop from tomorrow to the day after', new Map([['2026-03-11', weather('2026-03-11', 10)], ['2026-03-12', weather('2026-03-12', 0)]])],
    ['no forecast for the day after tomorrow', new Map([['2026-03-11', weather('2026-03-11', 10)]])]
  ])('stays green after a drop from today to tomorrow with %s', (_, forecast) => {
    const r = tomorrowRisk(input({ drinks: [drink('2026-03-10T09:00', 2400)], weather: forecast }), evening);
    expect([r.light, r.factors]).toEqual(['green', []]);
  });

  it('judges today\'s drinks against the pace at the hour it looks from', () => {
    const r = tomorrowRisk(input({ drinks: [drink('2026-03-10T09:00', 800)] }), at('2026-03-10T12:00'));
    expect(r.factors).toEqual([]);
  });

  it('lists every factor with its status', () => {
    const r = tomorrowRisk(input({ drinks: [drink('2026-03-10T09:00', 1800), drink('2026-03-10T19:00', 500, { alcohol: true })] }), evening);
    expect(r.statuses).toEqual([['weather', 'unknown'], ['hydration', 'ok'], ['alcohol', 'bad']]);
  });

  it('ignores a short night and counts only what matters tomorrow', () => {
    const r = tomorrowRisk(input({ sleep: new Map([['2026-03-10', night(4)]]), drinks: [drink('2026-03-10T09:00', 1800)] }), evening);
    expect([r.light, r.factors]).toEqual(['green', []]);
  });

  it.each([
    ['a pressure drop the day after tomorrow', { weather: new Map([['2026-03-12', weather('2026-03-12', 8)]]) }, ['weather']],
    ['too little to drink today', { drinks: [drink('2026-03-10T09:00', 1000)] }, ['hydration']],
    ['alcohol today', { drinks: [drink('2026-03-10T09:00', 1800), drink('2026-03-10T19:00', 150, { alcohol: true })] }, ['alcohol']]
  ])('turns yellow with %s', (_, overrides, factors) => {
    const base = { drinks: [drink('2026-03-10T09:00', 1800)] };
    const r = tomorrowRisk(input({ ...base, ...overrides }), evening);
    expect([r.light, r.factors]).toEqual(['yellow', factors]);
  });

  it('turns red with two factors', () => {
    const r = tomorrowRisk(input({ drinks: [drink('2026-03-10T09:00', 1000)], weather: new Map([['2026-03-12', weather('2026-03-12', 8)]]) }), evening);
    expect([r.light, r.factors]).toEqual(['red', ['weather', 'hydration']]);
  });
});

describe('sleep', () => {
  const night = (start: string, end: string, breaks: [string, string][] = []): Night => {
    const b = breaks.map(([s0, e0]) => ({ start: at(s0), end: at(e0) }));
    const awake = b.reduce((sum, x) => sum + x.end - x.start, 0);
    return { day: '2026-03-10', start: at(start), end: at(end), asleepMs: at(end) - at(start) - awake, breaks: b, source: 'screen' };
  };
  const sleepFor = (n: Night) => prognosis(input({ sleep: new Map([['2026-03-10', n]]) }), now).sleep;

  it.each([
    ['a continuous 6-hour night', night('2026-03-10T00:00', '2026-03-10T06:00'), 'ok'],
    ['a night under 5 hours', night('2026-03-10T02:00', '2026-03-10T06:30'), 'bad'],
    ['8 hours with 90 minutes awake (81 % asleep)', night('2026-03-09T22:00', '2026-03-10T06:00', [['2026-03-10T02:00', '2026-03-10T03:30']]), 'bad'],
    ['8 hours with 30 minutes awake (94 % asleep)', night('2026-03-09T22:00', '2026-03-10T06:00', [['2026-03-10T02:00', '2026-03-10T02:30']]), 'ok']
  ])('%s is %s', (_, n, status) => {
    expect(sleepFor(n).status).toBe(status);
  });

  it('names why: fragmented, not short', () => {
    const s = sleepFor(night('2026-03-09T22:00', '2026-03-10T06:00', [['2026-03-10T02:00', '2026-03-10T03:30']]));
    expect([s.short, s.fragmented, Math.round((s.efficiency ?? 0) * 100)]).toEqual([false, true, 81]);
  });
});
