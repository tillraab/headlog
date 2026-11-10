import { db, DRINK_NAMES, seed, type Draft, type Drink, type DrinkPreset, type Episode, type Intake, type Medication, type Night, type Relief, type WeatherDay } from './db';
import { DAY, dayKey, HOUR, MINUTE } from './days';
import { fromPreset } from './drinks';
import { i18n } from './i18n.svelte';
import { fromMedication } from './medication';
import { migrate } from './migrations';
import { cancelReliefCheck, scheduleReliefCheck } from './reminders';
import { DEFAULT_SETTINGS, mergeSettings, type Settings } from './settings';
import { syncNights } from './sleep';
import { syncWeather, WEATHER_SYNC_KEY } from './weather';

/** All data in memory. A diary stays small, so every write reloads everything. */
export const data = $state({
  ready: false,
  episodes: [] as Episode[],
  intakes: [] as Intake[],
  drinks: [] as Drink[],
  medications: [] as Medication[],
  drinkPresets: [] as DrinkPreset[],
  weather: new Map<string, WeatherDay>(),
  sleep: new Map<string, Night>(),
  settings: { ...DEFAULT_SETTINGS } as Settings
});

/** Current time, ticking every 20 seconds so durations stay live. */
export const clock = $state({ now: Date.now() });

