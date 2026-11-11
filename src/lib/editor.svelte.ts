import type { Draft, Drink, Episode, Intake, Night } from './db';
import { defaultNight } from './sleep';
import { data, updateSleep } from './store.svelte';
import { openSheet } from './ui.svelte';

export type Editing =
  | { kind: 'episode'; item: Draft<Episode> }
  | { kind: 'intake'; item: Draft<Intake> }
  | { kind: 'drink'; item: Draft<Drink> }
  | { kind: 'sleep'; item: Night };

/**
 * The entry open in the editor sheet. Items without an id are new. A night opens as an overview unless
 * `sleepEditing` is set; `opened` is the entry as it opened, to tell whether it was changed.
 */
export const editor = $state<{ current: Editing | null; sleepEditing: boolean; opened: string }>({ current: null, sleepEditing: false, opened: '' });

export function edit(value: Editing, sleepEditing = false) {
  editor.current = structuredClone($state.snapshot(value)) as Editing;
  editor.opened = JSON.stringify(editor.current.item);
  editor.sleepEditing = sleepEditing;
  openSheet('editor');
}

/**
 * Opens the sleep sheet for the night ending on `day`, starting from 23:00–7:00 when nothing is known;
 * with `editing`, its edit controls are shown from the start.
 */
export async function openNight(day: string, editing = false) {
  await updateSleep();
  edit({ kind: 'sleep', item: data.sleep.get(day) ?? defaultNight(day) }, editing);
}
