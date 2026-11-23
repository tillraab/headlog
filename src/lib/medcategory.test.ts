import { describe, expect, it } from 'vitest';
import { medColor } from './colors';
import type { Intake, Medication } from './db';
import { fromMedication, guessCategory, personalLimit, reliefQuestion } from './medication';

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

describe('reliefQuestion', () => {
  const at = (s: string) => new Date(s).getTime();
  const intake = (time: string, relief: Intake['relief'] = null, id = 1): Intake => ({ id, time: at(time), medId: 1, name: 'Ibuprofen', dose: '400 mg', category: 'analgesic', relief });
  const now = at('2026-03-10T15:00');

  it.each([
    ['asks once the delay has passed', '2026-03-10T13:30', 60, true],
    ['waits while the delay runs', '2026-03-10T14:30', 60, false],
    ['uses an hour when the notification is off', '2026-03-10T14:30', 0, false],
    ['stops asking after 12 hours', '2026-03-10T02:00', 60, false]
  ])('%s', (_, time, delay, asks) => {
    expect(reliefQuestion([intake(time)], now, delay) !== undefined).toBe(asks);
  });

  it('skips rated intakes', () => {
    expect(reliefQuestion([intake('2026-03-10T13:00', 2)], now, 60)).toBeUndefined();
  });

  it('asks about the latest unrated intake', () => {
    expect(reliefQuestion([intake('2026-03-10T10:00', null, 1), intake('2026-03-10T12:00', null, 2)], now, 60)?.id).toBe(2);
  });
});

describe('personalLimit', () => {
  it.each([
    ['4', '30', { limitDays: 4, limitWindow: 30 }],
    ['', '30', { limitDays: undefined, limitWindow: undefined }],
    ['0', '30', { limitDays: undefined, limitWindow: undefined }],
    ['4', '', { limitDays: 4, limitWindow: 30 }],
    ['40', '30', { limitDays: 30, limitWindow: 30 }],
    ['4', '900', { limitDays: 4, limitWindow: 365 }],
    ['2.6', '7', { limitDays: 3, limitWindow: 7 }]
  ])('reads %j days in %j as %j', (days, window, limit) => {
    expect(personalLimit(days, window)).toEqual(limit);
  });
});
