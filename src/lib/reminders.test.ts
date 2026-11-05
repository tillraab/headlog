import { describe, expect, it } from 'vitest';
import { planReminders } from './reminders';

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
