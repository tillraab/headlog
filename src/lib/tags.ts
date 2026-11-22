import type { Episode } from './db';

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

/** The list with `text` added, unless it is empty or already on it, ignoring case. */
export function withTag(list: string[], text: string): { list: string[]; tag: string } {
  const typed = text.trim();
  const existing = list.find((tag) => tag.toLowerCase() === typed.toLowerCase());
  return existing || !typed ? { list, tag: existing ?? '' } : { list: [...list, typed], tag: typed };
}
