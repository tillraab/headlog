import { addDays, getHours, getMinutes } from 'date-fns';
import { alcoholDays, average, caffeineByDay, caffeineDropOn, firstDrinkDay, poorNight, sleepEfficiency, usualCaffeine, usualCaffeineByTime, waterByDay } from './analysis';
import type { Drink, Night, WeatherDay } from './db';
import { dayKey, HOUR, lastDays } from './days';
import { CAFFEINE_DROP, LOW_HYDRATION, MIN_USUAL_CAFFEINE, MIN_USUAL_CAFFEINE_BY_NOW } from './thresholds';
import { isPressureDrop } from './weather';

export type Light = 'green' | 'yellow' | 'red';
export type FactorKey = 'weather' | 'hydration' | 'sleep' | 'alcohol' | 'caffeine';

export type Status = 'ok' | 'bad' | 'unknown';

/** The hydration goal is spread evenly over the waking day, 7:00 to 22:00. */
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;

export interface PrognosisInput {
  drinks: Drink[];
  sleep: Map<string, Night>;
  weather: Map<string, WeatherDay>;
  goalMl: number;
}

export interface Prognosis {
  light: Light;
  /** Number of unfavourable factors. */
  bad: number;
  weather: { status: Status; today?: WeatherDay; tomorrow?: WeatherDay; drop: number };
  hydration: { status: Status; today: number; yesterday: number | null; expected: number; goal: number; behind: boolean; lowYesterday: boolean };
  sleep: { status: Status; night?: Night; average: number | null; efficiency: number | null; short: boolean; fragmented: boolean };
  alcohol: { status: Status; yesterday: boolean; today: boolean; drinksToday: number; drinksYesterday: number };
  caffeine: {
    status: Status;
    /** Caffeine so far today, yesterday, and the usual amounts for a whole day and by this time of day. */
    today: number;
    yesterday: number;
    usual: number | null;
    usualByNow: number | null;
    todayLow: boolean;
    yesterdayLow: boolean;
    /** By this time of day you usually have had too little caffeine to judge today yet. */
    tooEarly: boolean;
  };
}

/** The forecast's input from the app data. */
export function prognosisInput(data: Omit<PrognosisInput, 'goalMl'> & { settings: { waterGoalMl: number } }): PrognosisInput {
  return { drinks: data.drinks, sleep: data.sleep, weather: data.weather, goalMl: data.settings.waterGoalMl };
}

/** Fluid that should have been reached by `now` to meet the goal by the evening. */
export function expectedByNow(goalMl: number, now: number): number {
  const hours = getHours(now) + getMinutes(now) / 60;
  const share = Math.min(1, Math.max(0, (hours - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)));
  return goalMl * share;
}

/**
 * Traffic light for today: a pressure drop from today to tomorrow, hydration yesterday and today,
 * last night's sleep, alcohol and caffeine. Each unfavourable factor counts; none is green,
 * 1 yellow, 2 or more red. Unknown factors (no weather, no sleep data) do not count.
 */
