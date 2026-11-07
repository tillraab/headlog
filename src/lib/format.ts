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

/** Short lines about entries for the chart details: each headache with its times, the medication, the drinks. */
export function entryDetailLines(entries: { episodes: Episode[]; intakes: Intake[]; drinks?: Drink[] }): string[] {
  const lines = entries.episodes.map((e) => t('tl.detailHeadache', { from: hm(e.start), to: e.end ? hm(e.end) : '…', n: e.intensity }));
  if (entries.intakes.length) lines.push(`💊 ${entries.intakes.map((i) => `${i.name} ${hm(i.time)}`).join(', ')}`);
  if (entries.drinks?.length) lines.push(entries.drinks.map((d) => `${d.emoji} ${hm(d.time)}`).join('  '));
  return lines;
}
