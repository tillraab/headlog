import type { Intake, Medication } from './db';
import { ACUTE_CATEGORIES } from './medication';

/** Colours a medication can get in the list, in the order new entries get them. */
export const MED_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#3b82f6', '#ec4899', '#14b8a6', '#64748b'];

/**
 * Colour of the medication an intake belongs to: looked up by `medId`, by name for intakes whose list
 * entry was deleted and added again, and the general medication colour when neither is found.
 */
export function medColor(intake: Pick<Intake, 'medId' | 'name'>, medications: Medication[]): string {
  const med = medications.find((m) => m.id === intake.medId) ?? medications.find((m) => m.name === intake.name);
  return med?.color ?? 'var(--color-med)';
}

/** Colour of an intake's medication; grey when it does not count for the 10/20 rule. */
export function intakeColor(intake: Pick<Intake, 'medId' | 'name' | 'category'>, medications: Medication[]): string {
  if (!ACUTE_CATEGORIES.includes(intake.category)) return 'var(--color-muted)';
  return medColor(intake, medications);
}
