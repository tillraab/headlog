import { addDays, getHours, getMinutes } from 'date-fns';
import { alcoholDays, caffeineByDay, firstDrinkDay, waterByDay } from './analysis';
import type { Drink, Night, WeatherDay } from './db';
import { dayKey, lastDays } from './days';
import { CAFFEINE_DROP, LOW_HYDRATION, MIN_USUAL_CAFFEINE, SHORT_SLEEP_HOURS } from './thresholds';
import { isPressureDrop } from './weather';

export type Light = 'green' | 'yellow' | 'red';
export type FactorKey = 'weather' | 'hydration' | 'sleep' | 'alcohol' | 'caffeine';

export type Status = 'ok' | 'bad' | 'unknown';

/** The hydration goal is spread evenly over the waking day, 7:00 to 22:00. */
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;
/** Before this hour today's caffeine says nothing yet. */
const CAFFEINE_FROM_HOUR = 10;

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
  sleep: { status: Status; night?: Night; average: number | null };
  alcohol: { status: Status; yesterday: boolean; today: boolean };
  caffeine: { status: Status; today: number; usual: number | null; tooEarly: boolean };
}

/** Fluid that should have been reached by `now` to meet the goal by the evening. */
export function expectedByNow(goalMl: number, now: number): number {
  const hours = getHours(now) + getMinutes(now) / 60;
  const share = Math.min(1, Math.max(0, (hours - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)));
  return goalMl * share;
}

/**
 * Traffic light for the hours ahead: weather today and tomorrow, hydration yesterday and today,
 * last night's sleep, alcohol and caffeine. Each unfavourable factor counts; none is green,
 * 1 yellow, 2 or more red. Unknown factors (no weather, no sleep data) do not count.
 */
export function prognosis(input: PrognosisInput, now: number): Prognosis {
  const today = dayKey(now);
  const yesterday = dayKey(addDays(now, -1));
  const tomorrow = dayKey(addDays(now, 1));

  const todayWeather = input.weather.get(today);
  const tomorrowWeather = input.weather.get(tomorrow);
  const drop = Math.max(todayWeather?.pressureDrop ?? 0, tomorrowWeather?.pressureDrop ?? 0);
  const weatherStatus: Status = !todayWeather && !tomorrowWeather ? 'unknown' : isPressureDrop(drop) ? 'bad' : 'ok';

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
  const average = recent.length ? recent.reduce((s, n) => s + n.asleepMs, 0) / recent.length / 3600000 : null;
  const sleepStatus: Status = !night ? 'unknown' : night.asleepMs < SHORT_SLEEP_HOURS * 3600000 ? 'bad' : 'ok';

  const alcohol = alcoholDays(input.drinks);
  const tracksAlcohol = input.drinks.some((d) => d.alcohol);
  const alcoholStatus: Status = !tracksAlcohol ? 'unknown' : alcohol.has(yesterday) || alcohol.has(today) ? 'bad' : 'ok';

  const caffeine = caffeineByDay(input.drinks);
  // The usual amount counts only days since the first logged drink, at most the last 14.
  const history = lastDays(addDays(now, -1), 14)
    .filter((k) => first !== null && k >= first)
    .map((k) => caffeine.get(k) ?? 0);
  const usual = caffeine.size && history.length ? history.reduce((a, b) => a + b, 0) / history.length : null;
  const caffeineToday = caffeine.get(today) ?? 0;
  const caffeineStatus: Status =
    usual === null || usual < MIN_USUAL_CAFFEINE || getHours(now) < CAFFEINE_FROM_HOUR ? 'unknown' : caffeineToday < usual * CAFFEINE_DROP ? 'bad' : 'ok';

  const statuses = [weatherStatus, hydrationStatus, sleepStatus, alcoholStatus, caffeineStatus];
  const bad = statuses.filter((s) => s === 'bad').length;
  return {
    light: bad >= 2 ? 'red' : bad === 1 ? 'yellow' : 'green',
    bad,
    weather: { status: weatherStatus, today: todayWeather, tomorrow: tomorrowWeather, drop },
    hydration: { status: hydrationStatus, today: todayMl, yesterday: yesterdayMl, expected, goal: input.goalMl, behind: behindToday, lowYesterday },
    sleep: { status: sleepStatus, night, average },
    alcohol: { status: alcoholStatus, yesterday: alcohol.has(yesterday), today: alcohol.has(today) },
    caffeine: { status: caffeineStatus, today: caffeineToday, usual, tooEarly: getHours(now) < CAFFEINE_FROM_HOUR }
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
