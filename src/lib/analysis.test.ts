import { describe, expect, it } from 'vitest';
import { alcoholDays, caffeineByDay, compareDays, headacheDays, hydrationBefore, hydrationStreak, intakeDays, medicationLimits, monthlyCategoryDays, periodStats, rollingMedDays, ruleStatus, tenTwenty, timeline, waterByDay } from './analysis';
import type { Drink, Episode, Intake, MedCategory, Medication, Night, WeatherDay } from './db';
import { lastDays } from './days';

const at = (s: string) => new Date(s).getTime();

function episode(start: string, end: string | null, intensity = 5, tags: string[] = []): Episode {
  return { id: 1, start: at(start), end: end ? at(end) : null, intensity, tags, note: '' };
}

function intake(time: string, category: MedCategory = 'analgesic', name = 'Ibuprofen', relief: number | null = null): Intake {
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

  it('reports over the limit at 11 days', () => {
    const med = new Set(lastDays(today, 11));
    expect(tenTwenty(med, today).status).toBe('over');
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

describe('rollingMedDays', () => {
  it('matches tenTwenty for every day', () => {
    const today = at('2026-03-31T12:00');
    const med = new Set(['2026-01-15', '2026-02-10', '2026-02-11', '2026-03-01', '2026-03-30']);
    const rolling = rollingMedDays(med, today, 60);
    expect(rolling.map((r) => r.count)).toEqual(rolling.map((r) => tenTwenty(med, new Date(r.key)).count));
  });

  it('returns one entry per day of the span', () => {
    expect(rollingMedDays(new Set(), at('2026-03-31T12:00'), 90)).toHaveLength(90);
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
    weather: new Map(keys.map((k) => [k, weather(k, headacheStarts.includes(k) ? 8 : 1)]))
  };

  function dayKeyAfter(k: string): string {
    const d = new Date(`${k}T12:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  it('gives one value per day with headache intensity and hydration', () => {
    const series = timeline(data, keys, now);
    expect([series.headache[2], series.headache[3], series.hydration[1]]).toEqual([6, 0, 1000]);
  });

  it('compares headache days with clear days per factor', () => {
    const rows = Object.fromEntries(compareDays(data, keys, now, 6).map((r) => [r.key, [r.headache, r.clear]]));
    expect(rows).toEqual({ hydration: [1000, 2000], sleep: [5, 8], pressure: [1, 0] });
  });

  it('leaves out factors with fewer than three days on a side', () => {
    expect(compareDays({ ...data, episodes: data.episodes.slice(0, 2) }, keys, now, 6)).toEqual([]);
  });
});
