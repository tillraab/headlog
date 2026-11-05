import { describe, expect, it } from 'vitest';
import { monthlyLimitedDays } from './analysis';
import { guessCategory, type Intake, type MedCategory } from './db';

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

describe('monthlyLimitedDays', () => {
  const intake = (time: string, category: MedCategory): Intake => ({ id: 1, time: new Date(time).getTime(), medId: 1, name: '', dose: '', category, relief: null });

  it('counts days with any class that has an overuse limit, but not preventives or antiemetics', () => {
    const intakes = [
      intake('2026-03-02T08:00', 'analgesic'),
      intake('2026-03-02T18:00', 'triptan'),
      intake('2026-03-05T08:00', 'triptan'),
      intake('2026-03-06T08:00', 'preventive'),
      intake('2026-03-07T08:00', 'antiemetic')
    ];
    expect(monthlyLimitedDays(intakes, new Date('2026-03-15'))).toBe(2);
  });
});
