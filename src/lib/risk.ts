import { addDays, getHours } from 'date-fns';
import { alcoholDays, caffeineByDay, waterByDay } from './analysis';
import type { Drink, Episode, Night, WeatherDay } from './db';
import { dayKey, keyToDate, lastDays } from './days';

export type FactorKey = 'pressure' | 'hydration' | 'sleep' | 'alcohol' | 'caffeine';

export interface RiskData {
  episodes: Episode[];
  drinks: Drink[];
  sleep: Map<string, Night>;
  weather: Map<string, WeatherDay>;
}

export interface Thresholds {
  dropHpa: number;
  goalMl: number;
}

/** Below this share of the hydration goal a day counts as "little to drink". */
export const LOW_HYDRATION = 0.75;
/** A night under this many hours counts as short. */
export const SHORT_SLEEP_HOURS = 6;
/** Caffeine under this share of the usual amount counts as a drop. */
export const CAFFEINE_DROP = 0.5;
/** Days with and without a factor needed before its effect is estimated. */
export const MIN_WITH = 5;
export const MIN_WITHOUT = 10;
/** From this hour on, little to drink so far today counts toward tomorrow's risk. */
const HYDRATION_FROM_HOUR = 16;
/** Each active factor beyond the strongest raises the estimate by this share. */
const EXTRA_FACTOR = 0.15;
const MAX_ESTIMATE = 0.9;
/** How far back the history goes. */
const HISTORY_DAYS = 365;

export interface FactorStats {
  key: FactorKey;
  /** Share of days a headache started, with and without the factor. */
  withRate: number;
  withoutRate: number;
  nWith: number;
  nWithout: number;
  /** How many times more likely a headache was with the factor; null with too few days. */
  ratio: number | null;
}

export interface ActiveFactor {
  key: FactorKey;
  /** Shown value, e.g. hPa, ml, hours or mg. */
  value: number;
  stats: FactorStats;
}

export interface Risk {
  day: 'today' | 'tomorrow';
  /** Share of days a headache started, over the whole history. */
  usual: number;
  /** Estimated chance for the day, or null when no factor has enough data. */
  estimate: number | null;
  /** Estimate relative to usual; 1 without an estimate. */
  ratio: number;
  level: 'none' | 'possible' | 'raised' | 'high';
  factors: ActiveFactor[];
}

/** Value of each factor on day `key`, or null when unknown. True means present. */
function factorValues(data: RiskData, t: Thresholds) {
  const water = waterByDay(data.drinks);
  const caffeine = caffeineByDay(data.drinks);
  const alcohol = alcoholDays(data.drinks);
  const tracksAlcohol = alcohol.size > 0;
  const before = (key: string) => dayKey(addDays(keyToDate(key), -1));
  const usualCaffeine = (key: string) => {
    const days = lastDays(keyToDate(before(key)), 14).map((k) => caffeine.get(k) ?? 0);
    return days.reduce((a, b) => a + b, 0) / days.length;
  };

  const check: Record<FactorKey, (key: string) => { present: boolean; value: number } | null> = {
    pressure: (key) => {
      const w = data.weather.get(key);
      return w ? { present: w.pressureDrop >= t.dropHpa, value: w.pressureDrop } : null;
    },
    hydration: (key) => {
      const ml = water.get(before(key));
      return ml === undefined ? null : { present: ml < t.goalMl * LOW_HYDRATION, value: ml };
    },
    sleep: (key) => {
      const night = data.sleep.get(key);
      return night ? { present: night.asleepMs < SHORT_SLEEP_HOURS * 3600000, value: night.asleepMs / 3600000 } : null;
    },
    alcohol: (key) => (tracksAlcohol && water.has(before(key)) ? { present: alcohol.has(before(key)), value: 1 } : null),
    caffeine: (key) => {
      const usual = usualCaffeine(key);
      if (usual < 100 || !water.has(key)) return null;
      const today = caffeine.get(key) ?? 0;
      return { present: today < usual * CAFFEINE_DROP, value: today };
    }
  };
  return check;
}

/** How headache starts differed with and without each factor in the history before today. */
export function factorStats(data: RiskData, t: Thresholds, now: number): FactorStats[] {
  const check = factorValues(data, t);
  const starts = new Set(data.episodes.map((e) => dayKey(e.start)));
  const history = lastDays(addDays(now, -1), HISTORY_DAYS);
  return (Object.keys(check) as FactorKey[]).map((key) => {
    let nWith = 0;
    let nWithout = 0;
    let startsWith = 0;
    let startsWithout = 0;
    for (const day of history) {
      const v = check[key](day);
      if (!v) continue;
      if (v.present) {
        nWith++;
        if (starts.has(day)) startsWith++;
      } else {
        nWithout++;
        if (starts.has(day)) startsWithout++;
      }
    }
    const withRate = nWith ? startsWith / nWith : 0;
    const withoutRate = nWithout ? startsWithout / nWithout : 0;
    const enough = nWith >= MIN_WITH && nWithout >= MIN_WITHOUT;
    return { key, withRate, withoutRate, nWith, nWithout, ratio: enough ? withRate / Math.max(withoutRate, 0.02) : null };
  });
}

/**
 * Risk of a headache starting today or tomorrow from the factors known now. The estimate is the
 * headache rate on days with the strongest active factor, raised a little for each further one. Tomorrow uses the
 * pressure forecast, today's alcohol and, from 16:00, today's hydration so far; today uses last
 * night, yesterday's drinks, today's pressure and, from noon, today's caffeine.
 */
export function assessRisk(data: RiskData, t: Thresholds, now: number, day: 'today' | 'tomorrow'): Risk {
  const stats = factorStats(data, t, now);
  const check = factorValues(data, t);
  const target = day === 'today' ? dayKey(now) : dayKey(addDays(now, 1));
  const history = lastDays(addDays(now, -1), HISTORY_DAYS);
  const starts = new Set(data.episodes.map((e) => dayKey(e.start)));
  const tracked = history.filter((k) => k >= dayKey(Math.min(...data.episodes.map((e) => e.start), ...data.drinks.map((d) => d.time), now)));
  const usual = tracked.length ? tracked.filter((k) => starts.has(k)).length / tracked.length : 0;

  const relevant: FactorKey[] = day === 'today' ? ['pressure', 'hydration', 'sleep', 'alcohol', 'caffeine'] : ['pressure', 'hydration', 'alcohol'];
  const factors: ActiveFactor[] = [];
  for (const key of relevant) {
    if (key === 'caffeine' && getHours(now) < 12) continue;
    // Today's hydration says little about tomorrow before the afternoon.
    if (day === 'tomorrow' && key === 'hydration' && getHours(now) < HYDRATION_FROM_HOUR) continue;
    const v = check[key](target);
    const s = stats.find((x) => x.key === key)!;
    if (v?.present && (s.ratio === null || s.ratio > 1.1)) factors.push({ key, value: v.value, stats: s });
  }

  const known = factors.filter((f) => f.stats.ratio !== null);
  // The strongest factor sets the estimate; each further one adds a little, as they overlap.
  const strongest = Math.max(0, ...known.map((f) => f.stats.withRate));
  const estimate = known.length ? Math.min(MAX_ESTIMATE, strongest * (1 + EXTRA_FACTOR * (known.length - 1))) : null;
  const ratio = estimate !== null && usual > 0 ? estimate / usual : 1;
  const level = !factors.length ? 'none' : ratio >= 2.5 ? 'high' : ratio >= 1.5 ? 'raised' : 'possible';
  return { day, usual, estimate, ratio, level, factors };
}
