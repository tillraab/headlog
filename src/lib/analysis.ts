import { addDays, endOfMonth, getDay, getHours, startOfMonth } from 'date-fns';
import { ACUTE_CATEGORIES, hydrationMl, type Drink, type Episode, type Intake, type MedCategory, type Medication, type Night, type WeatherDay } from './db';
import { dayKey, dayRange, keyToDate, lastDays } from './days';
import { CAFFEINE_DROP, LOW_HYDRATION, MIN_USUAL_CAFFEINE, SHORT_SLEEP_HOURS } from './thresholds';
import { isPressureDrop } from './weather';

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

/** The day of the first logged drink. Days before it are unknown, not days without drinking. */
export function firstDrinkDay(drinks: Drink[]): string | null {
  if (!drinks.length) return null;
  return dayKey(Math.min(...drinks.map((d) => d.time)));
}

export function waterByDay(drinks: Drink[]): Map<string, number> {
  const days = new Map<string, number>();
  for (const d of drinks) {
    const key = dayKey(d.time);
    days.set(key, (days.get(key) ?? 0) + hydrationMl(d));
  }
  return days;
}

/**
 * Hydration adding up through each day in `keys`, as steps: a point before and after each drink,
 * starting at 0 at midnight and ending at the next midnight or at `now`. Days after `now` are left out.
 */
export function hydrationCurve(drinks: Drink[], keys: string[], now: number): { key: string; points: { time: number; ml: number }[] }[] {
  const byDay = new Map<string, Drink[]>();
  for (const d of drinks) {
    if (d.time > now) continue;
    const key = dayKey(d.time);
    byDay.set(key, [...(byDay.get(key) ?? []), d]);
  }
  return keys
    .filter((key) => keyToDate(key).getTime() <= now)
    .map((key) => {
      const start = keyToDate(key).getTime();
      let ml = 0;
      const points = [{ time: start, ml }];
      for (const d of (byDay.get(key) ?? []).sort((a, b) => a.time - b.time)) {
        points.push({ time: d.time, ml });
        ml += hydrationMl(d);
        points.push({ time: d.time, ml });
      }
      points.push({ time: Math.min(addDays(start, 1).getTime(), now), ml });
      return { key, points };
    });
}

/**
 * Hydration in the `hours` before `time`, and what is usual for that many hours: the average over the
 * 30 days before, scaled to the same length. Usual is null without at least 7 days with drinks.
 */
