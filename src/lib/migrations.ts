import type { HeadLogDb } from './db';
import { CAFFEINE } from './drinks';
import { WEATHER_SYNC_KEY } from './weather';

/** A one-time change to stored data. `key` names the flag row in `settings` that marks it as done. */
interface Migration {
  key: string;
  run: (database: HeadLogDb) => Promise<void>;
}

/** Gives the default coffee and tea of older installs their caffeine, including drinks already logged. */
async function caffeineDefaults(database: HeadLogDb) {
  const values: Record<string, number> = { Coffee: CAFFEINE.coffee, Kaffee: CAFFEINE.coffee, Tea: CAFFEINE.tea, Tee: CAFFEINE.tea };
  for (const preset of await database.drinkPresets.toArray()) {
    const mg = values[preset.name];
    if (!mg || preset.caffeineMg !== undefined) continue;
    await database.drinkPresets.update(preset.id, { caffeineMg: mg });
    await database.drinks
      .filter((d) => d.presetId === preset.id)
      .modify((d) => {
        if (d.caffeineMg === undefined) d.caffeineMg = mg;
      });
  }
}

/** Weather stored before the daily-mean pressure drop is fetched again, at the next weather sync. */
async function weatherDailyMeanDrop(database: HeadLogDb) {
  await database.weather.clear();
  if (typeof localStorage !== 'undefined') localStorage.removeItem(WEATHER_SYNC_KEY);
}

/** In the order they run. Append new steps; never rename a key, or the step runs again. */
const MIGRATIONS: Migration[] = [
  { key: 'caffeineDefaults', run: caffeineDefaults },
  { key: 'weatherDailyMeanDrop', run: weatherDailyMeanDrop }
];

/** The flag rows of every step. A database seeded fresh starts with them, since it has nothing to change. */
export function doneFlags(): { key: string; value: true }[] {
  return MIGRATIONS.map((m) => ({ key: m.key, value: true }));
}

/** Runs every step that has not run yet, each in a transaction together with its flag. */
export async function migrate(database: HeadLogDb) {
  for (const migration of MIGRATIONS) {
    if (await database.settings.get(migration.key)) continue;
    await database.transaction('rw', database.drinkPresets, database.drinks, database.weather, database.settings, async () => {
      await migration.run(database);
      await database.settings.put({ key: migration.key, value: true });
    });
  }
}
