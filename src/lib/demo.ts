import { addDays, addMinutes, startOfDay } from 'date-fns';
import { wipe } from './backup';
import { db, fromPreset, seed, type Drink, type DrinkPreset, type Episode, type HeadLogDb, type Intake, type Night, type WeatherDay } from './db';
import { dayKey } from './days';

/** Seeded pseudo-random numbers, so the demo looks the same each time. */
function random(seedValue: number) {
  let s = seedValue;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const DAYS = 90;

const WINE = { en: 'Wine', de: 'Wein' };
const NOTES = {
  en: ['Long meeting without a break', 'Started behind the eyes', 'Better after a walk'],
  de: ['Lange Besprechung ohne Pause', 'Fing hinter den Augen an', 'Nach einem Spaziergang besser']
};

/**
 * Replaces all data with 90 plausible days that show every part of the app: headaches linked to
 * pressure drops, short nights, little to drink and wine, medication with ratings and a personal
 * limit, caffeine, sleep with wake breaks, a hydration streak, an open "did it help?" question,
 * and a pressure drop forecast for tomorrow with a short night today, so the risk warnings show.
 */
export async function loadDemo(today = Date.now(), database: HeadLogDb = db, lang: 'en' | 'de' = 'en') {
  await wipe(database);
  await seed(database, lang);
  const meds = await database.medications.orderBy('order').toArray();
  const triptan = meds.find((m) => m.category === 'triptan')!;
  await database.medications.update(triptan.id, { limitDays: 4, limitWindow: 30 });
  const wineId = await database.drinkPresets.add({ name: WINE[lang], emoji: '🍷', ml: 150, order: 4, alcohol: true });
  const presets = await database.drinkPresets.orderBy('order').toArray();
  const [glass, bottle, coffee, tea] = presets;
  const wine = presets.find((p) => p.id === wineId)!;

  const rnd = random(42);
  const episodes: Omit<Episode, 'id'>[] = [];
  const intakes: Omit<Intake, 'id'>[] = [];
  const drinks: Omit<Drink, 'id'>[] = [];
  const nights: Night[] = [];
  const weather: WeatherDay[] = [];
  const tagPool = ['stress', 'sleep', 'screen', 'light', 'nausea', 'weather', 'meal'];
  let pressure = 1016;
  let lowWaterYesterday = false;
  let wineYesterday = false;

  const drink = (preset: DrinkPreset, time: number) => {
    if (time <= today) drinks.push({ time, ...fromPreset(preset) });
  };

  for (let i = DAYS - 1; i >= -1; i--) {
    const day = startOfDay(addDays(today, -i));
    const key = dayKey(day);
    const isToday = i === 0;
    const isTomorrow = i === -1;

    // A front passes now and then: pressure falls for a day, then recovers. Tomorrow always brings one.
    const front = isTomorrow || (!isToday && rnd() < 0.12);
    const before = pressure;
    pressure = front ? pressure - 7 - rnd() * 5 : pressure + (1016 - pressure) * 0.3 + (rnd() - 0.5) * 4;
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
    if (isTomorrow) break;

    // The night ending this morning: short now and then, last night always. Sometimes a child wakes you.
    const shortNight = isToday || rnd() < 0.25;
    const asleep = addMinutes(day, -90 + Math.floor(rnd() * 120)).getTime();
    const hours = shortNight ? 4.6 + rnd() * 1.1 : 6.8 + rnd() * 1.6;
    const wake = Math.min(asleep + hours * 3600000, today);
    const breaks = rnd() < 0.2 ? [{ start: asleep + 3 * 3600000, end: asleep + 3 * 3600000 + (10 + Math.floor(rnd() * 30)) * 60000 }] : [];
    const awake = breaks.reduce((sum, b) => sum + b.end - b.start, 0);
    if (wake > asleep + awake) nights.push({ day: key, start: asleep, end: wake, asleepMs: wake - asleep - awake, breaks, source: 'manual' });

    // Drinks: the four days before today reach the goal for a streak; today is still under way.
    const streakDay = i >= 1 && i <= 4;
    const lowWater = !streakDay && rnd() < 0.3;
    const at = (minutes: number) => addMinutes(day, minutes).getTime();
    drink(coffee, at(7 * 60 + 30));
    if (rnd() < 0.6) drink(coffee, at(13 * 60 + Math.floor(rnd() * 60)));
    if (rnd() < 0.4) drink(tea, at(16 * 60));
    const glasses = streakDay ? 6 : lowWater ? 1 + Math.floor(rnd() * 2) : 4 + Math.floor(rnd() * 3);
    for (let g = 0; g < glasses; g++) drink(rnd() < 0.3 ? bottle : glass, at(9 * 60 + Math.floor(rnd() * 12 * 60)));
    if (streakDay) drink(bottle, at(12 * 60));
    const hasWine = !isToday && rnd() < 0.12;
    if (hasWine) drink(wine, at(20 * 60));

    const risk = 0.04 + (lowWaterYesterday ? 0.2 : 0) + (shortNight ? 0.35 : 0) + (front ? 0.3 : 0) + (wineYesterday ? 0.3 : 0);
    lowWaterYesterday = lowWater;
    wineYesterday = hasWine;
    if (isToday || rnd() > risk) continue;

    const start = at(8 * 60 + Math.floor(rnd() * 12 * 60));
    const intensity = 2 + Math.floor(rnd() * 8);
    const end = start + (60 + Math.floor(rnd() * 8 * 60)) * 60000;
    const tags = tagPool.filter(() => rnd() < 0.2);
    const note = rnd() < 0.15 ? NOTES[lang][Math.floor(rnd() * NOTES[lang].length)] : '';
    episodes.push({ start, end, intensity, tags, note });
    if (intensity >= 4 && rnd() < 0.8) {
      const med = intensity >= 7 ? triptan : meds[Math.floor(rnd() * 2)];
      intakes.push({ time: start + Math.floor(rnd() * 90) * 60000, medId: med.id, name: med.name, dose: med.dose, category: med.category, relief: Math.floor(rnd() * 3) });
    }
  }

  // An intake two hours ago, not rated yet, so Today asks whether it helped.
  const recent = today - 2 * 3600000;
  if (dayKey(recent) === dayKey(today)) {
    const med = meds[0];
    intakes.push({ time: recent, medId: med.id, name: med.name, dose: med.dose, category: med.category, relief: null });
  }

  await database.episodes.bulkAdd(episodes);
  await database.intakes.bulkAdd(intakes);
  await database.drinks.bulkAdd(drinks);
  await database.sleep.bulkPut(nights);
  await database.weather.bulkPut(weather);
}
