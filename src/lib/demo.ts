import { addDays, addMinutes, startOfDay } from 'date-fns';
import { db, fromPreset, seed, type Drink, type Episode, type HeadLogDb, type Intake, type Night, type WeatherDay } from './db';
import { dayKey } from './days';
import { wipe } from './backup';

/** Seeded pseudo-random numbers, so the demo looks the same each time. */
function random(seedValue: number) {
  let s = seedValue;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Replaces all data with 90 plausible days, including sleep and weather, for trying the app out. */
export async function loadDemo(today = Date.now(), database: HeadLogDb = db, lang: 'en' | 'de' = 'en') {
  await wipe(database);
  await seed(database, lang);
  const meds = await database.medications.orderBy('order').toArray();
  const presets = await database.drinkPresets.orderBy('order').toArray();
  const rnd = random(42);
  const episodes: Omit<Episode, 'id'>[] = [];
  const intakes: Omit<Intake, 'id'>[] = [];
  const drinks: Omit<Drink, 'id'>[] = [];
  const nights: Night[] = [];
  const weather: WeatherDay[] = [];
  const tagPool = ['stress', 'sleep', 'screen', 'light', 'nausea', 'weather', 'meal'];
  let pressure = 1016;
  let lowWaterYesterday = false;

  for (let i = 89; i >= 0; i--) {
    const day = startOfDay(addDays(today, -i));
    const key = dayKey(day);

    // A front passes now and then: pressure falls for a day, then recovers.
    const front = rnd() < 0.12;
    const before = pressure;
    pressure = front ? pressure - 6 - rnd() * 6 : pressure + (1016 - pressure) * 0.3 + (rnd() - 0.5) * 4;
    weather.push({
      day: key,
      pressure: Math.round(pressure * 10) / 10,
      pressureDrop: Math.max(0, Math.round((before - pressure) * 10) / 10),
      tempMax: Math.round(8 + rnd() * 10),
      tempMin: Math.round(rnd() * 6),
      humidity: Math.round(60 + rnd() * 35),
      precipitation: front ? Math.round(rnd() * 80) / 10 : 0,
      code: front ? 61 : rnd() < 0.5 ? 2 : 0
    });

    // The night ending this morning: short now and then, sometimes with a wake break.
    const shortNight = rnd() < 0.25;
    const asleep = addMinutes(day, -90 + Math.floor(rnd() * 120)).getTime();
    const hours = shortNight ? 4.5 + rnd() * 1.2 : 6.8 + rnd() * 1.6;
    const wake = asleep + hours * 3600000;
    const breaks = rnd() < 0.2 ? [{ start: asleep + 3 * 3600000, end: asleep + 3 * 3600000 + (10 + Math.floor(rnd() * 30)) * 60000 }] : [];
    if (wake <= today) {
      const awake = breaks.reduce((sum, b) => sum + b.end - b.start, 0);
      nights.push({ day: key, start: asleep, end: wake, asleepMs: wake - asleep - awake, breaks, source: 'screen' });
    }

    const lowWater = rnd() < 0.3;
    const glasses = lowWater ? 2 + Math.floor(rnd() * 3) : 5 + Math.floor(rnd() * 4);
    for (let g = 0; g < glasses; g++) {
      const p = presets[Math.floor(rnd() * presets.length)];
      const time = addMinutes(day, 7 * 60 + Math.floor(rnd() * 14 * 60)).getTime();
      if (time <= today) drinks.push({ time, ...fromPreset(p) });
    }

    const risk = 0.06 + (lowWaterYesterday ? 0.22 : 0) + (shortNight ? 0.2 : 0) + (front ? 0.3 : 0);
    lowWaterYesterday = lowWater;
    if (i === 0 || rnd() > risk) continue;
    const start = addMinutes(day, 8 * 60 + Math.floor(rnd() * 12 * 60)).getTime();
    if (start > today) continue;
    const intensity = 2 + Math.floor(rnd() * 8);
    const end = start + (60 + Math.floor(rnd() * 8 * 60)) * 60000;
    const tags = tagPool.filter(() => rnd() < 0.2);
    episodes.push({ start, end, intensity, tags, note: '' });
    if (intensity >= 4 && rnd() < 0.8) {
      const med = intensity >= 7 ? meds[2] : meds[Math.floor(rnd() * 2)];
      intakes.push({
        time: start + Math.floor(rnd() * 90) * 60000,
        medId: med.id,
        name: med.name,
        dose: med.dose,
        category: med.category,
        relief: Math.floor(rnd() * 3)
      });
    }
  }
  await database.episodes.bulkAdd(episodes);
  await database.intakes.bulkAdd(intakes);
  await database.drinks.bulkAdd(drinks);
  await database.sleep.bulkPut(nights);
  await database.weather.bulkPut(weather);
}
