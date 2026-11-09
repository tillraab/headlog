import { describe, expect, it } from 'vitest';
import { alcoholDays, alcoholPerDay, average, caffeineCurve, poorNight, pressureAround, sleepEfficiency, usualCaffeineCurve, monthlyCounts, conflictingOngoing, medicationEffect, monthSummary, overuseRows, hydrationCurve, caffeineByDay, compareDays, dayFactors, headacheDays, hydrationBefore, hydrationStreak, intakeDays, medicationLimits, monthlyCategoryDays, periodStats, rollingDays, ruleStatus, tenTwenty, timeline, usualCaffeine, waterByDay, waterOn, firstDrinkDay } from './analysis';
import { prognosis } from './prognosis';
import type { Drink, Episode, Intake, Medication, Night, Relief, WeatherDay } from './db';
import type { MedCategory } from './medication';
import { lastDays } from './days';

const at = (s: string) => new Date(s).getTime();

function episode(start: string, end: string | null, intensity = 5, tags: string[] = []): Episode {
  return { id: 1, start: at(start), end: end ? at(end) : null, intensity, tags, note: '' };
}

function intake(time: string, category: MedCategory = 'analgesic', name = 'Ibuprofen', relief: Relief | null = null): Intake {
  return { id: 1, time: at(time), medId: 1, name, dose: '400 mg', category, relief };
}

function drink(time: string, ml: number): Drink {
  return { id: 1, time: at(time), presetId: 1, name: 'Glass', emoji: '🥛', ml };
}

describe('headacheDays', () => {
  it('marks every day an episode touches with its peak intensity', () => {
    const days = headacheDays([episode('2026-03-01T22:00', '2026-03-02T03:00', 4), episode('2026-03-02T15:00', '2026-03-02T16:00', 7)], at('2026-03-05T12:00'));
    expect(Object.fromEntries(days)).toEqual({ '2026-03-01': 4, '2026-03-02': 7 });
  });

  it('extends an ongoing episode until now', () => {
    const days = headacheDays([episode('2026-03-01T22:00', null)], at('2026-03-03T08:00'));
    expect([...days.keys()]).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
  });
});

describe('intakeDays', () => {
  it.each([
    [true, ['2026-03-01']],
    [false, ['2026-03-01', '2026-03-02']]
  ])('with acuteOnly=%s leaves preventives out accordingly', (acuteOnly, expected) => {
    const days = intakeDays([intake('2026-03-01T10:00'), intake('2026-03-02T10:00', 'preventive')], acuteOnly);
    expect([...days.keys()]).toEqual(expected);
  });
});

describe('tenTwenty', () => {
  const today = at('2026-03-31T12:00');

  it('counts medication days in the 30 days ending today, today included', () => {
    const med = new Set(['2026-03-01', '2026-03-02', '2026-03-31']);
    expect(tenTwenty(med, today).count).toBe(2);
  });

  it('predicts the count after taking medication today', () => {
    expect(tenTwenty(new Set(['2026-03-10']), today).ifTakenToday).toBe(2);
  });

  it('does not add today twice when today already counts', () => {
    expect(tenTwenty(new Set(['2026-03-31']), today).ifTakenToday).toBe(1);
  });

  it('names the day the oldest medication day leaves the window', () => {
    expect(tenTwenty(new Set(['2026-03-05', '2026-03-20']), today).nextRelief).toBe('2026-04-04');
  });

  it('has no relief day without medication', () => {
    expect(tenTwenty(new Set(), today).nextRelief).toBeNull();
  });

  it.each([
    [9, 'caution'],
    [10, 'over']
  ] as const)('reports %i days as %s', (days, status) => {
    expect(tenTwenty(new Set(lastDays(today, days)), today).status).toBe(status);
  });

  it('allows the full personal limit', () => {
    expect(tenTwenty(new Set(lastDays(today, 4)), today, 4, 30, 4).status).toBe('caution');
  });
});

describe('ruleStatus', () => {
  it.each([
    [0, 'ok'],
    [7, 'ok'],
    [8, 'caution'],
    [10, 'caution'],
    [11, 'over']
  ] as const)('%i of 10 is %s', (count, status) => {
    expect(ruleStatus(count, 10)).toBe(status);
  });

  it.each([
    [3, 'ok'],
    [4, 'caution'],
    [6, 'over']
  ] as const)('%i of 5 is %s', (count, status) => {
    expect(ruleStatus(count, 5)).toBe(status);
  });
});

