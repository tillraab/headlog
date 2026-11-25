import type { Intake, Medication } from './db';
import { HOUR, MINUTE } from './days';

/** Medication classes, in the order the medication list offers them. */
export const CATEGORIES = ['analgesic', 'triptan', 'ergotamine', 'combination', 'opioid', 'antiemetic', 'preventive', 'other'] as const;

export type MedCategory = (typeof CATEGORIES)[number];

/**
 * Acute headache medication: counts toward the medication days. Preventive medication and medicine
 * against nausea do not; "other" counts, to stay on the safe side.
 */
export const ACUTE_CATEGORIES = ['analgesic', 'triptan', 'ergotamine', 'combination', 'opioid', 'other'] as const satisfies readonly MedCategory[];

export type AcuteCategory = (typeof ACUTE_CATEGORIES)[number];

export function isAcute(category: MedCategory): category is AcuteCategory {
  return (ACUTE_CATEGORIES as readonly MedCategory[]).includes(category);
}

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

/** Days per month from which ICHD-3 8.2.6 speaks of overuse for several classes together, even when none is over its own limit. */
export const MULTIPLE_CLASSES_LIMIT = 10;

/** Common active ingredients and brands per category, lower case, for recognising a medication by its name. */
const KNOWN: Partial<Record<MedCategory, string[]>> = {
  triptan: ['triptan', 'imigran', 'maxalt', 'ascotop', 'relpax', 'naramig', 'allegro', 'formigran', 'dolortriptan'],
  ergotamine: ['ergotamin', 'ergotamine', 'dihydroergotamin', 'migrexa'],
  combination: ['thomapyrin', 'neuralgin', 'dolomo', 'titralgan', 'excedrin', 'spalt plus', 'ratiopyrin', 'migräne-kranit'],
  opioid: ['tramadol', 'tilidin', 'codein', 'tapentadol', 'oxycodon', 'morphin', 'hydromorphon', 'tramal', 'valoron'],
  antiemetic: ['metoclopramid', 'mcp', 'domperidon', 'motilium', 'vomex', 'dimenhydrinat', 'ondansetron'],
  preventive: ['topiramat', 'propranolol', 'metoprolol', 'amitriptylin', 'flunarizin', 'valproat', 'candesartan', 'botox', 'erenumab', 'aimovig', 'fremanezumab', 'ajovy', 'galcanezumab', 'emgality', 'eptinezumab', 'vyepti', 'magnesium'],
  analgesic: ['ibuprofen', 'paracetamol', 'acetaminophen', 'aspirin', 'acetylsalicyl', 'ass ', 'naproxen', 'diclofenac', 'metamizol', 'novalgin', 'dexketoprofen', 'ketoprofen', 'celecoxib', 'etoricoxib', 'nurofen', 'dolormin', 'voltaren', 'aleve', 'ben-u-ron', 'phenazon']
};

/** The category a medication name points to, or null when it is not known. */
export function guessCategory(name: string): MedCategory | null {
  const n = ` ${name.toLowerCase()} `;
  // Two or more pain relievers in one name, e.g. "ASS + Paracetamol + Coffein", make a combination.
  if ((KNOWN.analgesic ?? []).filter((w) => n.includes(w)).length >= 2) return 'combination';
  for (const [category, words] of Object.entries(KNOWN) as [MedCategory, string[]][]) {
    if (words.some((w) => n.includes(w))) return category;
  }
  return null;
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
