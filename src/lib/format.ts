import type { ComparisonKey, MedicationRule } from './analysis';
import type { Drink, Episode, Intake } from './db';
import { formatDuration, formatLiters, hm, HOUR } from './days';
import { t } from './i18n.svelte';
import { MULTIPLE_CLASSES_LIMIT, type AcuteCategory } from './medication';

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

/**
 * Why the medication days have the limit they have, in one short line: "Only pain relievers: fewer
 * than 15 days", "Triptan: fewer than 10 days", "Pain reliever and triptan: fewer than 10 days together".
 */
export function limitReason(rule: Pick<MedicationRule, 'classes' | 'limit'>): string {
  const { classes, limit } = rule;
  const name = (c: AcuteCategory) => t(`limitCls.${c}`);
  const line =
    classes.length === 0
      ? t('limit.none', { limit })
      : classes.length === 1 && classes[0] === 'analgesic'
        ? t('limit.analgesic', { limit })
        : classes.length === 1
          ? t('limit.one', { cls: name(classes[0]), limit })
          : classes.length === 2
            ? t('limit.two', { a: name(classes[0]), b: name(classes[1]), limit })
            : t('limit.many', { n: classes.length, limit });
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * What taking medication today does to the medication days. While only pain relievers were taken,
 * another class would lower the limit to 10, so the line names both.
 */
export function ifTakenTodayLine(rule: Pick<MedicationRule, 'ifTakenToday' | 'limit'>): string {
  return rule.limit > MULTIPLE_CLASSES_LIMIT
    ? t('tenTwenty.ifTodayAnalgesic', { n: rule.ifTakenToday, limit: rule.limit, strict: MULTIPLE_CLASSES_LIMIT })
    : t('tenTwenty.ifToday', { n: rule.ifTakenToday, limit: rule.limit });
}