describe('medicationLimits', () => {
  const meds: Medication[] = [
    { id: 1, name: 'Ibuprofen', dose: '', category: 'analgesic', color: '', order: 0 },
    { id: 2, name: 'Sumatriptan', dose: '', category: 'triptan', color: '', order: 1, limitDays: 5 }
  ];

  it('counts days per medication with a personal limit only', () => {
    const intakes = [
      { ...intake('2026-03-20T08:00', 'triptan'), medId: 2 },
      { ...intake('2026-03-20T20:00', 'triptan'), medId: 2 },
      { ...intake('2026-03-25T08:00', 'triptan'), medId: 2 },
      intake('2026-03-26T08:00')
    ];
    const result = medicationLimits(intakes, meds, at('2026-03-31T12:00'));
    expect(result.map((r) => [r.med.name, r.rule.count, r.rule.limit])).toEqual([['Sumatriptan', 2, 5]]);
  });

  it('counts within the window set for the medication', () => {
    const weekly = [{ ...meds[1], limitDays: 2, limitWindow: 7 }];
    const intakes = [{ ...intake('2026-03-20T08:00', 'triptan'), medId: 2 }, { ...intake('2026-03-28T08:00', 'triptan'), medId: 2 }];
    const [{ rule }] = medicationLimits(intakes, weekly, at('2026-03-31T12:00'));
    expect([rule.count, rule.window]).toEqual([1, 7]);
  });
});

describe('rollingDays', () => {
  it('matches tenTwenty for every day', () => {
    const today = at('2026-03-31T12:00');
    const med = new Set(['2026-01-15', '2026-02-10', '2026-02-11', '2026-03-01', '2026-03-30']);
    const rolling = rollingDays(med, today, 60);
    expect(rolling.map((r) => r.count)).toEqual(rolling.map((r) => tenTwenty(med, new Date(r.key)).count));
  });

  it('returns one entry per day of the span', () => {
    expect(rollingDays(new Set(), at('2026-03-31T12:00'), 90)).toHaveLength(90);
  });
});

describe('monthlyCategoryDays', () => {
  it('counts distinct days per category within the month', () => {
    const intakes = [
      intake('2026-03-01T08:00', 'triptan'),
      intake('2026-03-01T18:00', 'triptan'),
      intake('2026-03-04T08:00', 'triptan'),
      intake('2026-03-04T08:00', 'analgesic'),
      intake('2026-02-27T08:00', 'triptan')
    ];
    expect(Object.fromEntries(monthlyCategoryDays(intakes, new Date('2026-03-15')))).toEqual({ triptan: 2, analgesic: 1 });
  });
});

describe('periodStats', () => {
  const today = at('2026-03-10T20:00');
  const data = {
    episodes: [episode('2026-03-02T09:00', '2026-03-02T11:00', 4, ['stress']), episode('2026-03-08T14:00', '2026-03-08T18:00', 8, ['stress', 'sleep'])],
    intakes: [intake('2026-03-02T09:30', 'analgesic', 'Ibuprofen', 2), intake('2026-03-08T14:10', 'triptan', 'Sumatriptan', 1)],
    drinks: [drink('2026-03-01T12:00', 1000), drink('2026-03-03T12:00', 2000), drink('2026-03-04T12:00', 2400), drink('2026-03-07T12:00', 1200)]
  };
  const stats = periodStats(data, today, 30);

  it('counts headache days and episodes', () => {
    expect([stats.headacheDays, stats.episodes]).toEqual([2, 2]);
  });

  it('averages the duration of finished episodes', () => {
    expect(stats.avgDurationMs).toBe(3 * 3600000);
  });

  it('counts days since the last headache', () => {
    expect(stats.clearStreak).toBe(2);
  });


  it('ranks tags by frequency', () => {
    expect(stats.tags).toEqual([
      { tag: 'stress', count: 2 },
      { tag: 'sleep', count: 1 }
    ]);
  });

  it('places episode starts on the right weekday, Monday first', () => {
    expect(stats.weekday).toEqual([1, 0, 0, 0, 0, 0, 1]);
  });
});

