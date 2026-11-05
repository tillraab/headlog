import { describe, expect, it } from 'vitest';
import { planDrinkCheckins, planHeadacheChecks, planReminders } from './reminders';

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
  const on = { enabled: true, times: ['16:00', '10:00'] };

  it('plans nothing when switched off', () => {
    expect(planDrinkCheckins(at('2026-03-02T08:00'), { ...on, enabled: false }, 2000, 0, null)).toEqual([]);
  });

  it('plans every time for each of the next 7 days, in order', () => {
    const plan = planDrinkCheckins(at('2026-03-02T08:00'), on, 2000, 0, null);
    expect([plan.length, new Date(plan[0].at).getHours(), new Date(plan[1].at).getHours()]).toEqual([14, 10, 16]);
  });

  it('skips a check-in within an hour after the last drink', () => {
    const plan = planDrinkCheckins(at('2026-03-02T09:30'), on, 2000, 250, at('2026-03-02T09:20'));
    expect(new Date(plan[0].at).getHours()).toBe(16);
  });

  it('keeps a check-in more than an hour after the last drink', () => {
    const plan = planDrinkCheckins(at('2026-03-02T08:30'), on, 2000, 250, at('2026-03-02T08:30'));
    expect(new Date(plan[0].at).getHours()).toBe(10);
  });

  it('ignores a drink logged after the check-in time', () => {
    const plan = planDrinkCheckins(at('2026-03-02T08:00'), on, 2000, 0, at('2026-03-02T20:00'));
    expect(plan).toHaveLength(14);
  });

  it('gives every check-in its own id', () => {
    const ids = planDrinkCheckins(at('2026-03-02T08:00'), { enabled: true, times: ['08:30', '09:00', '12:00', '18:00'] }, 2000, 0, null).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
