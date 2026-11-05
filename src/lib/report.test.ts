import { describe, expect, it } from 'vitest';
import { createBackup } from './backup';
import { HeadLogDb, type Drink, type Episode, type Intake, type Medication, type Night } from './db';
import { loadDemo } from './demo';
import { doctorReport } from './report';

describe('doctorReport', () => {
  it('writes the overview, the possible triggers and the table of entries', async () => {
    const db = new HeadLogDb(`report-${Math.random()}`);
    const now = new Date('2026-03-31T18:00').getTime();
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
    const text = new TextDecoder('latin1').decode(pdf);
    const pages = text.match(/\/Type \/Page\b/g)?.length ?? 0;
    expect([text.startsWith('%PDF'), text.includes('Test Person'), text.includes('Possible triggers'), text.includes('pressure drop'), pages >= 2]).toEqual([
      true,
      true,
      true,
      true,
      true
    ]);
  });
});