describe('hydrationStreak', () => {
  const glass = (time: string, ml = 2000): Drink => ({ ...drink(time, ml) });
  const today = at('2026-03-10T12:00');

  it('counts the days in a row up to yesterday while today is still open', () => {
    const drinks = [glass('2026-03-07T10:00'), glass('2026-03-08T10:00'), glass('2026-03-09T10:00'), glass('2026-03-10T09:00', 500)];
    expect(hydrationStreak(drinks, 2000, today)).toEqual({ current: 3, best: 3, todayReached: false });
  });

  it('adds today once the goal is reached', () => {
    const drinks = [glass('2026-03-09T10:00'), glass('2026-03-10T09:00')];
    expect(hydrationStreak(drinks, 2000, today).current).toBe(2);
  });

  it('starts over after a missed day', () => {
    const drinks = [glass('2026-03-07T10:00'), glass('2026-03-09T10:00', 1000)];
    expect(hydrationStreak(drinks, 2000, today).current).toBe(0);
  });

  it('remembers the best streak', () => {
    const drinks = ['01', '02', '03', '04', '08'].map((d) => glass(`2026-03-${d}T10:00`));
    expect(hydrationStreak(drinks, 2000, today).best).toBe(4);
  });
});

describe('caffeine and alcohol', () => {
  const coffee = { ...drink('2026-03-02T08:00', 200), caffeineMg: 80 };
  const wine = { ...drink('2026-03-02T20:00', 150), alcohol: true };

  it('leaves alcoholic drinks out of hydration', () => {
    expect(waterByDay([coffee, wine]).get('2026-03-02')).toBe(200);
  });

  it('adds up caffeine per day', () => {
    expect(caffeineByDay([coffee, { ...coffee, time: at('2026-03-02T14:00') }]).get('2026-03-02')).toBe(160);
  });

  it('lists the days with alcohol', () => {
    expect([...alcoholDays([coffee, wine])]).toEqual(['2026-03-02']);
  });
});

describe('hydrationBefore', () => {
  const start = at('2026-03-20T12:00');
  const daily = Array.from({ length: 10 }, (_, i) => drink(`2026-03-${String(i + 5).padStart(2, '0')}T10:00`, 2000));

  it('adds up the 72 hours before a headache', () => {
    const recent = [drink('2026-03-18T10:00', 1000), drink('2026-03-19T10:00', 500), drink('2026-03-20T13:00', 700)];
    expect(hydrationBefore([...daily, ...recent], start).ml).toBe(1500);
  });

  it('scales the usual daily amount to 72 hours', () => {
    expect(hydrationBefore(daily, start).usual).toBe(6000);
  });

  it('has no usual amount with less than a week of drinks', () => {
    expect(hydrationBefore(daily.slice(0, 3), start).usual).toBeNull();
  });
});

