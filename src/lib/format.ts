import type { ComparisonKey } from './analysis';
import type { Drink, Episode, Intake } from './db';
import { formatDuration, formatLiters, hm, HOUR } from './days';
import { t } from './i18n.svelte';

/** A compared value as Insights and the report write it: litres, hours, mg, or a share in %. */
export function formatComparison(key: ComparisonKey, value: number): string {
  switch (key) {
    case 'hydration':
      return formatLiters(value);
    case 'sleep':
      return formatDuration(value * HOUR);
    case 'caffeine':
      return `${Math.round(value)} mg`;
    case 'pressure':
    case 'alcohol':
      return `${Math.round(value * 100)} %`;
  }
}

/**
 * Short lines about entries for the chart details: each headache with its times, the medication, the drinks.
 * Entries at the same minute share one time, e.g. "💊 14:00 Ibuprofen, Sumatriptan" and "🥛 13:35 · 💧🍵 14:00".
 */
export function entryDetailLines(entries: { episodes: Episode[]; intakes: Intake[]; drinks?: Drink[] }): string[] {
  const lines = entries.episodes.map((e) => t('tl.detailHeadache', { from: hm(e.start), to: e.end ? hm(e.end) : '…', n: e.intensity }));
  if (entries.intakes.length) lines.push(`💊 ${byTime(entries.intakes, (i) => i.name, (time, names) => `${time} ${names.join(', ')}`)}`);
  if (entries.drinks?.length) lines.push(byTime(entries.drinks, (d) => d.emoji, (time, emojis) => `${emojis.join('')} ${time}`));
  return lines;
}

/** Entries grouped by the minute they were logged, in time order, each group written by `write`, joined by " · ". */
function byTime<T extends { time: number }>(items: T[], label: (item: T) => string, write: (time: string, labels: string[]) => string): string {
  const groups = new Map<string, string[]>();
  for (const item of [...items].sort((a, b) => a.time - b.time)) {
    const time = hm(item.time);
    groups.set(time, [...(groups.get(time) ?? []), label(item)]);
  }
  return [...groups].map(([time, labels]) => write(time, labels)).join(' · ');
}
