import { describe, expect, it } from 'vitest';
import { headacheDays, intakeDays, monthlyCategoryDays, periodStats, rollingMedDays, ruleStatus, tenTwenty } from './analysis';
import type { Drink, Episode, Intake, MedCategory } from './db';
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

  it('compares water before headache days with water before clear days', () => {
    expect([stats.waterBeforeHeadache, stats.waterBeforeClear]).toEqual([1100, 2200]);
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
