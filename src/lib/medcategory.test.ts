import { describe, expect, it } from 'vitest';
import { limitedDays } from './analysis';
import { medColor } from './colors';
import type { Intake, Medication } from './db';
import { fromMedication, guessCategory, type MedCategory } from './medication';

describe('guessCategory', () => {
  it.each([
    ['Ibuprofen', 'analgesic'],
    ['ASS 500', 'analgesic'],
    ['Sumatriptan', 'triptan'],
    ['Maxalt lingua', 'triptan'],
    ['Thomapyrin', 'combination'],
    ['ASS + Paracetamol + Coffein', 'combination'],
    ['Tramadol', 'opioid'],
    ['MCP Tropfen', 'antiemetic'],
    ['Topiramat', 'preventive'],
    ['Ergotamin', 'ergotamine'],
    ['Pfefferminzöl', null]
  ])('%s is %s', (name, category) => {
    expect(guessCategory(name)).toBe(category);
  });
});

describe('limitedDays', () => {
  const intake = (time: string, category: MedCategory): Intake => ({ id: 1, time: new Date(time).getTime(), medId: 1, name: '', dose: '', category, relief: null });

  it('counts days with any class that has an overuse limit, but not preventives or antiemetics', () => {
    const intakes = [
      intake('2026-03-02T08:00', 'analgesic'),
      intake('2026-03-02T18:00', 'triptan'),
      intake('2026-03-05T08:00', 'triptan'),
      intake('2026-03-06T08:00', 'preventive'),
      intake('2026-03-07T08:00', 'antiemetic')
    ];
    expect(limitedDays(intakes, new Date('2026-03-15T12:00'))).toBe(2);
  });
});

describe('medColor', () => {
  const med = (id: number, name: string, color: string): Medication => ({ id, name, dose: '', category: 'analgesic', color, order: id });

  it('looks the medication up by its id before its name', () => {
    expect(medColor({ medId: 2, name: 'Ibuprofen' }, [med(1, 'Ibuprofen', 'red'), med(2, 'Ibuprofen 600', 'blue')])).toBe('blue');
  });

  it('falls back to the name when the id is gone', () => {
    expect(medColor({ medId: 9, name: 'Ibuprofen' }, [med(1, 'Ibuprofen', 'red')])).toBe('red');
  });
});

describe('fromMedication', () => {
  it('copies what an intake keeps of its medication', () => {
    const med: Medication = { id: 3, name: 'Sumatriptan', dose: '50 mg', category: 'triptan', color: '#000', order: 0, limitDays: 4 };
    expect(fromMedication(med)).toEqual({ medId: 3, name: 'Sumatriptan', dose: '50 mg', category: 'triptan' });
  });
});
