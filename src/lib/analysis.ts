import { addDays, getDay, getHours, startOfDay, startOfMonth } from 'date-fns';
import type { Drink, Episode, Intake, Medication, Night, WeatherDay } from './db';
import { hydrationMl } from './drinks';
import { ACUTE_CATEGORIES, MONTHLY_LIMITS, MULTIPLE_CLASSES_LIMIT, type MedCategory } from './medication';
import { DAY, dayKey, dayRange, HOUR, keyToDate, lastDays } from './days';
import { CAFFEINE_DROP, LOW_HYDRATION, MIN_CAFFEINE_DAYS, MIN_SLEEP_EFFICIENCY, MIN_USUAL_CAFFEINE, SHORT_SLEEP_HOURS } from './thresholds';
import { dropToNextDay, isPressureDrop } from './weather';

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

/**
 * The other ongoing episode that saving `episode` as ongoing would conflict with. Only one headache
 * can be ongoing at a time; an ended episode never conflicts.
 */
export function conflictingOngoing(episodes: Episode[], episode: { id?: number; end: number | null }): Episode | undefined {
  if (episode.end !== null) return undefined;
  return episodes.find((e) => e.end === null && e.id !== episode.id);
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

/** Fluid that counts toward the goal on the calendar day of `day`. */
export function waterOn(drinks: Drink[], day: number | Date): number {
  const from = startOfDay(day).getTime();
  const to = addDays(from, 1).getTime();
  return drinks.filter((d) => d.time >= from && d.time < to).reduce((sum, d) => sum + hydrationMl(d), 0);
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

/** Days `hydrationBefore` looks back on for what is usual, and how many of them need drinks. */
const USUAL_HYDRATION_DAYS = 30;
const MIN_USUAL_HYDRATION_DAYS = 7;

/**
 * Hydration in the `hours` before `time`, and what is usual for that many hours: the average over the
 * 30 days before, scaled to the same length. Usual is null without at least 7 days with drinks.
 */
export function hydrationBefore(drinks: Drink[], time: number, hours = 72): { ml: number; usual: number | null } {
  const from = time - hours * HOUR;
  const ml = drinks.filter((d) => d.time >= from && d.time < time).reduce((sum, d) => sum + hydrationMl(d), 0);
  const water = waterByDay(drinks.filter((d) => d.time < from && d.time >= from - USUAL_HYDRATION_DAYS * DAY));
  const mean = water.size >= MIN_USUAL_HYDRATION_DAYS ? average([...water.values()]) : null;
  const usual = mean === null ? null : mean * (hours / 24);
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

/** Days the usual caffeine amount looks back on. */
const USUAL_CAFFEINE_DAYS = 14;

/** The days the usual caffeine amount for `day` is based on: up to 14 before it, since the first logged drink. */
function caffeineHistory(firstDrink: string, day: string): string[] {
  return lastDays(addDays(keyToDate(day), -1), USUAL_CAFFEINE_DAYS).filter((k) => k >= firstDrink);
}

/**
 * The usual daily caffeine before `day`: the average over the 14 days before it, counting only days
 * since the first logged drink, since days before it are unknown. Null without any caffeine logged or
 * with fewer than 7 such days. The forecast and the report both judge a caffeine drop against this.
 */
export function usualCaffeine(caffeine: Map<string, number>, firstDrink: string | null, day: string): number | null {
  if (!caffeine.size || firstDrink === null) return null;
  const history = caffeineHistory(firstDrink, day);
  return history.length < MIN_CAFFEINE_DAYS ? null : average(history.map((k) => caffeine.get(k) ?? 0));
}

/**
 * The caffeine usually taken by `minutes` after midnight, averaged over the same days as
 * usualCaffeine. Lets the forecast judge today against what is normal at this hour, not against a
 * whole day. Null where usualCaffeine is null.
 */
export function usualCaffeineByTime(drinks: Drink[], firstDrink: string | null, day: string, minutes: number): number | null {
  if (firstDrink === null || !drinks.some((d) => d.caffeineMg)) return null;
  const history = caffeineHistory(firstDrink, day);
  if (history.length < MIN_CAFFEINE_DAYS) return null;
  const days = new Set(history);
  let total = 0;
  for (const d of drinks) {
    if (!d.caffeineMg || !days.has(dayKey(d.time))) continue;
    const at = new Date(d.time);
    if (at.getHours() * 60 + at.getMinutes() <= minutes) total += d.caffeineMg;
  }
  return total / history.length;
}

/** Whether `day` as a whole had less than half of its usual caffeine, for a usual amount worth judging. */
export function caffeineDropOn(caffeine: Map<string, number>, firstDrink: string | null, day: string): boolean {
  const usual = usualCaffeine(caffeine, firstDrink, day);
  return usual !== null && usual >= MIN_USUAL_CAFFEINE && (caffeine.get(day) ?? 0) < usual * CAFFEINE_DROP;
}

/** Share of the night from falling asleep to waking up that was spent asleep, 0 to 1. */
export function sleepEfficiency(night: Pick<Night, 'start' | 'end' | 'asleepMs'>): number {
  const span = night.end - night.start;
  return span > 0 ? Math.min(1, night.asleepMs / span) : 1;
}

/**
 * Whether a night may favour a headache: very short (under 5 h asleep) or fragmented (under 85 % of
 * it asleep). Low sleep efficiency, not a short night, went with migraine in Bertisch et al. 2020.
 */
export function poorNight(night: Pick<Night, 'start' | 'end' | 'asleepMs'>): { short: boolean; fragmented: boolean } {
  return { short: night.asleepMs < SHORT_SLEEP_HOURS * HOUR, fragmented: sleepEfficiency(night) < MIN_SLEEP_EFFICIENCY };
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
  /** Most medication days that still count as within the limit. */
  allowed: number;
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
 * The 10/20 rule: within any 30 consecutive days, take acute headache medication on fewer than
 * `limit` days. `allowed` is the most days still within it; a personal limit allows `limit` days.
 */
export function tenTwenty(medDays: Set<string>, today: number | Date, limit = 10, window = 30, allowed = limit - 1): TenTwenty {
  const days = lastDays(today, window).map((key) => ({ key, med: medDays.has(key) }));
  const count = days.filter((d) => d.med).length;
  const todayTaken = days[days.length - 1].med;
  const first = days.find((d) => d.med);
  return {
    count,
    limit,
    allowed,
    window,
    status: ruleStatus(count, allowed),
    days,
    ifTakenToday: todayTaken ? count : count + 1,
    nextRelief: first ? dayKey(addDays(keyToDate(first.key), window)) : null,
    freeDays: window - count
  };
}

/** Over above `allowed` days, caution from 80 % of it. */
export function ruleStatus(count: number, allowed: number): RuleStatus {
  if (count > allowed) return 'over';
  if (count >= Math.ceil(allowed * 0.8)) return 'caution';
  return 'ok';
}

/** The 30-day count for each medication that has a personal limit. */
export function medicationLimits(intakes: Intake[], medications: Medication[], today: number | Date) {
  return medications
    .filter((m) => m.limitDays)
    .map((med) => {
      const days = new Set(intakes.filter((i) => i.medId === med.id).map((i) => dayKey(i.time)));
      return { med, rule: tenTwenty(days, today, med.limitDays, med.limitWindow ?? 30, med.limitDays) };
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

/** The window an overuse limit counts in: the 30 days up to and including today. */
const OVERUSE_WINDOW_DAYS = 30;

function inOveruseWindow(intakes: Intake[], today: number | Date): Intake[] {
  const from = startOfDay(addDays(today, -(OVERUSE_WINDOW_DAYS - 1))).getTime();
  const to = new Date(today).getTime();
  return intakes.filter((i) => i.time >= from && i.time <= to);
}

/** Days in the last 30 with medication from any class that has an overuse limit. */
export function limitedDays(intakes: Intake[], today: number | Date): number {
  return new Set(inOveruseWindow(intakes, today).filter((i) => MONTHLY_LIMITS[i.category] !== undefined).map((i) => dayKey(i.time))).size;
}

/** Days in the last 30 with medication of each class. */
export function categoryDays(intakes: Intake[], today: number | Date): Map<MedCategory, number> {
  const sets = new Map<MedCategory, Set<string>>();
  for (const i of inOveruseWindow(intakes, today)) {
    const set = sets.get(i.category) ?? new Set<string>();
    set.add(dayKey(i.time));
    sets.set(i.category, set);
  }
  return new Map([...sets].map(([c, s]) => [c, s.size]));
}

/** A class with an overuse limit and its days this month, or `multiple` for several classes together. */
export interface OveruseRow {
  key: MedCategory | 'multiple';
  days: number;
  limit: number;
}

/**
 * The ICHD-3 overuse rows for the last 30 days: one per class with a limit that was
 * used, plus the rule for several classes together once two or more were used.
 */
export function overuseRows(intakes: Intake[], today: number | Date): OveruseRow[] {
  const days = categoryDays(intakes, today);
  const rows: OveruseRow[] = (Object.keys(MONTHLY_LIMITS) as MedCategory[])
    .filter((c) => days.has(c))
    .map((c) => ({ key: c, days: days.get(c)!, limit: MONTHLY_LIMITS[c]! }));
  if (rows.length > 1) rows.push({ key: 'multiple', days: limitedDays(intakes, today), limit: MULTIPLE_CLASSES_LIMIT });
  return rows;
}

export interface MedicationEffect {
  name: string;
  dose: string;
  category: MedCategory;
  /** The list entry of the first intake in the group. */
  medId: number;
  intakes: number;
  days: number;
  /** Rated intakes per relief, indexed by `Relief`. */
  relief: [number, number, number];
  rated: number;
}

/**
 * Intakes, days and relief ratings per medication for intakes from `from` to `to`, most taken first.
 * `keyOf` decides what counts as one medication: the Meds tab groups by name, so a dose change stays
 * one entry, while the doctor report groups by name and dose, since the dose matters there.
 */
export function medicationEffect(intakes: Intake[], from: number, to: number, keyOf: (intake: Intake) => string): MedicationEffect[] {
  const groups = new Map<string, MedicationEffect & { dayKeys: Set<string> }>();
  for (const i of intakes) {
    if (i.time < from || i.time > to) continue;
    const key = keyOf(i);
    const g = groups.get(key) ?? { name: i.name, dose: i.dose, category: i.category, medId: i.medId, intakes: 0, days: 0, relief: [0, 0, 0], rated: 0, dayKeys: new Set<string>() };
    g.intakes++;
    g.dayKeys.add(dayKey(i.time));
    if (i.relief !== null) {
      g.relief[i.relief]++;
      g.rated++;
    }
    groups.set(key, g);
  }
  return [...groups.values()].map(({ dayKeys, ...g }) => ({ ...g, days: dayKeys.size })).sort((a, b) => b.intakes - a.intakes);
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

  const tagMap = new Map<string, number>();
  for (const e of episodes) for (const t of e.tags) tagMap.set(t, (tagMap.get(t) ?? 0) + 1);

  const allHeadache = [...hDays.keys()].sort();
  const lastHeadache = allHeadache[allHeadache.length - 1];

  return {
    days: span,
    headacheDays: keys.filter((k) => hDays.has(k)).length,
    episodes: episodes.length,
    avgDurationMs: average(done.map((e) => e.end! - e.start)),
    avgIntensity: average(episodes.map((e) => e.intensity)),
    medDays: mDays.size,
    intakes: intakes.length,
    weekday,
    timeOfDay,
    avgWaterMl: average(waterDays.map((k) => water.get(k)!)),
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

/** The mean of `values`, or null for none. */
export function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** One value per day of `keys` for the timeline charts. Null where nothing is known; days after today only have the weather forecast. */
export function timeline(
  data: { episodes: Episode[]; drinks: Drink[]; sleep: Map<string, Night>; weather: Map<string, WeatherDay> },
  keys: string[],
  now: number
) {
  const pain = headacheDays(data.episodes, now);
  const water = waterByDay(data.drinks);
  const first = firstDrinkDay(data.drinks);
  const today = dayKey(now);
  return {
    headache: keys.map((k) => pain.get(k) ?? 0),
    hydration: keys.map((k) => (water.has(k) ? water.get(k)! : first !== null && k >= first && k <= today ? 0 : null)),
    sleepHours: keys.map((k) => (data.sleep.has(k) ? data.sleep.get(k)!.asleepMs / HOUR : null)),
    pressure: keys.map((k) => data.weather.get(k)?.pressure ?? null)
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
const MIN_COMPARISON_DAYS = 3;

/**
 * Compares the days a headache started with days without headache: hydration, caffeine and
 * alcohol the day before, sleep the night before, and how often the pressure dropped on the day
 * after. Today is left out because it is not over.
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
    ['sleep', (k) => (data.sleep.has(k) ? data.sleep.get(k)!.asleepMs / HOUR : null)],
    ['caffeine', (k) => (tracksCaffeine && water.has(before(k)) ? (caffeine.get(before(k)) ?? 0) : null)],
    ['pressure', (k) => {
      const drop = dropToNextDay(data.weather, k);
      return drop === null ? null : isPressureDrop(drop) ? 1 : 0;
    }],
    ['alcohol', (k) => (tracksAlcohol && water.has(before(k)) ? (alcohol.has(before(k)) ? 1 : 0) : null)]
  ];

  return factors.flatMap(([key, value]) => {
    const h = startDays.map(value).filter((v): v is number => v !== null);
    const c = clearDays.map(value).filter((v): v is number => v !== null);
    if (h.length < MIN_COMPARISON_DAYS || c.length < MIN_COMPARISON_DAYS) return [];
    return [{ key, headache: average(h)!, clear: average(c)!, nHeadache: h.length, nClear: c.length }];
  });
}

export interface DayFactors {
  /** Fall of the daily mean pressure to the next day, when it counts as a drop. */
  pressure?: number;
  /** Fluid the day before, when below three quarters of the goal. */
  hydration?: number;
  /** Hours asleep the night before, when the night was very short or fragmented. */
  sleep?: number;
  /** Share of the night spent asleep, when the night was fragmented. */
  sleepEfficiency?: number;
  /** Alcohol the day before. */
  alcohol?: true;
  /** Caffeine on the day, when below half of the usual amount. */
  caffeine?: number;
}

/**
 * The factors present for a headache that started on `key`, by the same rules as the forecast:
 * pressure drop to the next day, little to drink and alcohol the day before, a short or fragmented night, a caffeine
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

  const drop = dropToNextDay(data.weather, key);
  if (drop !== null && isPressureDrop(drop)) factors.pressure = drop;
  if (first !== null && before >= first) {
    const ml = water.get(before) ?? 0;
    if (ml < goalMl * LOW_HYDRATION) factors.hydration = ml;
  }
  const night = data.sleep.get(key);
  if (night) {
    const { short, fragmented } = poorNight(night);
    if (short || fragmented) factors.sleep = night.asleepMs / HOUR;
    if (fragmented) factors.sleepEfficiency = sleepEfficiency(night);
  }
  if (alcoholDays(data.drinks).has(before)) factors.alcohol = true;
  // A drop that day or the day before: withdrawal headaches peak one to two days after it.
  if (caffeineDropOn(caffeine, first, key) || caffeineDropOn(caffeine, first, before)) factors.caffeine = caffeine.get(key) ?? 0;
  return factors;
}

/** Today's running total of caffeine up to `now`, one point per caffeinated drink, in time order. */
export function caffeineCurve(drinks: Drink[], now: number): { time: number; mg: number }[] {
  const today = dayKey(now);
  let total = 0;
  return drinks
    .filter((d) => d.caffeineMg && d.time <= now && dayKey(d.time) === today)
    .sort((a, b) => a.time - b.time)
    .map((d) => ({ time: d.time, mg: (total += d.caffeineMg ?? 0) }));
}

/** What is usual by each step of `stepMinutes` through `day`, or null before enough days are logged. */
export function usualCaffeineCurve(drinks: Drink[], day: string, stepMinutes = 30): { minutes: number; mg: number }[] | null {
  const first = firstDrinkDay(drinks);
  if (usualCaffeineByTime(drinks, first, day, 24 * 60) === null) return null;
  return Array.from({ length: (24 * 60) / stepMinutes + 1 }, (_, i) => ({ minutes: i * stepMinutes, mg: usualCaffeineByTime(drinks, first, day, i * stepMinutes) ?? 0 }));
}

/** Alcoholic drinks per day over the last `days` days up to `now`, oldest first. */
export function alcoholPerDay(drinks: Drink[], now: number, days = 7): { key: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const d of drinks) if (d.alcohol && d.time <= now) counts.set(dayKey(d.time), (counts.get(dayKey(d.time)) ?? 0) + 1);
  return lastDays(now, days).map((key) => ({ key, n: counts.get(key) ?? 0 }));
}

/**
 * The daily weather from yesterday to the day after tomorrow, days without weather left out. `offset` is
 * the day relative to today; `marked` is a day before a pressure drop, which the forecast counts.
 */
export function pressureAround(weather: Map<string, WeatherDay>, now: number): { key: string; offset: number; weather: WeatherDay; marked: boolean }[] {
  return [-1, 0, 1, 2].flatMap((offset) => {
    const key = dayKey(addDays(now, offset));
    const w = weather.get(key);
    if (!w) return [];
    const drop = dropToNextDay(weather, key);
    return [{ key, offset, weather: w, marked: drop !== null && isPressureDrop(drop) }];
  });
}
