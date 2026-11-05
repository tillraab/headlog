import { describe, expect, it } from 'vitest';
import { createBackup } from './backup';
import { HeadLogDb, type Drink, type Episode, type Intake, type Medication } from './db';
import { loadDemo } from './demo';
import { doctorReport } from './report';

describe('doctorReport', () => {
  it('writes a single-page PDF with name and medication', async () => {
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
        limit: 10,
        waterGoalMl: 2000,
        name: 'Test Person',
        version: '1.0.0'
      },
      now,
      3
    );
    const text = new TextDecoder('latin1').decode(pdf);
    const pages = text.match(/\/Type \/Page\b/g)?.length;
    expect([text.startsWith('%PDF'), text.includes('Test Person'), text.includes('Sumatriptan'), pages]).toEqual([true, true, true, 1]);
  });
});
