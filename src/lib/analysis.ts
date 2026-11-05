import { addDays, endOfMonth, getDay, getHours, startOfMonth } from 'date-fns';
import { ACUTE_CATEGORIES, hydrationMl, type Drink, type Episode, type Intake, type MedCategory, type Medication } from './db';
import { dayKey, dayRange, keyToDate, lastDays } from './days';

/** Peak intensity per day touched by a headache. Ongoing episodes run until `now`. */
export function headacheDays(episodes: Episode[], now: number): Map<string, number> {
  const days = new Map<string, number>();
  for (const ep of episodes) {
    for (const key of dayRange(ep.start, ep.end ?? now)) {
      days.set(key, Math.max(days.get(key) ?? 0, ep.intensity));
    }
  }
  return days;
}

/** Intakes grouped by day. With `acuteOnly`, preventive medication is left out. */
export function intakeDays(intakes: Intake[], acuteOnly = true): Map<string, Intake[]> {
  const days = new Map<string, Intake[]>();
  for (const intake of intakes) {
    if (acuteOnly && !ACUTE_CATEGORIES.includes(intake.category)) continue;
    const key = dayKey(intake.time);
    const list = days.get(key);
    if (list) list.push(intake);
    else days.set(key, [intake]);
  }
  return days;
}

export function waterByDay(drinks: Drink[]): Map<string, number> {
  const days = new Map<string, number>();
  for (const d of drinks) {
    const key = dayKey(d.time);
    days.set(key, (days.get(key) ?? 0) + hydrationMl(d));
  }
  return days;
}

/** Caffeine in mg per day, for days with any caffeinated drink. */
export function caffeineByDay(drinks: Drink[]): Map<string, number> {
  const days = new Map<string, number>();
  for (const d of drinks) {
    if (!d.caffeineMg) continue;
    const key = dayKey(d.time);
    days.set(key, (days.get(key) ?? 0) + d.caffeineMg);
  }
  return days;
}

/** Days with at least one alcoholic drink. */
export function alcoholDays(drinks: Drink[]): Set<string> {
  return new Set(drinks.filter((d) => d.alcohol).map((d) => dayKey(d.time)));
}

export interface Streak {
  /** Days in a row with the goal reached, up to yesterday, plus today once reached. */
  current: number;
  best: number;
  todayReached: boolean;
}

/** Hydration goal streak. Today does not break the streak before it is over. */
export function hydrationStreak(drinks: Drink[], goalMl: number, today: number | Date): Streak {
  const water = waterByDay(drinks);
  const reached = (key: string) => (water.get(key) ?? 0) >= goalMl;
  const todayKey = dayKey(today);
  const todayReached = reached(todayKey);
  let current = todayReached ? 1 : 0;
  for (let d = addDays(today, -1); reached(dayKey(d)); d = addDays(d, -1)) current++;

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const key of [...water.keys()].filter(reached).sort()) {
    run = previous && dayKey(addDays(keyToDate(previous), 1)) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  }
  return { current, best: Math.max(best, current), todayReached };
}

export type RuleStatus = 'ok' | 'caution' | 'over';

export interface TenTwenty {
  /** Days with acute medication in the window ending today. */
  count: number;
  limit: number;
  window: number;
  status: RuleStatus;
  /** Window days, oldest first, with whether medication was taken. */
  days: { key: string; med: boolean }[];
  /** Count after taking medication today, if none was taken yet. */
  ifTakenToday: number;
  /** First day on which the count drops, or null without medication days in the window. */
  nextRelief: string | null;
  /** Medication-free days left in the window. */
  freeDays: number;
}

/**
 * The 10/20 rule: within any 30 consecutive days, take acute headache medication on at most
 * 10 days, so that at least 20 days stay free of it.
 */
export function tenTwenty(medDays: Set<string>, today: number | Date, limit = 10, window = 30): TenTwenty {
  const days = lastDays(today, window).map((key) => ({ key, med: medDays.has(key) }));
  const count = days.filter((d) => d.med).length;
  const todayTaken = days[days.length - 1].med;
  const first = days.find((d) => d.med);
  return {
    count,
    limit,
    window,
    status: ruleStatus(count, limit),
    days,
    ifTakenToday: todayTaken ? count : count + 1,
    nextRelief: first ? dayKey(addDays(keyToDate(first.key), window)) : null,
    freeDays: window - count
  };
}

export function ruleStatus(count: number, limit: number): RuleStatus {
  if (count > limit) return 'over';
  if (count >= Math.ceil(limit * 0.8)) return 'caution';
  return 'ok';
}

/** The 30-day count for each medication that has a personal limit. */
export function medicationLimits(intakes: Intake[], medications: Medication[], today: number | Date) {
  return medications
    .filter((m) => m.limitDays)
    .map((med) => {
      const days = new Set(intakes.filter((i) => i.medId === med.id).map((i) => dayKey(i.time)));
      return { med, rule: tenTwenty(days, today, med.limitDays, med.limitWindow ?? 30) };
    });
}

/** Rolling 10/20 counts for the `span` days ending today. */
export function rollingMedDays(medDays: Set<string>, today: number | Date, span: number, window = 30) {
  const keys = lastDays(today, span + window - 1);
  const flags = keys.map((k) => (medDays.has(k) ? 1 : 0));
  const result: { key: string; count: number }[] = [];
  let sum = flags.slice(0, window - 1).reduce<number>((a, b) => a + b, 0);
  for (let i = window - 1; i < keys.length; i++) {
    sum += flags[i];
    result.push({ key: keys[i], count: sum });
    sum -= flags[i - window + 1];
  }
  return result;
}

