import type { Episode } from './db';
import { TAGS, tagLabel } from './i18n.svelte';

/**
 * The symptoms and triggers offered in the headache editor: the user's own list, or, before they changed it, the
 * tags their headaches already carry, most used first.
 */
export function myTags(saved: string[] | null, episodes: Pick<Episode, 'tags'>[]): string[] {
  if (saved) return saved;
  const counts = new Map<string, number>();
  for (const e of episodes) for (const tag of e.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}

/** A typed tag: one of `TAGS` when the text is its label, so it is translated with the app; otherwise the text. */
export function tagFromText(text: string): string {
  const typed = text.trim();
  return TAGS.find((tag) => tagLabel(tag).toLowerCase() === typed.toLowerCase()) ?? typed;
}

/** Ideas for new tags: the built-in ones not on the list yet. */
export function tagIdeas(list: string[]): string[] {
  return TAGS.filter((tag) => !list.includes(tag));
}
