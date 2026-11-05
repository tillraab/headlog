import type { Draft, Drink, Episode, Intake, Night } from './db';
import { openSheet } from './ui.svelte';

export type Editing =
  | { kind: 'episode'; item: Draft<Episode> }
  | { kind: 'intake'; item: Draft<Intake> }
  | { kind: 'drink'; item: Draft<Drink> }
  | { kind: 'sleep'; item: Night };

/** The entry open in the editor sheet. Items without an id are new. */
export const editor = $state<{ current: Editing | null }>({ current: null });

export function edit(value: Editing) {
  editor.current = structuredClone($state.snapshot(value)) as Editing;
  openSheet('editor');
}