/** Monthly overuse thresholds from the ICHD-3 criteria for medication-overuse headache. */
export const MONTHLY_LIMITS: Partial<Record<MedCategory, number>> = {
  analgesic: 15,
  triptan: 10,
  combination: 10,
  opioid: 10
};

/** Days per category in the calendar month containing `month`. */
export function monthlyCategoryDays(intakes: Intake[], month: Date): Map<MedCategory, number> {
  const from = startOfMonth(month).getTime();
  const to = endOfMonth(month).getTime();
  const sets = new Map<MedCategory, Set<string>>();
  for (const i of intakes) {
    if (i.time < from || i.time > to) continue;
    const set = sets.get(i.category) ?? new Set<string>();
    set.add(dayKey(i.time));
    sets.set(i.category, set);
  }
  return new Map([...sets].map(([c, s]) => [c, s.size]));
}

export interface PeriodStats {
  days: number;
  headacheDays: number;
  episodes: number;
  avgDurationMs: number | null;
  avgIntensity: number | null;
  medDays: number;
  intakes: number;
  /** Episodes started per weekday, Monday first. */
  weekday: number[];
  /** Episodes started per 3-hour block of the day. */
  timeOfDay: number[];
  avgWaterMl: number | null;
  /** Average water on the day before a headache started, and on days with no headache the next day. */
  waterBeforeHeadache: number | null;
  waterBeforeClear: number | null;
  meds: { name: string; intakes: number; days: number; avgRelief: number | null }[];
  tags: { tag: string; count: number }[];
  /** Days since the last headache day, or null without any. */
  clearStreak: number | null;
}

export function periodStats(
  data: { episodes: Episode[]; intakes: Intake[]; drinks: Drink[] },
  today: number,
  span: number
): PeriodStats {
  const keys = lastDays(today, span);
  const from = keyToDate(keys[0]).getTime();
  const inPeriod = (t: number) => t >= from && t <= today;

  const episodes = data.episodes.filter((e) => (e.end ?? today) >= from && e.start <= today);
  const intakes = data.intakes.filter((i) => inPeriod(i.time));
  const hDays = headacheDays(data.episodes, today);
  const mDays = intakeDays(intakes);
  const water = waterByDay(data.drinks);

  const done = episodes.filter((e) => e.end !== null);
  const weekday = new Array(7).fill(0);
  const timeOfDay = new Array(8).fill(0);
  for (const e of episodes) {
    if (!inPeriod(e.start)) continue;
    weekday[(getDay(e.start) + 6) % 7]++;
    timeOfDay[Math.floor(getHours(e.start) / 3)]++;
  }

  const waterDays = keys.filter((k) => water.has(k));
  const startDays = new Set(episodes.map((e) => dayKey(e.start)));
  const before: number[] = [];
  const clear: number[] = [];
  for (const k of waterDays) {
    const next = dayKey(addDays(keyToDate(k), 1));
    if (startDays.has(next)) before.push(water.get(k)!);
    else if (!hDays.has(next) && !hDays.has(k)) clear.push(water.get(k)!);
  }

  const medMap = new Map<string, { intakes: number; days: Set<string>; relief: number[] }>();
  for (const i of intakes) {
    const m = medMap.get(i.name) ?? { intakes: 0, days: new Set<string>(), relief: [] };
    m.intakes++;
    m.days.add(dayKey(i.time));
    if (i.relief !== null) m.relief.push(i.relief);
    medMap.set(i.name, m);
  }

  const tagMap = new Map<string, number>();
  for (const e of episodes) for (const t of e.tags) tagMap.set(t, (tagMap.get(t) ?? 0) + 1);

  const allHeadache = [...hDays.keys()].sort();
  const lastHeadache = allHeadache[allHeadache.length - 1];

  return {
    days: span,
    headacheDays: keys.filter((k) => hDays.has(k)).length,
    episodes: episodes.length,
    avgDurationMs: done.length ? avg(done.map((e) => e.end! - e.start)) : null,
    avgIntensity: episodes.length ? avg(episodes.map((e) => e.intensity)) : null,
    medDays: mDays.size,
    intakes: intakes.length,
    weekday,
    timeOfDay,
    avgWaterMl: waterDays.length ? avg(waterDays.map((k) => water.get(k)!)) : null,
    waterBeforeHeadache: before.length ? avg(before) : null,
    waterBeforeClear: clear.length ? avg(clear) : null,
    meds: [...medMap]
      .map(([name, m]) => ({
        name,
        intakes: m.intakes,
        days: m.days.size,
        avgRelief: m.relief.length ? avg(m.relief) : null
      }))
      .sort((a, b) => b.intakes - a.intakes),
    tags: [...tagMap].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
    clearStreak: lastHeadache
      ? Math.max(0, dayRange(keyToDate(lastHeadache), today).length - 1)
      : null
  };
}

/** Headache and medication days per calendar month, for the `count` months ending with `today`. */
export function monthlyCounts(
  data: { episodes: Episode[]; intakes: Intake[] },
  today: number,
  count: number
): { month: Date; headache: number; med: number }[] {
  const hDays = headacheDays(data.episodes, today);
  const mDays = intakeDays(data.intakes);
  const result = [];
  for (let i = count - 1; i >= 0; i--) {
    const month = startOfMonth(addMonthsSafe(today, -i));
    const prefix = dayKey(month).slice(0, 7);
    result.push({
      month,
      headache: [...hDays.keys()].filter((k) => k.startsWith(prefix)).length,
      med: [...mDays.keys()].filter((k) => k.startsWith(prefix)).length
    });
  }
  return result;
}

function addMonthsSafe(time: number, months: number): Date {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