describe('timeline and compareDays', () => {
  const now = at('2026-03-20T12:00');
  const keys = Array.from({ length: 10 }, (_, i) => `2026-03-${String(i + 10).padStart(2, '0')}`);
  const night = (day: string, hours: number): Night => ({ day, start: 0, end: 0, asleepMs: hours * 3600000, breaks: [], source: 'screen' });
  const weather = (day: string, drop: number): WeatherDay => ({ day, pressure: 1010, pressureDrop: drop, tempMax: 10, tempMin: 2, humidity: 70, precipitation: 0, code: 0 });
  // Headaches start on the 12th, 15th and 18th; the day before each, little was drunk and the night was short.
  const headacheStarts = ['2026-03-12', '2026-03-15', '2026-03-18'];
  const data = {
    episodes: headacheStarts.map((d) => episode(`${d}T09:00`, `${d}T11:00`, 6)),
    drinks: keys.flatMap((k) => [drink(`${k}T10:00`, headacheStarts.includes(dayKeyAfter(k)) ? 1000 : 2000)]),
    sleep: new Map(keys.map((k) => [k, night(k, headacheStarts.includes(k) ? 5 : 8)])),
    weather: new Map(keys.map((k) => [k, weather(k, headacheStarts.some((h) => dayKeyAfter(h) === k) ? 8 : 1)]))
  };

  function dayKeyAfter(k: string): string {
    const d = new Date(`${k}T12:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  it('leaves hydration unknown before the first logged drink', () => {
    const series = timeline({ ...data, drinks: data.drinks.slice(3) }, keys, now);
    expect([series.hydration[0], series.hydration[3]]).toEqual([null, 2000]);
  });

  it('leaves hydration unknown after today', () => {
    const series = timeline(data, ['2026-03-20', '2026-03-21'], at('2026-03-20T12:00'));
    expect(series.hydration[1]).toBeNull();
  });

  it('gives one value per day with headache intensity and hydration', () => {
    const series = timeline(data, keys, now);
    expect([series.headache[2], series.headache[3], series.hydration[1]]).toEqual([6, 0, 1000]);
  });

  it('compares headache days with clear days per factor', () => {
    const rows = Object.fromEntries(compareDays(data, keys, now).map((r) => [r.key, [r.headache, r.clear]]));
    expect(rows).toEqual({ hydration: [1000, 2000], sleep: [5, 8], pressure: [1, 0] });
  });

  it('leaves out factors with fewer than three days on a side', () => {
    expect(compareDays({ ...data, episodes: data.episodes.slice(0, 2) }, keys, now)).toEqual([]);
  });
});

describe('dayFactors', () => {
  const night = (day: string, hours: number): Night => ({ day, start: 0, end: 0, asleepMs: hours * 3600000, breaks: [], source: 'screen' });
  const weather = (day: string, drop: number): WeatherDay => ({ day, pressure: 1005, pressureDrop: drop, tempMax: 10, tempMin: 2, humidity: 70, precipitation: 0, code: 0 });

  it('names every unfavourable factor of the day', () => {
    const data = {
      drinks: [drink('2026-03-01T10:00', 2000), drink('2026-03-09T10:00', 600), { ...drink('2026-03-09T20:00', 150), alcohol: true }],
      sleep: new Map([['2026-03-10', night('2026-03-10', 4.5)]]),
      weather: new Map([['2026-03-11', weather('2026-03-11', 8)]])
    };
    expect(dayFactors(data, '2026-03-10', 2000)).toEqual({ pressure: 8, hydration: 600, sleep: 4.5, alcohol: true });
  });

  it('names nothing on a good day', () => {
    const data = { drinks: [drink('2026-03-09T10:00', 2500)], sleep: new Map([['2026-03-10', night('2026-03-10', 7.5)]]), weather: new Map([['2026-03-10', weather('2026-03-10', 2)]]) };
    expect(dayFactors(data, '2026-03-10', 2000)).toEqual({});
  });

  it('does not call the day before the first drink a dry day', () => {
    const data = { drinks: [drink('2026-03-10T10:00', 2000)], sleep: new Map(), weather: new Map() };
    expect(dayFactors(data, '2026-03-10', 2000)).toEqual({});
  });
});

describe('hydrationCurve', () => {
  it('adds up each day from midnight and stops at now', () => {
    const curve = hydrationCurve([drink('2026-03-01T09:00', 250), drink('2026-03-02T10:00', 500), drink('2026-03-02T15:00', 300)], ['2026-03-01', '2026-03-02', '2026-03-03'], at('2026-03-02T12:00'));
    expect(curve.map((d) => d.points.map((p) => p.ml))).toEqual([
      [0, 0, 250, 250],
      [0, 0, 500, 500]
    ]);
  });

  it('ends today at now', () => {
    const curve = hydrationCurve([], ['2026-03-02'], at('2026-03-02T12:00'));
    expect(curve[0].points.at(-1)!.time).toBe(at('2026-03-02T12:00'));
  });
});

describe('usualCaffeine', () => {
  /** Logging starts on Oct 1 with 3 × 120 mg a day; Oct 10 has water but no coffee. */
  const day = (d: number, h: number) => new Date(2026, 9, d, h).getTime();
  const drinks: Drink[] = [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((d) => [8, 11, 14].map((h): Drink => ({ id: 1, time: day(d, h), presetId: null, name: 'Coffee', emoji: '☕', ml: 200, caffeineMg: 120 }))),
    { id: 2, time: day(10, 8), presetId: null, name: 'Water', emoji: '🥛', ml: 250 }
  ];
  const input = { drinks, sleep: new Map(), weather: new Map(), goalMl: 250 };

  it('averages only the days since the first logged drink', () => {
    expect(usualCaffeine(caffeineByDay(drinks), firstDrinkDay(drinks), '2026-10-10')).toBe(360);
  });

  it('is null with fewer than 7 logged days', () => {
    const recent = drinks.filter((d) => d.time >= day(5, 0));
    expect(usualCaffeine(caffeineByDay(recent), firstDrinkDay(recent), '2026-10-10')).toBeNull();
  });

  it('is null without any caffeine', () => {
    expect(usualCaffeine(new Map(), '2026-10-01', '2026-10-10')).toBeNull();
  });

  it('is the amount the forecast judges against', () => {
    expect(prognosis(input, day(10, 18)).caffeine.usual).toBe(usualCaffeine(caffeineByDay(drinks), firstDrinkDay(drinks), '2026-10-10'));
  });

  it('makes the forecast and the report agree on a caffeine drop', () => {
    expect([prognosis(input, day(10, 18)).caffeine.status, dayFactors(input, '2026-10-10', 250).caffeine]).toEqual(['bad', 0]);
  });
});

describe('conflictingOngoing', () => {
  const ongoing = { ...episode('2026-03-02T09:00', null), id: 1 };
  const ended = { ...episode('2026-03-01T09:00', '2026-03-01T12:00'), id: 2 };

  it('finds no conflict for the ongoing episode itself', () => {
    expect(conflictingOngoing([ongoing, ended], ongoing)).toBeUndefined();
  });

  it('finds the other ongoing episode when another one is saved as ongoing', () => {
    expect(conflictingOngoing([ongoing, ended], { ...ended, end: null })).toBe(ongoing);
  });

  it('finds the ongoing episode for a new ongoing one', () => {
    expect(conflictingOngoing([ongoing], { end: null })).toBe(ongoing);
  });

  it('finds no conflict for an episode saved with an end', () => {
    expect(conflictingOngoing([ongoing, ended], ended)).toBeUndefined();
  });
});

describe('waterOn', () => {
  it('adds up the drinks of that calendar day and leaves out alcohol', () => {
    const drinks = [drink('2026-03-01T23:59', 500), drink('2026-03-02T00:00', 250), drink('2026-03-02T23:59', 300), { ...drink('2026-03-02T20:00', 150), alcohol: true }, drink('2026-03-03T00:00', 400)];
    expect(waterOn(drinks, at('2026-03-02T12:00'))).toBe(550);
  });
});

describe('average', () => {
  it.each([
    [[], null],
    [[1, 2, 6], 3]
  ])('of %j is %s', (values, expected) => {
    expect(average(values)).toBe(expected);
  });
});

describe('medicationEffect', () => {
  const intakes = [
    intake('2026-03-02T08:00', 'analgesic', 'Ibuprofen', 2),
    intake('2026-03-02T18:00', 'analgesic', 'Ibuprofen', null),
    intake('2026-03-03T08:00', 'analgesic', 'Ibuprofen', 0),
    { ...intake('2026-03-04T08:00', 'analgesic', 'Ibuprofen', 2), dose: '600 mg' },
    intake('2026-03-04T09:00', 'triptan', 'Sumatriptan', 1),
    intake('2026-02-01T08:00', 'analgesic', 'Ibuprofen', 2)
  ];
  const from = at('2026-03-01T00:00');
  const to = at('2026-03-31T23:59');

  it('counts intakes, days and ratings per name, leaving out unrated intakes and other periods', () => {
    const [ibu] = medicationEffect(intakes, from, to, (i) => i.name);
    expect([ibu.name, ibu.intakes, ibu.days, ibu.relief, ibu.rated]).toEqual(['Ibuprofen', 4, 3, [1, 0, 2], 3]);
  });

  it('keeps doses apart when grouped by name and dose', () => {
    const rows = medicationEffect(intakes, from, to, (i) => `${i.name} ${i.dose}`);
    expect(rows.map((r) => [r.name, r.dose, r.intakes])).toEqual([
      ['Ibuprofen', '400 mg', 3],
      ['Ibuprofen', '600 mg', 1],
      ['Sumatriptan', '400 mg', 1]
    ]);
  });
});

describe('overuseRows', () => {
  const month = new Date('2026-03-15');

  it('has no row for several classes when only one class was used', () => {
    expect(overuseRows([intake('2026-03-02T08:00', 'analgesic'), intake('2026-03-03T08:00', 'analgesic')], month)).toEqual([{ key: 'analgesic', days: 2, limit: 15 }]);
  });

  it('adds one row for several classes once two classes were used', () => {
    const rows = overuseRows([intake('2026-03-02T08:00', 'analgesic'), intake('2026-03-02T09:00', 'triptan'), intake('2026-03-04T08:00', 'triptan')], month);
    expect(rows).toEqual([
      { key: 'analgesic', days: 1, limit: 15 },
      { key: 'triptan', days: 2, limit: 10 },
      { key: 'multiple', days: 2, limit: 10 }
    ]);
  });

  it('leaves out preventive medication and antiemetics', () => {
    expect(overuseRows([intake('2026-03-02T08:00', 'preventive'), intake('2026-03-02T09:00', 'antiemetic')], month)).toEqual([]);
  });
});

describe('monthSummary', () => {
  const now = at('2026-03-10T12:00');

  it('does not count a day with only an antiemetic as a medication day', () => {
    const data = { episodes: [], drinks: [], intakes: [intake('2026-03-02T08:00', 'antiemetic'), intake('2026-03-03T08:00', 'analgesic')] };
    expect(monthSummary(data, new Date('2026-03-01'), now).med).toBe(1);
  });

  it('averages water over the days up to today, counting days without drinks as 0', () => {
    const data = { episodes: [], intakes: [], drinks: [drink('2026-03-02T08:00', 2000), drink('2026-03-20T08:00', 5000)] };
    expect(monthSummary(data, new Date('2026-03-01'), now).water).toBe(200);
  });
});

describe('monthlyCounts', () => {
  it('counts across the turn of the year', () => {
    const data = { episodes: [episode('2025-12-31T22:00', '2026-01-01T02:00')], intakes: [intake('2025-12-30T08:00'), intake('2026-01-02T08:00')] };
    expect(monthlyCounts(data, at('2026-01-15T12:00'), 2).map((m) => [m.month.getMonth(), m.headache, m.med])).toEqual([
      [11, 1, 1],
      [0, 1, 1]
    ]);
  });

  it('goes back whole months from the 31st', () => {
    const months = monthlyCounts({ episodes: [], intakes: [] }, at('2026-03-31T12:00'), 3).map((m) => m.month.getMonth());
    expect(months).toEqual([0, 1, 2]);
  });
});

describe('sleepEfficiency and poorNight', () => {
  const H = 3600000;
  const night = (inBedHours: number, asleepHours: number) => ({ start: 0, end: inBedHours * H, asleepMs: asleepHours * H });

  it('gives the share of the night spent asleep', () => {
    expect(sleepEfficiency(night(8, 6))).toBe(0.75);
  });

  it.each([
    ['a 6 h continuous night', night(6, 6), { short: false, fragmented: false }],
    ['under 5 h asleep', night(4.9, 4.9), { short: true, fragmented: false }],
    ['8 h in bed with 1.5 h awake', night(8, 6.5), { short: false, fragmented: true }]
  ] as const)('judges %s', (_, n, expected) => {
    expect(poorNight(n)).toEqual(expected);
  });
});

describe('caffeineCurve', () => {
  const coffee = (time: string, mg: number): Drink => ({ ...drink(time, 200), caffeineMg: mg });

  it('adds up today\'s caffeine in time order, up to now', () => {
    const drinks = [coffee('2026-03-10T13:00', 80), coffee('2026-03-10T08:00', 100), coffee('2026-03-09T08:00', 100), coffee('2026-03-10T16:00', 50), drink('2026-03-10T09:00', 250)];
    expect(caffeineCurve(drinks, at('2026-03-10T15:00')).map((pt) => pt.mg)).toEqual([100, 180]);
  });
});

describe('usualCaffeineCurve', () => {
  const coffee = (time: string): Drink => ({ ...drink(time, 200), caffeineMg: 100 });

  it('is null before 7 days are logged', () => {
    expect(usualCaffeineCurve([coffee('2026-03-09T08:00')], '2026-03-10')).toBeNull();
  });

  it('rises at the time of day the usual coffee is taken', () => {
    const drinks = lastDays(at('2026-03-09T12:00'), 8).map((k) => coffee(`${k}T08:00`));
    const curve = usualCaffeineCurve(drinks, '2026-03-10', 60)!;
    expect([curve[7].mg, curve[9].mg]).toEqual([0, 100]);
  });
});

describe('alcoholPerDay', () => {
  it('counts alcoholic drinks per day over the last week, oldest first', () => {
    const beer = (time: string): Drink => ({ ...drink(time, 330), alcohol: true });
    const days = alcoholPerDay([beer('2026-03-09T20:00'), beer('2026-03-09T21:00'), beer('2026-03-01T20:00'), drink('2026-03-10T09:00', 250)], at('2026-03-10T15:00'));
    expect([days.length, days.at(-2), days.at(-1)]).toEqual([7, { key: '2026-03-09', n: 2 }, { key: '2026-03-10', n: 0 }]);
  });
});

describe('pressureAround', () => {
  const w = (day: string, drop: number): WeatherDay => ({ day, pressure: 1000, pressureDrop: drop, tempMax: 10, tempMin: 2, humidity: 70, precipitation: 0, code: 0 });

  it('marks the days before a drop, from yesterday to the day after tomorrow', () => {
    const weather = new Map(['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'].map((k, i) => [k, w(k, [0, 0, 8, 2, 9][i])]));
    expect(pressureAround(weather, at('2026-03-10T12:00')).map((d) => [d.offset, d.marked])).toEqual([[-1, false], [0, true], [1, false], [2, true]]);
  });
});