export async function load() {
  await seed(db, i18n.lang);
  await migrate(db);
  const [episodes, intakes, drinks, medications, drinkPresets, settingsRow, weather, nights] = await Promise.all([
    db.episodes.orderBy('start').toArray(),
    db.intakes.orderBy('time').toArray(),
    db.drinks.orderBy('time').toArray(),
    db.medications.orderBy('order').toArray(),
    db.drinkPresets.orderBy('order').toArray(),
    db.settings.get('settings'),
    db.weather.toArray(),
    db.sleep.toArray()
  ]);
  data.episodes = episodes;
  data.intakes = intakes;
  data.drinks = drinks;
  data.medications = medications;
  data.drinkPresets = drinkPresets;
  data.weather = new Map(weather.map((w) => [w.day, w]));
  data.sleep = new Map(nights.map((n) => [n.day, n]));
  data.settings = mergeSettings(settingsRow?.value);
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

/** Saves an intake. A rated intake needs no "did it help?" any more; a moved one gets it at the new time. */
export async function saveIntake(intake: Draft<Intake>) {
  const before = intake.id === undefined ? undefined : await db.intakes.get(intake.id);
  const id = await db.intakes.put($state.snapshot(intake));
  if (intake.relief !== null) void cancelReliefCheck(id).catch(() => {});
  else if (before && before.time !== intake.time) void moveReliefCheck({ id, time: intake.time, name: intake.name });
  await load();
}

function moveReliefCheck(intake: { id: number; time: number; name: string }) {
  const delay = data.settings.reliefCheckMinutes;
  return cancelReliefCheck(intake.id)
    .then(() => (delay > 0 ? scheduleReliefCheck(intake, delay) : undefined))
    .catch(() => {});
}

export async function saveDrink(drink: Draft<Drink>) {
  await db.drinks.put($state.snapshot(drink));
  await load();
}

export async function logIntake(med: Medication, time = Date.now()): Promise<number> {
  const id = await db.intakes.add({ time, ...fromMedication(med), relief: null });
  const delay = data.settings.reliefCheckMinutes;
  if (delay > 0) void scheduleReliefCheck({ id, time, name: med.name }, delay).catch(() => {});
  await load();
  return id;
}

export async function logDrink(preset: DrinkPreset, time = Date.now()): Promise<number> {
  const id = await db.drinks.add({ time, ...fromPreset(preset) });
  await load();
  return id;
}

/** The tables of entries that can be deleted with an undo. */
export type EntryTable = 'episodes' | 'intakes' | 'drinks';

/** Deletes a row and returns a function that restores it. */
export async function remove(table: EntryTable, id: number): Promise<() => Promise<void>> {
  const row = await db.table(table).get(id);
  await db.table(table).delete(id);
  if (table === 'intakes') void cancelReliefCheck(id).catch(() => {});
  await load();
  return async () => {
    if (row) await db.table(table).put(row);
    await load();
  };
}

/** Ends an ongoing episode now, from a notification. */
export async function endEpisode(id: number) {
  const ep = await db.episodes.get(id);
  if (ep && ep.end === null) await db.episodes.update(id, { end: Date.now() });
  await load();
}

/**
 * Stores an answer given in a notification. With `time`, the answer only counts while the intake still
 * has that time: after a restore or an edit, the id can belong to a different intake.
 */
export async function setRelief(intakeId: number, relief: Relief, time?: number) {
  const intake = await db.intakes.get(intakeId);
  if (!intake || (time !== undefined && intake.time !== time)) return;
  await db.intakes.update(intakeId, { relief });
  await load();
}

export async function saveMedication(med: Draft<Medication>) {
  await db.medications.put($state.snapshot(med));
  await load();
}

export async function saveDrinkPreset(preset: Draft<DrinkPreset>) {
  await db.drinkPresets.put($state.snapshot(preset));
  await load();
}

/** Changes only the given fields, so two quick edits in a row cannot undo each other. */
export async function updateMedication(id: number, patch: Partial<Medication>) {
  await db.medications.update(id, $state.snapshot(patch));
  await load();
}

/** Changes only the given fields, so two quick edits in a row cannot undo each other. */
export async function updateDrinkPreset(id: number, patch: Partial<DrinkPreset>) {
  await db.drinkPresets.update(id, $state.snapshot(patch));
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

const WEATHER_SYNC_HOURS = 3;
/** Weather is fetched from the first entry on, and at least for this many days back. */
const WEATHER_BACKFILL_DAYS = 30;

/** Fetches missing and recent weather, at most every few hours unless `force`. */
export async function updateWeather(force = false) {
  const { enabled, place } = data.settings.weather;
  if (!enabled || !place) return;
  const last = Number(localStorage.getItem(WEATHER_SYNC_KEY) ?? 0);
  // The evening warning needs the forecast for the day after tomorrow, so its absence forces a sync.
  const ahead = data.weather.has(dayKey(Date.now() + 2 * DAY));
  if (!force && ahead && Date.now() - last < WEATHER_SYNC_HOURS * HOUR) return;
  const times = [...data.episodes.map((e) => e.start), ...data.intakes.map((i) => i.time), ...data.drinks.map((d) => d.time)];
  const first = dayKey(Math.min(Date.now() - WEATHER_BACKFILL_DAYS * DAY, ...times));
  await syncWeather(db, $state.snapshot(place), first);
  localStorage.setItem(WEATHER_SYNC_KEY, String(Date.now()));
  data.weather = new Map((await db.weather.toArray()).map((w) => [w.day, w]));
}

/** Estimates the last nights from screen activity, when switched on and allowed. */
export async function updateSleep() {
  if (!data.settings.sleep.enabled) return;
  await syncNights(db, undefined, undefined, data.settings.sleep.fallAsleepMinutes * MINUTE);
  data.sleep = new Map((await db.sleep.toArray()).map((n) => [n.day, n]));
}

export async function saveNight(night: Night) {
  await db.sleep.put($state.snapshot(night));
  await load();
}

/** Keeps the night ending on `day` as estimated, so it is no longer estimated again. */
export async function confirmNight(day: string) {
  await updateSleep();
  const night = data.sleep.get(day);
  if (night && night.source !== 'manual') await saveNight({ ...night, source: 'manual' });
}

/** Renames the default drinks into `lang`. Names the user chose stay as they are. */
export async function translateDrinkNames(lang: 'en' | 'de') {
  const lists = Object.values(DRINK_NAMES);
  await db.transaction('rw', db.drinkPresets, async () => {
    for (const preset of await db.drinkPresets.toArray()) {
      const index = lists.map((names) => names.indexOf(preset.name)).find((i) => i >= 0);
      if (index !== undefined && DRINK_NAMES[lang][index] !== preset.name) await db.drinkPresets.update(preset.id, { name: DRINK_NAMES[lang][index] });
    }
  });
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
  const settings = $state.snapshot({ ...data.settings, ...patch });
  await db.settings.put({ key: 'settings', value: settings });
  await load();
}
