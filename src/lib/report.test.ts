import { afterEach, describe, expect, it } from 'vitest';
import { createBackup } from './backup';
import { HeadLogDb, type Drink, type Episode, type Intake, type Medication, type Night } from './db';
import { loadDemo } from './demo';
import { i18n } from './i18n.svelte';
import { doctorReport } from './report';

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