export function hydrationBefore(drinks: Drink[], time: number, hours = 72): { ml: number; usual: number | null } {
  const from = time - hours * 3600000;
  const ml = drinks.filter((d) => d.time >= from && d.time < time).reduce((sum, d) => sum + hydrationMl(d), 0);
  const water = waterByDay(drinks.filter((d) => d.time < from && d.time >= from - 30 * 86400000));
  const usual = water.size >= 7 ? ([...water.values()].reduce((a, b) => a + b, 0) / water.size) * (hours / 24) : null;
  return { ml, usual };
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

/** For each of the `span` days ending today, how many of `days` fall in the `window` days up to it. */
export function rollingDays(days: Set<string>, today: number | Date, span: number, window = 30) {
  const keys = lastDays(today, span + window - 1);
  const flags = keys.map((k) => (days.has(k) ? 1 : 0));
  const result: { key: string; count: number }[] = [];
  let sum = flags.slice(0, window - 1).reduce<number>((a, b) => a + b, 0);
  for (let i = window - 1; i < keys.length; i++) {
    sum += flags[i];
    result.push({ key: keys[i], count: sum });
    sum -= flags[i - window + 1];
  }
  return result;
}

/**
 * Days per month from which ICHD-3 (8.2, medication-overuse headache) speaks of overuse, when it
 * goes on for more than 3 months: 15 for simple pain relievers, 10 for the others.
 */
export const MONTHLY_LIMITS: Partial<Record<MedCategory, number>> = {
  analgesic: 15,
  triptan: 10,
  ergotamine: 10,
  combination: 10,
  opioid: 10
};

/** ICHD-3 8.2.6: several of these classes together on 10 or more days a month also count as overuse. */
export const MULTIPLE_CLASSES_LIMIT = 10;

/** Days in the month of `month` with medication from any class that has an overuse limit. */
export function monthlyLimitedDays(intakes: Intake[], month: Date): number {
  const from = startOfMonth(month).getTime();
  const to = endOfMonth(month).getTime();
  return new Set(intakes.filter((i) => i.time >= from && i.time <= to && MONTHLY_LIMITS[i.category] !== undefined).map((i) => dayKey(i.time))).size;
}

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

/** One value per day of `keys` for the timeline charts. Null where nothing is known. */
export function timeline(
  data: { episodes: Episode[]; drinks: Drink[]; sleep: Map<string, Night>; weather: Map<string, WeatherDay> },
  keys: string[],
  now: number
) {
  const pain = headacheDays(data.episodes, now);
  const water = waterByDay(data.drinks);
  const first = firstDrinkDay(data.drinks);
  return {
    headache: keys.map((k) => pain.get(k) ?? 0),
    hydration: keys.map((k) => (water.has(k) ? water.get(k)! : first !== null && k >= first ? 0 : null)),
    sleepHours: keys.map((k) => (data.sleep.has(k) ? data.sleep.get(k)!.asleepMs / 3600000 : null)),
    pressure: keys.map((k) => data.weather.get(k)?.pressure ?? null),
    pressureDrop: keys.map((k) => data.weather.get(k)?.pressureDrop ?? null)
  };
}

export type ComparisonKey = 'hydration' | 'sleep' | 'caffeine' | 'pressure' | 'alcohol';

export interface Comparison {
  key: ComparisonKey;
  /** Average before or on days a headache started. Shares are 0 to 1. */
  headache: number;
  /** Average before or on days without any headache. */
  clear: number;
  nHeadache: number;
  nClear: number;
}

/** Each factor needs at least this many days on both sides to be shown. */
export const MIN_COMPARISON_DAYS = 3;

/**
 * Compares the days a headache started with days without headache: hydration, caffeine and
 * alcohol the day before, sleep the night before, and how often the pressure dropped on the day
 * itself. Today is left out because it is not over.
 */
export function compareDays(
  data: { episodes: Episode[]; drinks: Drink[]; sleep: Map<string, Night>; weather: Map<string, WeatherDay> },
  keys: string[],
  now: number
): Comparison[] {
  const pain = headacheDays(data.episodes, now);
  const starts = new Set(data.episodes.map((e) => dayKey(e.start)));
  const today = dayKey(now);
  const startDays = keys.filter((k) => k !== today && starts.has(k));
  const clearDays = keys.filter((k) => k !== today && !pain.has(k));
  const before = (k: string) => dayKey(addDays(keyToDate(k), -1));

  const water = waterByDay(data.drinks);
  const caffeine = caffeineByDay(data.drinks);
  const alcohol = alcoholDays(data.drinks);
  const tracksCaffeine = caffeine.size > 0;
  const tracksAlcohol = alcohol.size > 0;

  const factors: [ComparisonKey, (k: string) => number | null][] = [
    ['hydration', (k) => water.get(before(k)) ?? null],
    ['sleep', (k) => (data.sleep.has(k) ? data.sleep.get(k)!.asleepMs / 3600000 : null)],
    ['caffeine', (k) => (tracksCaffeine && water.has(before(k)) ? (caffeine.get(before(k)) ?? 0) : null)],
    ['pressure', (k) => (data.weather.has(k) ? (isPressureDrop(data.weather.get(k)!.pressureDrop) ? 1 : 0) : null)],
    ['alcohol', (k) => (tracksAlcohol && water.has(before(k)) ? (alcohol.has(before(k)) ? 1 : 0) : null)]
  ];

  return factors.flatMap(([key, value]) => {
    const h = startDays.map(value).filter((v): v is number => v !== null);
    const c = clearDays.map(value).filter((v): v is number => v !== null);
    if (h.length < MIN_COMPARISON_DAYS || c.length < MIN_COMPARISON_DAYS) return [];
    return [{ key, headache: avg(h), clear: avg(c), nHeadache: h.length, nClear: c.length }];
  });
}

export interface DayFactors {
  /** Fall of the daily mean pressure from the day before, when it counts as a drop. */
  pressure?: number;
  /** Fluid the day before, when below three quarters of the goal. */
  hydration?: number;
  /** Hours asleep the night before, when the night was short. */
  sleep?: number;
  /** Alcohol the day before. */
  alcohol?: true;
  /** Caffeine on the day, when below half of the usual amount. */
  caffeine?: number;
}

/**
 * The factors present for a headache that started on `key`, by the same rules as the forecast:
 * pressure drop on the day, little to drink and alcohol the day before, a short night, a caffeine
 * drop. Factors without data are left out.
 */
export function dayFactors(
  data: { drinks: Drink[]; sleep: Map<string, Night>; weather: Map<string, WeatherDay> },
  key: string,
  goalMl: number
): DayFactors {
  const before = dayKey(addDays(keyToDate(key), -1));
  const first = firstDrinkDay(data.drinks);
  const water = waterByDay(data.drinks);
  const caffeine = caffeineByDay(data.drinks);
  const factors: DayFactors = {};

  const w = data.weather.get(key);
  if (w && isPressureDrop(w.pressureDrop)) factors.pressure = w.pressureDrop;
  if (first !== null && before >= first) {
    const ml = water.get(before) ?? 0;
    if (ml < goalMl * LOW_HYDRATION) factors.hydration = ml;
  }
  const night = data.sleep.get(key);
  if (night && night.asleepMs < SHORT_SLEEP_HOURS * 3600000) factors.sleep = night.asleepMs / 3600000;
  if (alcoholDays(data.drinks).has(before)) factors.alcohol = true;
  const history = lastDays(keyToDate(before), 14).map((k) => caffeine.get(k) ?? 0);
  const usual = history.reduce((a, b) => a + b, 0) / history.length;
  const today = caffeine.get(key) ?? 0;
  if (caffeine.size && usual >= MIN_USUAL_CAFFEINE && today < usual * CAFFEINE_DROP) factors.caffeine = today;
  return factors;
}
