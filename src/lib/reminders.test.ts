import { describe, expect, it } from 'vitest';
import { planDrinkReminders, planHeadacheChecks, planReminders, planRiskAlert, planSleepChecks, planAll, RANGES, type ReminderData } from './reminders';
import type { TomorrowRisk } from './prognosis';

const at = (s: string) => new Date(s).getTime();
const on = { enabled: true, noon: 12, evening: 18 };

describe('planReminders', () => {
  it('plans nothing when reminders are off', () => {
    expect(planReminders(at('2026-03-02T08:00'), { ...on, enabled: false }, 2000, 0)).toEqual([]);
  });

  it('plans noon and evening for each of the next 7 days', () => {
    expect(planReminders(at('2026-03-02T08:00'), on, 2000, 0)).toHaveLength(14);
  });

  it('skips today at noon once half the goal is reached', () => {
    const today = planReminders(at('2026-03-02T08:00'), on, 2000, 1000).filter((r) => r.at < at('2026-03-03T00:00'));
    expect(today.map((r) => new Date(r.at).getHours())).toEqual([18]);
  });

  it('skips today entirely once the goal is reached', () => {
    const plan = planReminders(at('2026-03-02T08:00'), on, 2000, 2000);
    expect(plan.some((r) => r.at < at('2026-03-03T00:00'))).toBe(false);
  });

  it('leaves out times that have passed', () => {
    const plan = planReminders(at('2026-03-02T13:00'), on, 2000, 0);
    expect(new Date(plan[0].at).getHours()).toBe(18);
  });

  it('reminds at noon local time on the day summer time starts', () => {
    const [noon] = planReminders(at('2026-03-29T08:00'), on, 2000, 0);
    expect(noon.at).toBe(at('2026-03-29T12:00'));
  });

  it('gives every reminder its own id', () => {
    const ids = planReminders(at('2026-03-02T08:00'), on, 2000, 0).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('planHeadacheChecks', () => {
  const ongoing = { id: 7, start: at('2026-03-02T08:00'), end: null };

  it('plans nothing without an ongoing headache', () => {
    expect(planHeadacheChecks({ ...ongoing, end: at('2026-03-02T09:00') }, at('2026-03-02T10:00'), 3)).toEqual([]);
  });

  it('plans nothing when switched off', () => {
    expect(planHeadacheChecks(ongoing, at('2026-03-02T09:00'), 0)).toEqual([]);
  });

  it('asks every n hours counted from the start, beginning with the next one', () => {
    const plan = planHeadacheChecks(ongoing, at('2026-03-02T12:00'), 3);
    expect(plan.slice(0, 2).map((r) => new Date(r.at).getHours())).toEqual([14, 17]);
  });

  it('plans 12 checks for the episode', () => {
    const plan = planHeadacheChecks(ongoing, at('2026-03-02T09:00'), 2);
    expect([plan.length, plan.every((r) => r.episodeId === 7)]).toEqual([12, true]);
  });
});

describe('planDrinkReminders', () => {
  const on = { enabled: true, from: 8, to: 20, everyHours: 2 };
  const drink = (time: string) => ({ time: at(time), name: 'Glass', emoji: '🥛' });

  it('plans nothing when switched off', () => {
    expect(planDrinkReminders(at('2026-03-02T07:00'), { ...on, enabled: false }, [])).toEqual([]);
  });

  it('reminds every 2 h from the window start on a day without drinks', () => {
    const today = planDrinkReminders(at('2026-03-02T07:00'), on, []).filter((r) => r.at < at('2026-03-03T00:00'));
    expect(today.map((r) => new Date(r.at).getHours())).toEqual([10, 12, 14, 16, 18, 20]);
  });

  it('counts from the last drink and names it', () => {
    const [next] = planDrinkReminders(at('2026-03-02T11:00'), on, [drink('2026-03-02T10:30')]);
    expect([next.at, next.body]).toEqual([at('2026-03-02T12:30'), 'Last drink 2h 00m ago: 🥛 Glass. Log it in HeadLog when you drink.']);
  });

  it('ignores yesterday’s drinks and stays inside the window', () => {
    const plan = planDrinkReminders(at('2026-03-02T19:00'), on, [drink('2026-03-01T21:00')]);
    expect(plan.filter((r) => r.at < at('2026-03-03T00:00')).map((r) => new Date(r.at).getHours())).toEqual([20]);
  });

  it('stops at 18 reminders a day', () => {
    const today = planDrinkReminders(at('2026-03-02T04:00'), { ...on, from: 5, to: 23, everyHours: 0.5 }, []).filter((r) => r.at < at('2026-03-03T00:00'));
    expect(today).toHaveLength(18);
  });

  it('plans nothing when the window ends before it starts', () => {
    expect(planDrinkReminders(at('2026-03-02T07:00'), { ...on, from: 20, to: 8 }, [])).toEqual([]);
  });

  it('counts from the window start when the last drink came before it', () => {
    const [next] = planDrinkReminders(at('2026-03-02T07:30'), on, [drink('2026-03-02T07:00')]);
    expect(next.at).toBe(at('2026-03-02T10:00'));
  });

  it('plans today and the next two days with distinct ids', () => {
    const plan = planDrinkReminders(at('2026-03-02T07:00'), { ...on, everyHours: 1 }, []);
    expect([plan.length, new Set(plan.map((r) => r.id)).size]).toEqual([36, 36]);
  });
});

describe('planRiskAlert', () => {
  const risk = (light: 'green' | 'yellow' | 'red', factors: TomorrowRisk['factors'] = []) => () => ({ light, factors });

  it('warns at the chosen hour when tomorrow is not green, naming the reasons', () => {
    const [alert] = planRiskAlert(at('2026-03-02T15:00'), { enabled: true, hour: 20 }, risk('red', ['weather', 'alcohol']));
    expect([new Date(alert.at).getHours(), alert.body]).toEqual([20, 'Unfavourable: pressure drop tomorrow, alcohol today. Details in HeadLog.']);
  });

  it('stays silent when tomorrow is green', () => {
    expect(planRiskAlert(at('2026-03-02T15:00'), { enabled: true, hour: 20 }, risk('green'))).toEqual([]);
  });

  it('stays silent after the hour has passed', () => {
    expect(planRiskAlert(at('2026-03-02T21:00'), { enabled: true, hour: 20 }, risk('yellow', ['hydration']))).toEqual([]);
  });
});


describe('planSleepChecks', () => {
  const settings = { enabled: true, hour: 9 };
  const night = (source: 'screen' | 'manual') =>
    new Map([['2026-03-10', { day: '2026-03-10', start: at('2026-03-09T23:40'), end: at('2026-03-10T06:55'), asleepMs: 7.25 * 3600000, breaks: [], source }]]);

  it('asks this morning with the estimated times, and tomorrow morning', () => {
    const plan = planSleepChecks(at('2026-03-10T07:30'), settings, night('screen'));
    expect(plan.map((r) => [r.day, r.at, r.body.includes('23:40–06:55')])).toEqual([
      ['2026-03-10', at('2026-03-10T09:00'), true],
      ['2026-03-11', at('2026-03-11T09:00'), false]
    ]);
  });

  it('skips a night that is already confirmed', () => {
    expect(planSleepChecks(at('2026-03-10T07:30'), settings, night('manual')).map((r) => r.day)).toEqual(['2026-03-11']);
  });

  it('plans nothing when switched off', () => {
    expect(planSleepChecks(at('2026-03-10T07:30'), { ...settings, enabled: false }, night('screen'))).toEqual([]);
  });
});

describe('id ranges', () => {
  it('hold every planned reminder of one moment, without duplicate ids', () => {
    const now = at('2026-03-02T00:30');
    const plans = {
      water: planReminders(now, on, 2000, 0),
      headache: planHeadacheChecks({ id: 1, start: now, end: null }, now, 1),
      drink: planDrinkReminders(now, { enabled: true, from: 5, to: 23, everyHours: 0.5 }, []),
      risk: planRiskAlert(now, { enabled: true, hour: 20 }, () => ({ light: 'red', factors: ['weather', 'alcohol'] })),
      sleep: planSleepChecks(now, { enabled: true, hour: 9 }, new Map())
    };
    const outside = Object.entries(plans).flatMap(([kind, plan]) => {
      const range = RANGES[kind as keyof typeof RANGES];
      return plan.filter((r) => r.id < range.first || r.id >= range.first + range.count).map((r) => `${kind} ${r.id}`);
    });
    const ids = Object.values(plans).flatMap((plan) => plan.map((r) => r.id));
    expect([outside, new Set(ids).size, ids.length]).toEqual([[], 83, 83]);
  });
});

describe('planAll', () => {
  const now = at('2026-03-10T07:30');
  const night = { day: '2026-03-10', start: at('2026-03-09T23:00'), end: at('2026-03-10T07:00'), asleepMs: 8 * 3600000, breaks: [], source: 'screen' as const };
  const data = (settings: Partial<ReminderData['settings']> = {}, drinks: ReminderData['drinks'] = []): ReminderData => ({
    episodes: [],
    drinks,
    sleep: new Map([[night.day, night]]),
    weather: new Map(),
    settings: {
      reminders: { enabled: true, noon: 12, evening: 18 },
      waterGoalMl: 2000,
      headacheCheckHours: 3,
      drinkReminder: { enabled: true, from: 8, to: 20, everyHours: 2 },
      riskAlert: { enabled: true, hour: 20 },
      sleep: { enabled: true },
      sleepCheck: { enabled: true, hour: 9 },
      ...settings
    }
  });

  it('asks about sleep only while sleep estimates are on', () => {
    expect([planAll(data(), now).sleep.length, planAll(data({ sleep: { enabled: false } }), now).sleep.length]).toEqual([2, 0]);
  });

  it("counts today's water for the water reminders", () => {
    const drinks = [{ id: 1, time: at('2026-03-10T07:00'), presetId: 1, name: 'Bottle', emoji: '🍶', ml: 1000 }];
    const today = planAll(data({}, drinks), now).water.filter((r) => r.at < at('2026-03-11T00:00'));
    expect(today.map((r) => new Date(r.at).getHours())).toEqual([18]);
  });

  it("counts the drink reminder from today's last drink", () => {
    const drinks = [{ id: 1, time: at('2026-03-10T07:15'), presetId: 1, name: 'Tea', emoji: '🍵', ml: 300 }];
    expect(planAll(data({}, drinks), now).drink[0].at).toBe(at('2026-03-10T10:00'));
  });

  it('asks about a headache only while one is ongoing', () => {
    const ongoing = { ...data(), episodes: [{ id: 3, start: at('2026-03-10T06:00'), end: null, intensity: 5, tags: [], note: '' }] };
    expect([planAll(data(), now).headache.length, planAll(ongoing, now).headache[0].episodeId]).toEqual([0, 3]);
  });
});
