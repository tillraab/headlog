import type { DrinkPreset } from './db';

/** Typical caffeine per default serving: 200 ml filter coffee, 300 ml black tea. */
export const CAFFEINE = { coffee: 80, tea: 40 };

/** Fluid that counts toward the hydration goal. */
export function hydrationMl(drink: { ml: number; alcohol?: boolean }): number {
  return drink.alcohol ? 0 : drink.ml;
}

/** The parts of a preset copied onto a logged drink. */
export function fromPreset(preset: DrinkPreset) {
  return { presetId: preset.id, name: preset.name, emoji: preset.emoji, ml: preset.ml, caffeineMg: preset.caffeineMg, alcohol: preset.alcohol };
}
