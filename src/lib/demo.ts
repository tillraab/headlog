import { addDays, addMinutes, startOfDay } from 'date-fns';
import { db, fromPreset, seed, type Drink, type Episode, type Intake, type HeadLogDb } from './db';
import { wipe } from './backup';

/** Seeded pseudo-random numbers, so the demo looks the same each time. */
function random(seedValue: number) {
  let s = seedValue;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Replaces all data with 90 plausible days, for trying the app out. */
export async function loadDemo(today = Date.now(), database: HeadLogDb = db, lang: 'en' | 'de' = 'en') {
  await wipe(database);
  await seed(database, lang);
  const meds = await database.medications.orderBy('order').toArray();
  const presets = await database.drinkPresets.orderBy('order').toArray();
  const rnd = random(42);
  const episodes: Omit<Episode, 'id'>[] = [];
  const intakes: Omit<Intake, 'id'>[] = [];
  const drinks: Omit<Drink, 'id'>[] = [];
  const tagPool = ['stress', 'sleep', 'screen', 'light', 'nausea', 'weather', 'meal'];

  for (let i = 89; i >= 0; i--) {
    const day = startOfDay(addDays(today, -i));
    const lowWater = rnd() < 0.3;
    const glasses = lowWater ? 2 + Math.floor(rnd() * 3) : 5 + Math.floor(rnd() * 4);
    for (let g = 0; g < glasses; g++) {
      const p = presets[Math.floor(rnd() * presets.length)];
      const time = addMinutes(day, 7 * 60 + Math.floor(rnd() * 14 * 60)).getTime();
      if (time <= today) drinks.push({ time, ...fromPreset(p) });
    }
    if (i === 0 || rnd() > (lowWater ? 0.45 : 0.18)) continue;
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
}
