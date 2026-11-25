import type { Intake, Medication } from './db';
import { HOUR, MINUTE } from './days';
import { CAFFEINE_NAMES, MEDICINES, type Medicine } from './medicines';

/** Medication classes, in the order the medication list offers them. */
export const CATEGORIES = ['analgesic', 'triptan', 'ergotamine', 'combination', 'opioid', 'antiemetic', 'preventive', 'other'] as const;

export type MedCategory = (typeof CATEGORIES)[number];

/**
 * Acute headache medication: counts toward the 10/20 rule. Preventive medication and medicine
 * against nausea do not; "other" counts, to stay on the safe side.
 */
export const ACUTE_CATEGORIES: readonly MedCategory[] = ['analgesic', 'triptan', 'ergotamine', 'combination', 'opioid', 'other'];

/**
 * Days per month from which ICHD-3 (8.2, medication-overuse headache) speaks of overuse, when it
 * goes on for more than 3 months: 15 for simple pain relievers, 10 for the others.
 */
export const MONTHLY_LIMITS: Partial<Record<MedCategory, number>> = {
  analgesic: 15,
  triptan: 10,
  ergotamine: 10,
  combination: 10,
  opioid: 10
};

/** Lower case, dose numbers and units dropped, everything but letters a space, padded with spaces for whole-word matching. */
function normalise(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/(?<![\p{L}\d])\d+([.,]\d+)?\s*(mg|µg|mcg|g|ml|%)?(?![\p{L}\d])/gu, ' ')
    .replace(/[^\p{L}\d]+/gu, ' ')
    .trim();
  return ` ${words} `;
}

/** Every name of the table with its entry, longest first, so "thomapyrin tension duo" wins over "thomapyrin". */
const NAMES = MEDICINES.flatMap((medicine) => medicine.names.map((name) => ({ name: normalise(name), medicine }))).sort(
  (a, b) => b.name.length - a.name.length
);

/** Ingredients that are pain relievers on their own. */
const SIMPLE_ANALGESICS = new Set(MEDICINES.filter((m) => m.category === 'analgesic' && m.ingredients.length === 1).flatMap((m) => m.ingredients));

/** The order in which a name with several medicines picks its class: the one with the stricter overuse limit first. */
const PRECEDENCE: readonly MedCategory[] = ['opioid', 'ergotamine', 'triptan', 'combination', 'analgesic', 'other', 'antiemetic', 'preventive'];

/** The category a medication name points to, or null when it is not known. */
export function guessCategory(name: string): MedCategory | null {
  let text = normalise(name);
  const found: Medicine[] = [];
  for (const { name: n, medicine } of NAMES) {
    if (!text.includes(n)) continue;
    found.push(medicine);
    text = text.replaceAll(n, ' | ');
  }
  if (found.length === 0) return null;
  const categories = new Set(found.map((m) => m.category));
  // Two pain relievers, or one with caffeine, typed in one name ("ASS + Paracetamol + Coffein") make a combination.
  const analgesics = new Set(found.flatMap((m) => m.ingredients).filter((i) => SIMPLE_ANALGESICS.has(i)));
  const caffeine = CAFFEINE_NAMES.some((c) => text.includes(` ${c} `));
  if (!categories.has('opioid') && (analgesics.size >= 2 || (analgesics.size === 1 && caffeine))) return 'combination';
  return PRECEDENCE.find((c) => categories.has(c)) ?? null;
}

/** The parts of a medication copied onto an intake, so history survives edits and deletes of the list. */
export function fromMedication(med: Medication): Pick<Intake, 'medId' | 'name' | 'dose' | 'category'> {
  return { medId: med.id, name: med.name, dose: med.dose, category: med.category };
}

/** A personal limit from the two typed fields: no limit without days; the window 1 to 365 days, 30 when empty. */
export function personalLimit(days: string, window: string): Pick<Medication, 'limitDays' | 'limitWindow'> {
  const n = Math.round(Number(days));
  const m = Math.min(365, Math.max(1, Math.round(Number(window)) || 30));
  return n > 0 ? { limitDays: Math.min(n, m), limitWindow: m } : { limitDays: undefined, limitWindow: undefined };
}

/** How long after an intake Today still asks whether it helped. */
export const RELIEF_ASK_WINDOW = 12 * HOUR;

/**
 * The intake Today asks about: the latest unrated one whose relief question is due (the delay set, or an hour when
 * the notification is off) and less than 12 hours old.
 */
export function reliefQuestion(intakes: Intake[], now: number, delayMinutes: number): Intake | undefined {
  const due = (delayMinutes || 60) * MINUTE;
  return intakes.findLast((i) => i.relief === null && now - i.time > due && now - i.time < RELIEF_ASK_WINDOW);
}