export function prognosis(input: PrognosisInput, now: number): Prognosis {
  const today = dayKey(now);
  const yesterday = dayKey(addDays(now, -1));
  const tomorrow = dayKey(addDays(now, 1));

  const todayWeather = input.weather.get(today);
  const tomorrowWeather = input.weather.get(tomorrow);
  // Migraine is more frequent on the day before a fall in pressure, so tomorrow's drop counts for today.
  const drop = tomorrowWeather?.pressureDrop ?? 0;
  const weatherStatus: Status = !tomorrowWeather ? 'unknown' : isPressureDrop(drop) ? 'bad' : 'ok';

  const water = waterByDay(input.drinks);
  const first = firstDrinkDay(input.drinks);
  const todayMl = water.get(today) ?? 0;
  const yesterdayMl = water.get(yesterday) ?? (first !== null && yesterday >= first ? 0 : null);
  const expected = expectedByNow(input.goalMl, now);
  const behindToday = todayMl < expected * LOW_HYDRATION;
  // Yesterday only counts while today's goal is not reached yet.
  const lowYesterday = todayMl < input.goalMl && yesterdayMl !== null && yesterdayMl < input.goalMl * LOW_HYDRATION;
  const hydrationStatus: Status = first === null ? 'unknown' : behindToday || lowYesterday ? 'bad' : 'ok';

  const night = input.sleep.get(today);
  const recent = lastDays(now, 7).map((k) => input.sleep.get(k)).filter((n) => n !== undefined);
  const recentMs = average(recent.map((n) => n.asleepMs));
  const sleepAverage = recentMs === null ? null : recentMs / HOUR;
  const poor = night ? poorNight(night) : { short: false, fragmented: false };
  const sleepStatus: Status = !night ? 'unknown' : poor.short || poor.fragmented ? 'bad' : 'ok';

  const alcohol = alcoholDays(input.drinks);
  const tracksAlcohol = input.drinks.some((d) => d.alcohol);
  const alcoholStatus: Status = !tracksAlcohol ? 'unknown' : alcohol.has(yesterday) || alcohol.has(today) ? 'bad' : 'ok';
  const alcoholCount = (key: string) => input.drinks.filter((d) => d.alcohol && d.time <= now && dayKey(d.time) === key).length;

  const caffeine = caffeineByDay(input.drinks.filter((d) => d.time <= now));
  const usual = usualCaffeine(caffeine, first, today);
  const usualByNow = usualCaffeineByTime(input.drinks, first, today, getHours(now) * 60 + getMinutes(now));
  const caffeineToday = caffeine.get(today) ?? 0;
  const judged = usual !== null && usual >= MIN_USUAL_CAFFEINE;
  const tooEarly = usualByNow === null || usualByNow < MIN_USUAL_CAFFEINE_BY_NOW;
  // Today against what is usual by this time of day; yesterday as a whole, since withdrawal peaks a day or two later.
  const todayLow = judged && usualByNow !== null && !tooEarly && caffeineToday < usualByNow * CAFFEINE_DROP;
  const yesterdayLow = caffeineDropOn(caffeine, first, yesterday);
  const caffeineStatus: Status = !judged ? 'unknown' : todayLow || yesterdayLow ? 'bad' : 'ok';

  const statuses = [weatherStatus, hydrationStatus, sleepStatus, alcoholStatus, caffeineStatus];
  const bad = statuses.filter((s) => s === 'bad').length;
  return {
    light: bad >= 2 ? 'red' : bad === 1 ? 'yellow' : 'green',
    bad,
    weather: { status: weatherStatus, today: todayWeather, tomorrow: tomorrowWeather, drop },
    hydration: { status: hydrationStatus, today: todayMl, yesterday: yesterdayMl, expected, goal: input.goalMl, behind: behindToday, lowYesterday },
    sleep: { status: sleepStatus, night, average: sleepAverage, efficiency: night ? sleepEfficiency(night) : null, ...poor },
    alcohol: { status: alcoholStatus, yesterday: alcohol.has(yesterday), today: alcohol.has(today), drinksToday: alcoholCount(today), drinksYesterday: alcoholCount(yesterday) },
    caffeine: { status: caffeineStatus, today: caffeineToday, yesterday: caffeine.get(yesterday) ?? 0, usual, usualByNow, todayLow, yesterdayLow, tooEarly }
  };
}

/** The unfavourable factors, in a fixed order. */
export function badFactors(p: Prognosis): FactorKey[] {
  const all: [FactorKey, Status][] = [
    ['weather', p.weather.status],
    ['hydration', p.hydration.status],
    ['sleep', p.sleep.status],
    ['alcohol', p.alcohol.status],
    ['caffeine', p.caffeine.status]
  ];
  return all.filter(([, s]) => s === 'bad').map(([k]) => k);
}

export type TomorrowFactor = 'weather' | 'hydration' | 'alcohol';

export interface TomorrowRisk {
  light: Light;
  /** The unfavourable factors, in a fixed order. */
  factors: TomorrowFactor[];
}

/**
 * The outlook for tomorrow as it stands at `at`, for the evening warning. Only what can still matter
 * tomorrow counts: a pressure drop from tomorrow to the day after, today's total below three quarters of the goal (tomorrow's
 * "yesterday"), and alcohol today. Last night's sleep and today's caffeine say nothing about tomorrow.
 * 0 unfavourable is green, 1 yellow, 2 or more red; unknown factors do not count.
 */
export function tomorrowRisk(input: PrognosisInput, at: number): TomorrowRisk {
  const today = dayKey(at);
  const dayAfter = input.weather.get(dayKey(addDays(at, 2)));
  const drinks = input.drinks.filter((d) => d.time <= at);
  const first = firstDrinkDay(drinks);
  const statuses: [TomorrowFactor, Status][] = [
    ['weather', !dayAfter ? 'unknown' : isPressureDrop(dayAfter.pressureDrop) ? 'bad' : 'ok'],
    ['hydration', first === null ? 'unknown' : (waterByDay(drinks).get(today) ?? 0) < input.goalMl * LOW_HYDRATION ? 'bad' : 'ok'],
    ['alcohol', !drinks.some((d) => d.alcohol) ? 'unknown' : alcoholDays(drinks).has(today) ? 'bad' : 'ok']
  ];
  const factors = statuses.filter(([, s]) => s === 'bad').map(([k]) => k);
  return { light: factors.length >= 2 ? 'red' : factors.length === 1 ? 'yellow' : 'green', factors };
}
