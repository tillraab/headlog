import { beforeEach, describe, expect, it } from 'vitest';
import { createBackup, createCsv, isBackup, restoreBackup, wipe } from './backup';
import { HeadLogDb, seed } from './db';
import { loadDemo } from './demo';
import { prognosis } from './prognosis';
import { hydrationStreak } from './analysis';

let db: HeadLogDb;

beforeEach(async () => {
  db = new HeadLogDb(`test-${Math.random()}`);
  await seed(db);
});

describe('backup', () => {
  it('restores exactly what was exported', async () => {
    await loadDemo(new Date('2026-03-31T18:00').getTime(), db);
    const backup = await createBackup(db);
    await wipe(db);
    await restoreBackup(JSON.parse(JSON.stringify(backup)), db);
    expect(await createBackup(db)).toEqual({ ...backup, exportedAt: expect.any(String) });
  });

  it.each([null, {}, { app: 'headlog', version: 2, tables: {} }, { app: 'other' }])('rejects %j', (value) => {
    expect(isBackup(value)).toBe(false);
  });

  it.each(['drinks', 'settings'] as const)('rejects a backup without %s', async (table) => {
    const backup = await createBackup(db);
    delete (backup.tables as Partial<typeof backup.tables>)[table];
    expect(isBackup(backup)).toBe(false);
  });
});

describe('seed', () => {
  it('adds the default lists only once', async () => {
    await seed(db);
    expect(await db.medications.count()).toBe(3);
  });

  it('restores the default lists after a wipe', async () => {
    await wipe(db);
    await seed(db);
    expect(await db.drinkPresets.count()).toBe(4);
  });
});

describe('createCsv', () => {
  it('writes one line per headache and intake, sorted by time', async () => {
    await db.intakes.add({ time: new Date('2026-03-02T10:00').getTime(), medId: 1, name: 'Ibuprofen', dose: '400 mg', category: 'analgesic', relief: 2 });
    await db.episodes.add({ start: new Date('2026-03-02T09:00').getTime(), end: new Date('2026-03-02T11:30').getTime(), intensity: 6, tags: ['stress'], note: 'a, b' });
    expect((await createCsv(db)).split('\n')).toEqual([
      'type,start,end,minutes,intensity,medication,category,tags_or_relief,note',
      'headache,2026-03-02 09:00,2026-03-02 11:30,150,6,,,stress,"a, b"',
      'medication,2026-03-02 10:00,,,,Ibuprofen 400 mg,analgesic,2,',
      ''
    ]);
  });
});

describe('createCsv with special characters', () => {
  it('quotes a note with a quote, a semicolon and a line break, and leaves an ongoing headache open', async () => {
    await db.episodes.add({ start: new Date('2026-03-02T09:00').getTime(), end: null, intensity: 4, tags: [], note: 'said "ouch"; then\nslept' });
    const csv = await createCsv(db, 0, new Date('2026-03-02T12:00').getTime());
    expect(csv.split('\n').slice(1, 3)).toEqual(['headache,2026-03-02 09:00,,,4,,,,"said ""ouch""; then', 'slept"']);
  });
});

describe('createCsv with a start', () => {
  it('leaves out entries before the start', async () => {
    await db.intakes.add({ time: new Date('2026-01-10T10:00').getTime(), medId: 1, name: 'Old', dose: '', category: 'analgesic', relief: null });
    await db.intakes.add({ time: new Date('2026-03-10T10:00').getTime(), medId: 1, name: 'New', dose: '', category: 'analgesic', relief: null });
    const csv = await createCsv(db, new Date('2026-03-01').getTime(), new Date('2026-03-31').getTime());
    expect([csv.includes('New'), csv.includes('Old')]).toEqual([true, false]);
  });
});

describe('loadDemo', () => {
  it('creates no entries in the future', async () => {
    const now = new Date('2026-03-31T09:00').getTime();
    await loadDemo(now, db);
    const latest = await db.drinks.orderBy('time').last();
    expect(latest!.time).toBeLessThanOrEqual(now);
  });
});

describe('restoreBackup', () => {
  it('keeps the previous data when a row cannot be added', async () => {
    await db.episodes.add({ start: 1, end: 2, intensity: 5, tags: [], note: 'kept' });
    const backup = await createBackup(db);
    backup.tables.episodes = [
      { id: 1, start: 1, end: 2, intensity: 5, tags: [], note: '' },
      { id: 1, start: 3, end: 4, intensity: 5, tags: [], note: '' }
    ];
    await restoreBackup(backup, db).catch(() => {});
    expect((await db.episodes.toArray()).map((e) => e.note)).toEqual(['kept']);
  });
});

describe('older backups', () => {
  it('restore without the sleep table, which replaces the nights with none', async () => {
    const backup = await createBackup(db);
    delete backup.tables.sleep;
    await db.sleep.put({ day: '2026-03-10', start: 1, end: 2, asleepMs: 1, breaks: [], source: 'manual' });
    await restoreBackup(backup, db);
    expect([isBackup(backup), await db.sleep.count()]).toEqual([true, 0]);
  });
});

describe('demo data', () => {
  it('shows a red forecast', async () => {
    const now = new Date('2026-03-31T18:00').getTime();
    await loadDemo(now, db);
    const forecast = prognosis(
      {
        drinks: await db.drinks.toArray(),
        sleep: new Map((await db.sleep.toArray()).map((n) => [n.day, n])),
        weather: new Map((await db.weather.toArray()).map((w) => [w.day, w])),
        goalMl: 2000
      },
      now
    );
    expect(forecast.light).toBe('red');
  });

  it('has a hydration streak of four days', async () => {
    const now = new Date('2026-03-31T18:00').getTime();
    await loadDemo(now, db);
    expect(hydrationStreak(await db.drinks.toArray(), 2000, now).current).toBeGreaterThanOrEqual(4);
  });
});
