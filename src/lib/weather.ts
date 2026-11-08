import { addDays } from 'date-fns';
import type { HeadLogDb, WeatherDay } from './db';
import { dayKey, dayRange, keyToDate } from './days';

export interface Place {
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * A fall of the daily mean pressure by more than this many hPa from the day before is a known
 * migraine trigger (Kimoto et al. 2011, Intern Med 50:1923–1928).
 */
export const PRESSURE_DROP_HPA = 5;

export function isPressureDrop(drop: number): boolean {
  return drop > PRESSURE_DROP_HPA;
}

/**
 * How far the daily mean pressure falls from day `key` to the next day, or null when the next day is unknown.
 * Migraine is more frequent on the day before such a fall, so a drop here makes `key` itself unfavourable.
 */
export function dropToNextDay(weather: Map<string, WeatherDay>, key: string): number | null {
  return weather.get(dayKey(addDays(keyToDate(key), 1)))?.pressureDrop ?? null;
}

/** localStorage key holding the time of the last weather sync. */
export const WEATHER_SYNC_KEY = 'headlog.weatherSync';

/** The archive lags a few days behind; newer days come from the forecast API. */
const ARCHIVE_DELAY_DAYS = 6;
const RECENT_DAYS = 14;

/** Places matching a search, for choosing the home town. */
export async function searchPlaces(query: string, lang: string): Promise<(Place & { region: string })[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=${lang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = (await res.json()) as { results?: { name: string; latitude: number; longitude: number; admin1?: string; country?: string }[] };
  return (json.results ?? []).map((r) => ({
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    region: [r.admin1, r.country].filter(Boolean).join(', ')
  }));
}

interface OpenMeteo {
  hourly: { time: string[]; pressure_msl: (number | null)[]; relative_humidity_2m: (number | null)[] };
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
    weather_code: (number | null)[];
  };
}

/**
 * Daily values from an Open-Meteo answer. The pressure drop is how far the daily mean fell from the
 * day before; the first day only supplies that previous mean and is left out.
 */
export function toWeatherDays(json: OpenMeteo): WeatherDay[] {
  const hours = json.hourly.time;
  const meanOf = (day: string) => {
    const values = hours.flatMap((h, i) => (h.startsWith(day) && json.hourly.pressure_msl[i] !== null ? [json.hourly.pressure_msl[i]!] : []));
    return values.length ? avg(values) : null;
  };
  return json.daily.time.slice(1).flatMap((day, index) => {
    const i = index + 1;
    const dayHours = hours.filter((h) => h.startsWith(day));
    const mean = meanOf(day);
    if (mean === null || json.daily.temperature_2m_max[i] === null) return [];
    const before = meanOf(json.daily.time[i - 1]);
    const drop = before === null ? 0 : Math.max(0, before - mean);
    const humidity = dayHours
      .map((h) => json.hourly.relative_humidity_2m[hours.indexOf(h)])
      .filter((v): v is number => v !== null);
    return [
      {
        day,
        pressure: round(mean),
        pressureDrop: round(drop),
        tempMax: json.daily.temperature_2m_max[i]!,
        tempMin: json.daily.temperature_2m_min[i] ?? json.daily.temperature_2m_max[i]!,
        humidity: humidity.length ? Math.round(avg(humidity)) : null,
        precipitation: json.daily.precipitation_sum[i] ?? 0,
        code: json.daily.weather_code[i] ?? 0
      }
    ];
  });
}


function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

const VARIABLES = 'hourly=pressure_msl,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto';

async function get(url: string): Promise<WeatherDay[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return toWeatherDays((await res.json()) as OpenMeteo);
}

/**
 * Stores weather for every day from `firstDay` to the day after tomorrow. Older days come once from the archive;
 * the last two weeks and the forecast are fetched again on every sync.
 */
export async function syncWeather(database: HeadLogDb, place: Place, firstDay: string, today = Date.now()) {
  const coords = `latitude=${place.latitude}&longitude=${place.longitude}`;
  const archiveEnd = dayKey(addDays(today, -ARCHIVE_DELAY_DAYS));
  if (firstDay <= archiveEnd) {
    const stored = new Set((await database.weather.where('day').between(firstDay, archiveEnd, true, true).primaryKeys()) as string[]);
    const missing = dayRange(keyToDate(firstDay), keyToDate(archiveEnd)).filter((k) => !stored.has(k));
    if (missing.length) {
      const start = dayKey(addDays(keyToDate(missing[0]), -1));
      const days = await get(`https://archive-api.open-meteo.com/v1/archive?${coords}&start_date=${start}&end_date=${missing[missing.length - 1]}&${VARIABLES}`);
      await database.weather.bulkPut(days);
    }
  }
  const days = await get(`https://api.open-meteo.com/v1/forecast?${coords}&past_days=${RECENT_DAYS + 1}&forecast_days=3&${VARIABLES}`);
  await database.weather.bulkPut(days);
}

/** Emoji for a WMO weather code. */
export function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 67 || (code >= 80 && code <= 82)) return '🌧️';
  if (code <= 77 || code === 85 || code === 86) return '🌨️';
  return '⛈️';
}
