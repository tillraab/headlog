import { describe, expect, it } from 'vitest';
import { createBackup } from './backup';
import { HeadLogDb, type Drink, type Episode, type Intake, type Medication } from './db';
import { loadDemo } from './demo';
import { doctorReport } from './report';

describe('doctorReport', () => {
  it('writes a PDF with the calendar page and the episode list', async () => {
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
        name: 'Test Person',
        version: '1.0.0'
      },
      now,
      3
    );
    const text = new TextDecoder('latin1').decode(pdf);
    expect([text.startsWith('%PDF'), text.includes('Test Person'), text.includes('Sumatriptan')]).toEqual([true, true, true]);
  });
});
