import { addDays } from 'date-fns';
import type { HeadLogDb, WeatherDay } from './db';
import { dayKey, dayRange, keyToDate } from './days';

export interface Place {
  name: string;
  latitude: number;
  longitude: number;
}

/** A pressure drop of this many hPa within 24 hours counts as a notable weather change. */
export const PRESSURE_DROP_HPA = 6;

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

/** Daily values from an Open-Meteo answer. The first day only supplies pressure history and is left out. */
export function toWeatherDays(json: OpenMeteo): WeatherDay[] {
  const pressure = new Map<string, number>();
  json.hourly.time.forEach((time, i) => {
    const p = json.hourly.pressure_msl[i];
    if (p !== null) pressure.set(time, p);
  });
  const hours = json.hourly.time;
  return json.daily.time.slice(1).flatMap((day, index) => {
    const i = index + 1;
    const dayHours = hours.filter((h) => h.startsWith(day));
    const values = dayHours.map((h) => pressure.get(h)).filter((p): p is number => p !== undefined);
    if (!values.length || json.daily.temperature_2m_max[i] === null) return [];
    let drop = 0;
    for (const h of dayHours) {
      const now = pressure.get(h);
      const before = pressure.get(shiftHour(h, -24));
      if (now !== undefined && before !== undefined) drop = Math.max(drop, before - now);
    }
    const humidity = dayHours
      .map((h) => json.hourly.relative_humidity_2m[hours.indexOf(h)])
      .filter((v): v is number => v !== null);
    return [
      {
        day,
        pressure: round(avg(values)),
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

function shiftHour(iso: string, hours: number): string {
  const d = new Date(`${iso}:00Z`);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString().slice(0, 13) + ':00';
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
 * Stores weather for every day from `firstDay` to tomorrow. Older days come once from the archive;
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
  const days = await get(`https://api.open-meteo.com/v1/forecast?${coords}&past_days=${RECENT_DAYS + 1}&forecast_days=2&${VARIABLES}`);
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
