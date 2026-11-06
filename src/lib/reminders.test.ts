import { beforeAll, describe, expect, it } from 'vitest';
import { i18n } from './i18n.svelte';

beforeAll(() => {
  i18n.lang = 'en';
});
import { planDrinkCheckins, planHeadacheChecks, planReminders, planRiskAlert, planSleepChecks } from './reminders';
import type { Prognosis } from './prognosis';

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

describe('planDrinkCheckins', () => {
  const on = { enabled: true, times: ['16:00', '10:00', '13:00'] };
  const drink = (time: string, name = 'Glass', ml = 250) => ({ time: at(time), name, emoji: '🥛', ml });

  it('plans nothing when switched off', () => {
    expect(planDrinkCheckins(at('2026-03-02T08:00'), { ...on, enabled: false }, 2000, [])).toEqual([]);
  });

  it('plans every time for each of the next 7 days, in order', () => {
    const plan = planDrinkCheckins(at('2026-03-02T08:00'), on, 2000, []);
    expect([plan.length, ...plan.slice(0, 3).map((r) => new Date(r.at).getHours())]).toEqual([21, 10, 13, 16]);
  });

  it('skips a check-in within an hour after the last drink', () => {
    const plan = planDrinkCheckins(at('2026-03-02T09:30'), on, 2000, [drink('2026-03-02T09:20')]);
    expect(new Date(plan[0].at).getHours()).toBe(13);
  });

  it('ignores a drink logged after the check-in time', () => {
    const plan = planDrinkCheckins(at('2026-03-02T08:00'), on, 2000, [drink('2026-03-02T20:00')]);
    expect(plan).toHaveLength(21);
  });

  it('lists the drinks since the previous check-in, the last three when expanded', () => {
    const drinks = [drink('2026-03-02T10:10'), drink('2026-03-02T11:00', 'Coffee', 200), drink('2026-03-02T11:40'), drink('2026-03-02T11:50', 'Tea', 300)];
    const [next] = planDrinkCheckins(at('2026-03-02T12:00'), on, 2000, drinks);
    expect([next.title, next.body, next.largeBody]).toEqual([
      '💧 What did you drink since 11:50?',
      'Since 10:00: Glass, Coffee, Glass, Tea · 1.0 l of 2.0 l today',
      '+1 more before\n11:00  🥛 Coffee  200 ml\n11:40  🥛 Glass  250 ml\n11:50  🥛 Tea  300 ml\n1.0 l of 2.0 l today'
    ]);
  });

  it('says so when nothing was logged since the previous check-in', () => {
    const [next] = planDrinkCheckins(at('2026-03-02T12:00'), on, 2000, [drink('2026-03-02T09:00')]);
    expect(next.body).toBe('Nothing logged since the 10:00 check-in · 0.25 l of 2.0 l today');
  });

  it('names the last drink of the day before at the first check-in', () => {
    const [first] = planDrinkCheckins(at('2026-03-02T08:00'), on, 2000, [drink('2026-03-01T21:30')]);
    expect([first.title, first.body]).toEqual(['💧 What did you drink?', 'Last drink: yesterday 21:30. 0.0 l of 2.0 l today']);
  });

  it('gives every check-in its own id', () => {
    const ids = planDrinkCheckins(at('2026-03-02T08:00'), { enabled: true, times: ['08:30', '09:00', '12:00', '18:00'] }, 2000, []).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('planRiskAlert', () => {
  const forecast = (light: 'green' | 'yellow' | 'red') => () =>
    ({
      light,
      bad: light === 'red' ? 3 : light === 'yellow' ? 2 : 0,
      weather: { status: light === 'green' ? 'ok' : 'bad', drop: 9 },
      hydration: { status: light === 'green' ? 'ok' : 'bad', today: 500, yesterday: 2000, expected: 1500, goal: 2000 },
      sleep: { status: light === 'red' ? 'bad' : 'ok', average: 7 },
      alcohol: { status: 'unknown', yesterday: false, today: false },
      caffeine: { status: 'unknown', today: 0, usual: null }
    }) as Prognosis;

  it('warns at the chosen hour when the forecast is not green, naming the factors', () => {
    const [alert] = planRiskAlert(at('2026-03-02T15:00'), { enabled: true, hour: 20 }, forecast('red'));
    expect([new Date(alert.at).getHours(), alert.body]).toEqual([20, 'Unfavourable: Weather, Hydration, Sleep. Details in HeadLog.']);
  });

  it('stays silent when the forecast is green', () => {
    expect(planRiskAlert(at('2026-03-02T15:00'), { enabled: true, hour: 20 }, forecast('green'))).toEqual([]);
  });

  it('stays silent after the hour has passed', () => {
    expect(planRiskAlert(at('2026-03-02T21:00'), { enabled: true, hour: 20 }, forecast('red'))).toEqual([]);
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
