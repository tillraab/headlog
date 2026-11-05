import { db, seed, type Draft, type Drink, type DrinkPreset, type Episode, type Intake, type Medication } from './db';
import { i18n } from './i18n.svelte';
import type { Theme } from './ui.svelte';

export interface Settings {
  waterGoalMl: number;
  limit: number;
  theme: Theme;
}

const DEFAULT_SETTINGS: Settings = { waterGoalMl: 2000, limit: 10, theme: 'system' };

/** All data in memory. A diary stays small, so every write reloads everything. */
export const data = $state({
  ready: false,
  episodes: [] as Episode[],
  intakes: [] as Intake[],
  drinks: [] as Drink[],
  medications: [] as Medication[],
  drinkPresets: [] as DrinkPreset[],
  settings: { ...DEFAULT_SETTINGS } as Settings
});

/** Current time, ticking every 20 seconds so durations stay live. */
export const clock = $state({ now: Date.now() });

export async function load() {
  await seed(db, i18n.lang);
  const [episodes, intakes, drinks, medications, drinkPresets, settingRows] = await Promise.all([
    db.episodes.orderBy('start').toArray(),
    db.intakes.orderBy('time').toArray(),
    db.drinks.orderBy('time').toArray(),
    db.medications.orderBy('order').toArray(),
    db.drinkPresets.orderBy('order').toArray(),
    db.settings.toArray()
  ]);
  const stored = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));
  data.episodes = episodes;
  data.intakes = intakes;
  data.drinks = drinks;
  data.medications = medications;
  data.drinkPresets = drinkPresets;
  data.settings = { ...DEFAULT_SETTINGS, ...(stored.settings as Partial<Settings> | undefined) };
  data.ready = true;
}

export function startClock() {
  const id = setInterval(() => (clock.now = Date.now()), 20000);
  const onVisible = () => (clock.now = Date.now());
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export function ongoingEpisode(): Episode | undefined {
  return data.episodes.find((e) => e.end === null);
}

export async function startHeadache(start = Date.now(), intensity = 5): Promise<number> {
  const id = await db.episodes.add({ start, end: null, intensity, tags: [], note: '' });
  await load();
  return id;
}

export async function saveEpisode(episode: Draft<Episode>) {
  await db.episodes.put($state.snapshot(episode));
  await load();
}

export async function saveIntake(intake: Draft<Intake>) {
  await db.intakes.put($state.snapshot(intake));
  await load();
}

export async function saveDrink(drink: Draft<Drink>) {
  await db.drinks.put($state.snapshot(drink));
  await load();
}

export async function logIntake(med: Medication, time = Date.now()): Promise<number> {
  const id = await db.intakes.add({
    time,
    medId: med.id,
    name: med.name,
    dose: med.dose,
    category: med.category,
    relief: null
  });
  await load();
  return id;
}

export async function logDrink(preset: DrinkPreset, time = Date.now()): Promise<number> {
  const id = await db.drinks.add({
    time,
    presetId: preset.id,
    name: preset.name,
    emoji: preset.emoji,
    ml: preset.ml
  });
  await load();
  return id;
}

type Table = 'episodes' | 'intakes' | 'drinks';

/** Deletes a row and returns a function that restores it. */
export async function remove(table: Table, id: number): Promise<() => Promise<void>> {
  const row = await db.table(table).get(id);
  await db.table(table).delete(id);
  await load();
  return async () => {
    if (row) await db.table(table).put(row);
    await load();
  };
}

export async function saveMedication(med: Draft<Medication>) {
  await db.medications.put($state.snapshot(med));
  await load();
}

export async function saveDrinkPreset(preset: Draft<DrinkPreset>) {
  await db.drinkPresets.put($state.snapshot(preset));
  await load();
}

export async function deleteMedication(id: number) {
  await db.medications.delete(id);
  await load();
}

export async function deleteDrinkPreset(id: number) {
  await db.drinkPresets.delete(id);
  await load();
}

/** Swaps the order of two list entries. */
export async function swapOrder(table: 'medications' | 'drinkPresets', a: { id: number; order: number }, b: { id: number; order: number }) {
  await db.transaction('rw', db[table], async () => {
    await db[table].update(a.id, { order: b.order });
    await db[table].update(b.id, { order: a.order });
  });
  await load();
}

export async function saveSettings(patch: Partial<Settings>) {
  const settings = { ...$state.snapshot(data.settings), ...patch };
  await db.settings.put({ key: 'settings', value: settings });
  await load();
}
