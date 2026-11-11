import { describe, expect, it } from 'vitest';
import { medColor } from './colors';
import type { Medication } from './db';
import { fromMedication, guessCategory } from './medication';

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
