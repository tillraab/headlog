import { afterEach, describe, expect, it } from 'vitest';
import { createBackup } from './backup';
import { HeadLogDb, type Drink, type Episode, type Intake, type Medication, type Night } from './db';
import { loadDemo } from './demo';
import { i18n } from './i18n.svelte';
import { monthlyCounts } from './analysis';
import { doctorReport, reportData, type ReportInput } from './report';

const now = new Date('2026-03-31T18:00').getTime();

async function demoReport(): Promise<string> {
  const db = new HeadLogDb(`report-${Math.random()}`);
  await loadDemo(now, db);
  const { tables } = await createBackup(db);
  const pdf = doctorReport(
    {
      episodes: tables.episodes as Episode[],
      intakes: tables.intakes as Intake[],
      drinks: tables.drinks as Drink[],
      medications: tables.medications as Medication[],
      sleep: new Map((tables.sleep as Night[]).map((n) => [n.day, n])),
      weather: new Map((await db.weather.toArray()).map((w) => [w.day, w])),
      limit: 10,
      waterGoalMl: 2000,
      name: 'Test Person',
      version: '1.0.0'
    },
    now,
    3
  );
  return new TextDecoder('latin1').decode(pdf);
}

afterEach(() => {
  i18n.lang = 'en';
});

describe('doctorReport', () => {
  it('writes the overview, the possible triggers and the table of entries', async () => {
    const text = await demoReport();
    const pages = text.match(/\/Type \/Page\b/g)?.length ?? 0;
    expect([text.startsWith('%PDF'), text.includes('Test Person'), text.includes('Possible triggers'), text.includes('pressure drop'), pages >= 2]).toEqual([
      true,
      true,
      true,
      true,
      true
    ]);
  });

  it('writes German when the app language is German', async () => {
    i18n.lang = 'de';
    const text = await demoReport();
    expect([text.includes('Kopfschmerztagebuch'), text.includes('Druckabfall')]).toEqual([true, true]);
  });
});

describe('reportData', () => {
  const at = (time: string) => new Date(time).getTime();
  const episode = (start: string, end: string, id = 1): Episode => ({ id, start: at(start), end: at(end), intensity: 6, tags: [], note: '' });
  const intake = (time: string, id = 1): Intake => ({ id, time: at(time), medId: 1, name: 'Ibuprofen', dose: '400 mg', category: 'analgesic', relief: null });
  const input = (episodes: Episode[], intakes: Intake[]): ReportInput => ({
    episodes,
    intakes,
    drinks: [],
    medications: [],
    sleep: new Map(),
    weather: new Map(),
    limit: 10,
    waterGoalMl: 2000,
    name: '',
    version: '1'
  });

  it('counts the months like monthlyCounts', () => {
    const data = input([episode('2026-01-31T09:00', '2026-02-01T10:00'), episode('2025-12-31T09:00', '2025-12-31T12:00', 2)], [intake('2026-03-31T08:00')]);
    expect(reportData(data, now, 4).monthly).toEqual(monthlyCounts(data, now, 4));
  });

  it('leaves out intakes outside the period', () => {
    const data = input([], [intake('2025-12-31T23:00', 1), intake('2026-01-01T08:00', 2)]);
    expect(reportData(data, now, 3).medications.map((m) => m.intakes)).toEqual([1]);
  });

  it('puts an intake 2 h before a headache with it, and one 4 h before in its own row', () => {
    const data = input([episode('2026-03-10T12:00', '2026-03-10T15:00')], [intake('2026-03-10T08:00', 1), intake('2026-03-10T10:00', 2)]);
    const rows = reportData(data, now, 1).entries.map((r) => [r.episode ? 'headache' : 'no headache', r.intakes.map((i) => i.id)]);
    expect(rows).toEqual([
      ['no headache', [1]],
      ['headache', [2]]
    ]);
  });
});
