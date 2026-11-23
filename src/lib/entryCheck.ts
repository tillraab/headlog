import { conflictingOngoing } from './analysis';
import type { Draft, Episode } from './db';
import type { Editing } from './editor.svelte';

/** Why an edited entry cannot be saved, as a text key, or null when it can. */
export function entryProblem(entry: Editing, episodes: Episode[]): 'edit.invalidTime' | 'edit.endBeforeStart' | 'edit.otherOngoing' | null {
  const times = entry.kind === 'episode' ? [entry.item.start, entry.item.end ?? 0] : entry.kind === 'sleep' ? [entry.item.start, entry.item.end] : [entry.item.time];
  if (!times.every(Number.isFinite)) return 'edit.invalidTime';
  if (entry.kind === 'episode') {
    if (entry.item.end !== null && entry.item.end <= entry.item.start) return 'edit.endBeforeStart';
    if (conflictingOngoing(episodes, entry.item as Draft<Episode>)) return 'edit.otherOngoing';
  }
  if (entry.kind === 'sleep' && entry.item.end <= entry.item.start) return 'edit.endBeforeStart';
  return null;
}
