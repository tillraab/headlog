import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The local-notifications plugin as the Android app sees it, recording every call. */
const plugin = vi.hoisted(() => ({
  calls: [] as string[],
  cancelDelay: 0,
  listener: null as ((event: { actionId: string; notification: { extra?: unknown } }) => void) | null,
  scheduled: [] as { id: number; actionTypeId?: string; autoCancel?: boolean; extra?: unknown }[][]
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    cancel: vi.fn(async ({ notifications }: { notifications: { id: number }[] }) => {
      const delay = plugin.cancelDelay;
      plugin.cancelDelay = 0;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      plugin.calls.push(`cancel ${notifications[0].id}-${notifications.at(-1)!.id}`);
    }),
    schedule: vi.fn(async ({ notifications }: { notifications: { id: number }[] }) => {
      plugin.calls.push(`schedule ${notifications.map((n) => n.id).join(',')}`);
      plugin.scheduled.push(notifications);
    }),
    requestPermissions: vi.fn(async () => {
      plugin.calls.push('permission');
      return { display: 'granted' };
    }),
    registerActionTypes: vi.fn(async () => {
      plugin.calls.push('actions');
    }),
    addListener: vi.fn((_event: string, listener: typeof plugin.listener) => {
      plugin.listener = listener;
      return Promise.resolve({ remove: async () => {} });
    })
  }
}));

const { applyDrinkReminders, applyHeadacheChecks, applyReminders, applyRiskAlert, applySleepChecks, onNotificationAction, RANGES } = await import('./reminders');

const reminder = (id: number) => ({ id, at: Date.now() + 3600000, title: 't', body: 'b' });

beforeEach(() => {
  plugin.calls = [];
  plugin.scheduled = [];
});

describe('apply functions', () => {
  it.each([
    ['water', () => applyReminders([]), '100-113'],
    ['headache', () => applyHeadacheChecks([]), '200-211'],
    ['drink', () => applyDrinkReminders([]), '300-353'],
    ['risk', () => applyRiskAlert([]), '400-400'],
    ['sleep', () => applySleepChecks([]), '500-501']
  ])('%s cancels exactly its own range', async (_kind, apply, range) => {
    await apply();
    expect(plugin.calls).toEqual([`cancel ${range}`]);
  });

  it('asks for the permission before scheduling water reminders', async () => {
    await applyReminders([reminder(100)]);
    expect(plugin.calls).toEqual(['cancel 100-113', 'permission', 'schedule 100']);
  });

  it('registers the buttons for the headache question and passes the episode', async () => {
    await applyHeadacheChecks([{ ...reminder(200), episodeId: 7 }]);
    expect([plugin.calls, plugin.scheduled[0][0].actionTypeId, plugin.scheduled[0][0].extra]).toEqual([
      ['cancel 200-211', 'permission', 'actions', 'schedule 200'],
      'headache',
      { episodeId: 7 }
    ]);
  });

  it('schedules drink reminders that close on tap, without buttons', async () => {
    await applyDrinkReminders([reminder(300)]);
    const [n] = plugin.scheduled[0];
    expect([n.autoCancel, n.actionTypeId, n.extra]).toEqual([true, undefined, undefined]);
  });

  it('schedules a later call after an earlier one whose cancel resolves late', async () => {
    plugin.cancelDelay = 20;
    await Promise.all([applyReminders([reminder(100)]), applyReminders([reminder(101)])]);
    expect(plugin.calls.filter((c) => c.startsWith('schedule'))).toEqual(['schedule 100', 'schedule 101']);
  });
});

describe('onNotificationAction', () => {
  function answers() {
    const log: unknown[][] = [];
    onNotificationAction({
      opened: () => log.push(['opened']),
      relief: (...args) => log.push(['relief', ...args]),
      headacheGone: (...args) => log.push(['headacheGone', ...args]),
      sleepOk: (...args) => log.push(['sleepOk', ...args]),
      sleepFix: (...args) => log.push(['sleepFix', ...args])
    });
    return log;
  }

  it.each([
    ['relief-2', { intakeId: 4, time: 1000 }, ['relief', 4, 2, 1000]],
    ['headache-gone', { episodeId: 9 }, ['headacheGone', 9]],
    ['sleep-fix', { day: '2026-03-10' }, ['sleepFix', '2026-03-10']],
    ['sleep-ok', { day: '2026-03-10' }, ['sleepOk', '2026-03-10']]
  ])('routes %s', (actionId, extra, expected) => {
    const log = answers();
    plugin.listener!({ actionId, notification: { extra } });
    expect(log).toEqual([['opened'], expected]);
  });

  it('only opens the app for a plain tap', () => {
    const log = answers();
    plugin.listener!({ actionId: 'tap', notification: {} });
    expect(log).toEqual([['opened']]);
  });
});

describe('RANGES', () => {
  it('do not overlap', () => {
    const ranges = Object.values(RANGES).sort((a, b) => a.first - b.first);
    expect(ranges.every((r, i) => i === 0 || ranges[i - 1].first + ranges[i - 1].count <= r.first)).toBe(true);
  });
});
