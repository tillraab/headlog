import { afterEach, describe, expect, it } from 'vitest';
import { createBackup } from './backup';
import { HeadLogDb, type Drink, type Episode, type Intake, type Medication, type Night } from './db';
import { loadDemo } from './demo';
import { i18n } from './i18n.svelte';
import { doctorReport, findings, reportData, type ReportInput } from './report';

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
  it('writes the summary, the details with the possible triggers and the diary', async () => {
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
    waterGoalMl: 2000,
    name: '',
    version: '1'
  });

  it('counts a headache across a month boundary in both months and leaves out months before the period', () => {
    const data = input([episode('2026-01-31T09:00', '2026-02-01T10:00'), episode('2025-12-31T09:00', '2025-12-31T12:00', 2)], [intake('2026-03-31T08:00')]);
    const counts = reportData(data, now, 3).monthly.map((m) => [m.headache, m.med]);
    expect(counts).toEqual([
      [1, 0],
      [1, 0],
      [0, 1]
    ]);
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

  it('compares with the period before when the diary reaches back into it', () => {
    const data = input([episode('2026-02-01T09:00', '2026-02-01T12:00'), episode('2026-03-10T09:00', '2026-03-10T12:00', 2)], []);
    expect(reportData(data, now, 1).previous?.headache).toBeCloseTo(30 / 28);
  });

  it('has no previous period when the diary starts in the report period', () => {
    const data = input([episode('2026-03-10T09:00', '2026-03-10T12:00')], []);
    expect(reportData(data, now, 3).previous).toBeNull();
  });

  it('counts the rates and the months only from the first diary entry on', () => {
    const report = reportData(input([episode('2026-03-02T09:00', '2026-03-02T12:00')], []), now, 3);
    expect([report.covered, report.monthly.map((m) => m.logged)]).toEqual([30, [false, false, true]]);
  });

  it('lists the 10/20 rule and each class used in the last 30 days as limits', () => {
    const data = input([], [intake('2026-03-10T08:00', 1), { ...intake('2026-03-11T08:00', 2), category: 'triptan' }]);
    expect(reportData(data, now, 1).limits.map((l) => [l.kind, l.count, l.limit])).toEqual([
      ['rule', 2, 10],
      ['class', 1, 15],
      ['class', 1, 10]
    ]);
  });
});

describe('findings', () => {
  const at = (time: string) => new Date(time).getTime();
  const days = (month: string, n: number, firstId: number): Episode[] =>
    Array.from({ length: n }, (_, i) => {
      const day = `${month}-${String(i + 1).padStart(2, '0')}`;
      return { id: firstId + i, start: at(`${day}T09:00`), end: at(`${day}T12:00`), intensity: 5, tags: [], note: '' };
    });
  const intakes = (n: number, relief: 0 | 1 | 2): Intake[] =>
    Array.from({ length: n }, (_, i) => ({ id: i + 1, time: at(`2026-03-${String(i + 1).padStart(2, '0')}T10:00`), medId: 1, name: 'Ibuprofen', dose: '400 mg', category: 'analgesic', relief }));
  const report = (episodes: Episode[], intakeList: Intake[] = []) =>
    reportData({ episodes, intakes: intakeList, drinks: [], medications: [], sleep: new Map(), weather: new Map(), waterGoalMl: 2000, name: '', version: '1' }, now, 3);
  const statuses = (r: ReturnType<typeof report>) => findings(r).map((f) => f.status);

  it('flags headache days rising over the complete months', () => {
    expect(findings(report([...days('2026-01', 2, 1), ...days('2026-03', 8, 100)]))[0].text).toBe('Headache days rose from 2 in January to 8 in March.');
  });

  it('flags months with 15 or more headache days as the chronic criterion', () => {
    expect(statuses(report([...days('2026-01', 16, 1), ...days('2026-02', 16, 100), ...days('2026-03', 16, 200)]))[0]).toBe('over');
  });

  it('flags a medication that rarely helps', () => {
    expect(findings(report(days('2026-03', 3, 1), intakes(3, 0))).some((f) => f.text === 'Ibuprofen 400 mg helped in 0 of 3 rated intakes.')).toBe(true);
  });

  it('flags the 10/20 rule close to its limit', () => {
    expect(findings(report(days('2026-03', 3, 1), intakes(9, 2))).find((f) => f.status === 'caution')?.text).toBe('10/20 rule is close to its limit: 8 of 10 days in the last 30.');
  });
});
