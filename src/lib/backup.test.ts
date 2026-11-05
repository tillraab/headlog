import { beforeEach, describe, expect, it } from 'vitest';
import { createBackup, createCsv, isBackup, restoreBackup, wipe } from './backup';
import { HeadLogDb, seed } from './db';
import { loadDemo } from './demo';

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

describe('createCsv with a start', () => {
  it('leaves out entries before the start', async () => {
    await db.intakes.add({ time: new Date('2026-01-10T10:00').getTime(), medId: 1, name: 'Old', dose: '', category: 'analgesic', relief: null });
    await db.intakes.add({ time: new Date('2026-03-10T10:00').getTime(), medId: 1, name: 'New', dose: '', category: 'analgesic', relief: null });
    const csv = await createCsv(db, new Date('2026-03-01').getTime());
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
