import { afterEach, describe, expect, it } from 'vitest';
import { createBackup } from './backup';
import { HeadLogDb, type Drink, type Episode, type Intake, type Medication, type Night } from './db';
import { loadDemo } from './demo';
import { i18n } from './i18n.svelte';
import { calendarBlocks, doctorReport, reportData, weekdayOnsets, type ReportInput } from './report';

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
  it('writes the summary, the details with the calendar and the possible triggers, and the diary', async () => {
    const text = await demoReport();
    const pages = text.match(/\/Type \/Page\b/g)?.length ?? 0;
    expect([text.startsWith('%PDF'), text.includes('Test Person'), text.includes('Day by day'), text.includes('Possible triggers'), text.includes('pressure drop'), pages >= 3]).toEqual([
      true,
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

  it('gives a headache the traffic light at its onset, without drinks logged after it', () => {
    const drinks: Drink[] = [{ id: 1, time: at('2026-03-10T09:00'), presetId: 1, name: 'Glass', emoji: '🥛', ml: 100 }, { id: 2, time: at('2026-03-10T13:00'), presetId: 1, name: 'Glass', emoji: '🥛', ml: 2000 }];
    const [row] = reportData({ ...input([episode('2026-03-10T12:00', '2026-03-10T15:00')], []), drinks }, now, 1).entries;
    expect(row.episode && [row.onset.light, row.onset.hydration.status]).toEqual(['yellow', 'bad']);
  });

  it('counts the rates and the months only from the first diary entry on', () => {
    const report = reportData(input([episode('2026-03-02T09:00', '2026-03-02T12:00')], []), now, 3);
    expect([report.first, report.covered, report.monthly.map((m) => m.logged)]).toEqual(['2026-03-02', 30, [false, false, true]]);
  });

  it('counts the whole period when the diary starts before it', () => {
    const report = reportData(input([episode('2025-11-02T09:00', '2025-11-02T12:00')], []), now, 3);
    expect(report.covered).toEqual(report.span);
  });

  it('lists the medication days and, with several classes in the last 30 days, each class as limits', () => {
    const data = input([], [intake('2026-03-10T08:00', 1), { ...intake('2026-03-11T08:00', 2), category: 'triptan' }]);
    expect(reportData(data, now, 1).limits.map((l) => [l.kind, l.count, l.limit])).toEqual([
      ['rule', 2, 10],
      ['class', 1, 15],
      ['class', 1, 10]
    ]);
  });

  it('lists only the medication days, at 15, when only pain relievers were taken', () => {
    const data = input([], [intake('2026-03-10T08:00', 1), intake('2026-03-11T08:00', 2)]);
    expect(reportData(data, now, 1).limits.map((l) => [l.kind, l.count, l.limit, l.note])).toEqual([['rule', 2, 15, 'Only pain relievers: fewer than 15 days']]);
  });
});

describe('calendarBlocks', () => {
  const at = (time: string) => new Date(time).getTime();

  it.each([
    ['one month', '2026-03-31T18:00', 1, [6]],
    ['three months', '2026-03-31T18:00', 3, [14]],
    ['six months', '2026-03-31T18:00', 6, [14, 14]],
    ['twelve months', '2026-03-31T18:00', 12, [14, 14, 14, 14]]
  ])('splits %s into quarters with one row per week', (_, time, months, rows) => {
    expect(calendarBlocks(at(time), months).map((weeks) => weeks.length)).toEqual(rows);
  });

  it('starts each row on Monday and leaves out the days before the period', () => {
    const [weeks] = calendarBlocks(at('2026-03-31T18:00'), 1);
    expect(weeks[0].days).toEqual([null, null, null, null, null, null, '2026-03-01']);
  });

  it('leaves out the days after now', () => {
    const [weeks] = calendarBlocks(at('2026-03-11T08:00'), 1);
    expect(weeks.at(-1)!.days).toEqual(['2026-03-09', '2026-03-10', '2026-03-11', null, null, null, null]);
  });

  it('marks the week in which each month starts', () => {
    const [weeks] = calendarBlocks(at('2026-03-31T18:00'), 3);
    expect(weeks.flatMap((w, i) => (w.month ? [[i, w.month.getMonth()]] : []))).toEqual([
      [0, 0],
      [4, 1],
      [8, 2]
    ]);
  });

  it('shows a week that two blocks share in both, each with the days of its own months', () => {
    const [first, second] = calendarBlocks(at('2026-03-31T18:00'), 6);
    expect([first.at(-1)!.days, second[0].days]).toEqual([
      ['2025-12-29', '2025-12-30', '2025-12-31', null, null, null, null],
      [null, null, null, '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']
    ]);
  });

  it('counts the headaches started in a block by weekday and leaves out those of other blocks', () => {
    const [first] = calendarBlocks(at('2026-03-31T18:00'), 6);
    expect(weekdayOnsets(first, ['2025-12-29', '2025-12-31', '2025-12-31', '2026-01-01', '2025-10-06'])).toEqual([2, 0, 2, 0, 0, 0, 0]);
  });
});
