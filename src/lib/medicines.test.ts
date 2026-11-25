import { describe, expect, it } from 'vitest';
import type { MedCategory } from './medication';
import { MEDICINES, type Medicine } from './medicines';

/** Non-opioid analgesics as ICHD-3 8.2 groups them: NSAIDs, salicylates, pyrazolones, anilides, other analgesics. */
const ANALGESIC_ATC = /^(M01A|N02BA|N02BB|N02BE|N02BG)/;
const OPIOIDS = new Set(['tramadol', 'tilidine', 'tapentadol', 'oxycodone', 'morphine', 'hydromorphone', 'buprenorphine', 'codeine']);
const ANTIEMETIC_ATC = /^(A03FA|A04AA|R06AA11|N05AB04)/;
/** CGRP antibodies and atogepant, beta blockers, antiepileptics, antidepressants, flunarizine, sartans and ACE inhibitors, botulinum toxin, verapamil, lithium, pizotifen, supplements. */
const PREVENTIVE_ATC = /^(N02CD0[12357]|N02CX01|C07A|N03A|N06A|N07CA03|C09|M03AX01|C08DA01|N05AN01|A12CC|A11HA04|C01EB09|N05CH01)/;
const SIMPLE_ANALGESICS = new Set(MEDICINES.filter((m) => m.ingredients.length === 1 && ANALGESIC_ATC.test(m.atc)).flatMap((m) => m.ingredients));

/** The category the rules give an entry from its ATC code and ingredients alone. */
function expectedCategory({ atc, ingredients }: Medicine): MedCategory {
  if (atc.startsWith('N02A') || ingredients.some((i) => OPIOIDS.has(i))) return 'opioid';
  if (atc.startsWith('N02CA')) return 'ergotamine';
  if (atc === 'N02CC08') return 'other';
  if (atc.startsWith('N02CC')) return 'triptan';
  const analgesics = ingredients.filter((i) => SIMPLE_ANALGESICS.has(i)).length;
  if (analgesics >= 2 || (analgesics === 1 && ingredients.includes('caffeine'))) return 'combination';
  if (ANALGESIC_ATC.test(atc)) return 'analgesic';
  if (ANTIEMETIC_ATC.test(atc)) return 'antiemetic';
  if (PREVENTIVE_ATC.test(atc)) return 'preventive';
  return 'other';
}

describe('MEDICINES', () => {
  it.each(MEDICINES.map((m) => [m.names[0], m] as const))('%s has the category its ATC code and ingredients give', (_, medicine) => {
    expect(medicine.category).toBe(expectedCategory(medicine));
  });

  it('has well-formed ATC codes', () => {
    expect(MEDICINES.filter((m) => !/^[A-Z]\d\d[A-Z][A-Z]\d\d$/.test(m.atc))).toEqual([]);
  });

  it('has lower-case names', () => {
    expect(MEDICINES.flatMap((m) => m.names).filter((n) => n !== n.toLowerCase())).toEqual([]);
  });

  it('gives every name to one entry only', () => {
    const names = MEDICINES.flatMap((m) => m.names);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });
});
