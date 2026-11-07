import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HeadLogDb, type Night } from './db';

/** The ScreenEvents plugin of the Android app, answering with fixed events. */
const plugin = vi.hoisted(() => ({
  granted: true,
  events: [] as { time: number; on: boolean }[]
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({
    hasAccess: async () => ({ supported: true, granted: plugin.granted }),
    events: async () => ({ events: plugin.events }),
    openSettings: async () => {}
  })
}));

const { syncNights } = await import('./sleep');

const at = (s: string) => new Date(s).getTime();
const now = at('2026-03-10T12:00');
let db: HeadLogDb;

beforeEach(() => {
  db = new HeadLogDb(`sleep-${Math.random()}`);
  plugin.granted = true;
  plugin.events = [
    { time: at('2026-03-08T23:00'), on: false },
    { time: at('2026-03-09T07:00'), on: true },
    { time: at('2026-03-09T23:30'), on: false },
    { time: at('2026-03-10T06:30'), on: true }
  ];
});

describe('syncNights', () => {
  it('stores the estimated nights', async () => {
    await syncNights(db, 8, now);
    expect((await db.sleep.toArray()).map((n) => [n.day, n.source])).toEqual([
      ['2026-03-09', 'screen'],
      ['2026-03-10', 'screen']
    ]);
  });

  it('leaves a night the user set exactly as it is', async () => {
    const manual: Night = { day: '2026-03-10', start: at('2026-03-09T22:00'), end: at('2026-03-10T08:00'), asleepMs: 10 * 3600000, breaks: [], source: 'manual' };
    await db.sleep.put(manual);
    await syncNights(db, 8, now);
    expect(await db.sleep.get('2026-03-10')).toEqual(manual);
  });

  it('does nothing without usage access', async () => {
    plugin.granted = false;
    await syncNights(db, 8, now);
    expect(await db.sleep.count()).toBe(0);
  });
});
