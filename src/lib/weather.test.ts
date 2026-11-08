import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeadLogDb } from './db';
import { dropToNextDay, isPressureDrop, syncWeather, toWeatherDays } from './weather';

/** Three days of hourly data: steady 1015 hPa on the first two, falling 0.5 hPa per hour on the third. */
function sample(days = ['2026-03-01', '2026-03-02', '2026-03-03']) {
  const time: string[] = [];
  const pressure: number[] = [];
  days.forEach((day, d) => {
    for (let h = 0; h < 24; h++) {
      time.push(`${day}T${String(h).padStart(2, '0')}:00`);
      pressure.push(d < 2 ? 1015 : 1015 - (h + 1) * 0.5);
    }
  });
  return {
    hourly: { time, pressure_msl: pressure, relative_humidity_2m: time.map(() => 80) },
    daily: {
      time: days,
      temperature_2m_max: days.map(() => 12),
      temperature_2m_min: days.map(() => 4),
      precipitation_sum: days.map(() => 1.5),
      weather_code: days.map(() => 61)
    }
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('toWeatherDays', () => {
  it('leaves out the first day, which only supplies pressure history', () => {
    expect(toWeatherDays(sample()).map((d) => d.day)).toEqual(['2026-03-02', '2026-03-03']);
  });

  it('measures the drop as the daily mean against the day before', () => {
    const [, falling] = toWeatherDays(sample());
    expect([falling.pressure, falling.pressureDrop]).toEqual([1008.8, 6.3]);
  });

  it('records no drop when the pressure rises', () => {
    const rising = sample();
    rising.hourly.pressure_msl = rising.hourly.pressure_msl.map((p, i) => (i < 24 ? p : p + 20));
    expect(toWeatherDays(rising)[0].pressureDrop).toBe(0);
  });

  it('keeps temperature, humidity, rain and weather code', () => {
    const [steady] = toWeatherDays(sample());
    expect(steady).toEqual({ day: '2026-03-02', pressure: 1015, pressureDrop: 0, tempMax: 12, tempMin: 4, humidity: 80, precipitation: 1.5, code: 61 });
  });
});

describe('syncWeather', () => {
  const place = { name: 'Erlangen', latitude: 49.6, longitude: 11 };

  const today = new Date('2026-03-31T12:00').getTime();

  function capture() {
    const urls: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (urls.push(new URL(url)), Response.json(sample()))));
    return urls;
  }

  it('asks the archive for missing old days, starting a day early for pressure history', async () => {
    const urls = capture();
    await syncWeather(new HeadLogDb(`weather-${Math.random()}`), place, '2026-03-02', today);
    const archive = urls.find((u) => u.hostname.startsWith('archive'))!;
    expect([archive.searchParams.get('start_date'), archive.searchParams.get('end_date')]).toEqual(['2026-03-01', '2026-03-25']);
  });

  it('skips the archive when all old days are stored', async () => {
    const db = new HeadLogDb(`weather-${Math.random()}`);
    const days = Array.from({ length: 24 }, (_, i) => `2026-03-${String(i + 2).padStart(2, '0')}`);
    await db.weather.bulkPut(days.map((day) => ({ day, pressure: 1015, pressureDrop: 0, tempMax: 10, tempMin: 2, humidity: 70, precipitation: 0, code: 0 })));
    const urls = capture();
    await syncWeather(db, place, '2026-03-02', today);
    expect(urls.map((u) => u.hostname)).toEqual(['api.open-meteo.com']);
  });
});

describe('isPressureDrop', () => {
  it.each([
    [5, false],
    [5.1, true]
  ])('%s hPa counts as a drop: %s', (drop, expected) => {
    expect(isPressureDrop(drop)).toBe(expected);
  });
});

describe('dropToNextDay', () => {
  const day = (key: string, drop: number) => [key, { day: key, pressure: 1000, pressureDrop: drop, tempMax: 10, tempMin: 2, humidity: 70, precipitation: 0, code: 0 }] as const;
  const weather = new Map([day('2026-03-10', 9), day('2026-03-11', 7)]);

  it('gives the fall from the day to the next day', () => {
    expect(dropToNextDay(weather, '2026-03-10')).toBe(7);
  });

  it('is null when the next day is unknown', () => {
    expect(dropToNextDay(weather, '2026-03-11')).toBeNull();
  });
});
