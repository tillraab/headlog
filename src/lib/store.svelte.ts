import { CAFFEINE, fromPreset } from './drinks';
import { fromMedication } from './medication';
import { db, DRINK_NAMES, seed, type Draft, type Drink, type DrinkPreset, type Episode, type Intake, type Medication, type Night, type Relief, type WeatherDay } from './db';
import { DAY, dayKey, HOUR } from './days';
import { i18n } from './i18n.svelte';
import { edit } from './editor.svelte';
import { defaultNight, syncNights } from './sleep';
import { syncWeather, type Place } from './weather';
import { cancelReliefCheck, scheduleReliefCheck, type DrinkReminderSettings } from './reminders';
import type { Theme } from './ui.svelte';

export interface Settings {
  waterGoalMl: number;
  limit: number;
  theme: Theme;
  /** Name printed on the doctor report. */
  reportName: string;
  /** Water reminders: half the goal by `noon`, the full goal by `evening` (hours of the day). */
  reminders: { enabled: boolean; noon: number; evening: number };
  /** Minutes after an intake to ask whether it helped, 0 for off. */
  reliefCheckMinutes: number;
  /** Hours between "still a headache?" notifications, 0 for off. */
  headacheCheckHours: number;
  /** "What did you drink?" notifications at fixed times. */
  drinkReminder: DrinkReminderSettings;
  /** Daily weather for the home town. */
  weather: { enabled: boolean; place: Place | null };
  /** Estimate sleep from screen activity. */
  sleep: { enabled: boolean };
  /** Morning notification asking whether last night's times are right. */
  sleepCheck: { enabled: boolean; hour: number };
  /** Evening notification when a headache is more likely tomorrow. */
  riskAlert: { enabled: boolean; hour: number };
}

const DEFAULT_SETTINGS: Settings = {
  waterGoalMl: 2000,
  limit: 10,
  theme: 'system',
  reportName: '',
  reminders: { enabled: false, noon: 12, evening: 18 },
  reliefCheckMinutes: 60,
  headacheCheckHours: 3,
  drinkReminder: { enabled: false, from: 8, to: 20, everyHours: 2 },
  weather: { enabled: false, place: null },
  sleep: { enabled: false },
  sleepCheck: { enabled: true, hour: 9 },
  riskAlert: { enabled: true, hour: 20 }
};

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

/** Gives the default coffee and tea of older installs their caffeine, including drinks already logged. */
async function addCaffeineDefaults() {
  if (await db.settings.get('caffeineDefaults')) return;
  const values: Record<string, number> = { Coffee: CAFFEINE.coffee, Kaffee: CAFFEINE.coffee, Tea: CAFFEINE.tea, Tee: CAFFEINE.tea };
  await db.transaction('rw', db.drinkPresets, db.drinks, db.settings, async () => {
    for (const preset of await db.drinkPresets.toArray()) {
      const mg = values[preset.name];
      if (!mg || preset.caffeineMg !== undefined) continue;
      await db.drinkPresets.update(preset.id, { caffeineMg: mg });
      await db.drinks.filter((d) => d.presetId === preset.id).modify((d) => {
        if (d.caffeineMg === undefined) d.caffeineMg = mg;
      });
    }
    await db.settings.put({ key: 'caffeineDefaults', value: true });
  });
}

export async function load() {
  await seed(db, i18n.lang);
  await addCaffeineDefaults();
  const [episodes, intakes, drinks, medications, drinkPresets, settingRows, weather, nights] = await Promise.all([
    db.episodes.orderBy('start').toArray(),
    db.intakes.orderBy('time').toArray(),
    db.drinks.orderBy('time').toArray(),
    db.medications.orderBy('order').toArray(),
    db.drinkPresets.orderBy('order').toArray(),
    db.settings.toArray(),
    db.weather.toArray(),
    db.sleep.toArray()
  ]);
  const stored = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));
  data.episodes = episodes;
  data.intakes = intakes;
  data.drinks = drinks;
  data.medications = medications;
  data.drinkPresets = drinkPresets;
  data.weather = new Map(weather.map((w) => [w.day, w]));
  data.sleep = new Map(nights.map((n) => [n.day, n]));
  const { reliefCheck, drinkCheckins, ...saved } = (stored.settings ?? {}) as Partial<Settings> & {
    reliefCheck?: boolean;
    drinkCheckins?: { enabled: boolean };
  };
  // Drink check-ins at fixed times became the drink reminder; whoever had them on keeps a reminder.
  const drinkReminder = !saved.drinkReminder && drinkCheckins?.enabled ? { drinkReminder: { ...DEFAULT_SETTINGS.drinkReminder, enabled: true } } : {};
  data.settings = { ...DEFAULT_SETTINGS, ...(reliefCheck === false ? { reliefCheckMinutes: 0 } : {}), ...drinkReminder, ...saved };
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
  const id = await db.intakes.put($state.snapshot(intake));
  if (intake.relief !== null) void cancelReliefCheck(id).catch(() => {});
  await load();
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

type Table = 'episodes' | 'intakes' | 'drinks';

/** Deletes a row and returns a function that restores it. */
export async function remove(table: Table, id: number): Promise<() => Promise<void>> {
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

/** Stores an answer given in a notification. */
export async function setRelief(intakeId: number, relief: Relief) {
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

const WEATHER_SYNC_KEY = 'headlog.weatherSync';
const WEATHER_SYNC_HOURS = 3;
/** Weather is fetched from the first entry on, and at least for this many days back. */
const WEATHER_BACKFILL_DAYS = 30;
const WEATHER_METRIC = 'weatherDailyMeanDrop';

/** Fetches missing and recent weather, at most every few hours unless `force`. */
export async function updateWeather(force = false) {
  const { enabled, place } = data.settings.weather;
  if (!enabled || !place) return;
  // Weather stored before the daily-mean pressure drop is fetched again once.
  if (!(await db.settings.get(WEATHER_METRIC))) {
    await db.weather.clear();
    await db.settings.put({ key: WEATHER_METRIC, value: true });
    force = true;
  }
  const last = Number(localStorage.getItem(WEATHER_SYNC_KEY) ?? 0);
  if (!force && Date.now() - last < WEATHER_SYNC_HOURS * HOUR) return;
  const times = [...data.episodes.map((e) => e.start), ...data.intakes.map((i) => i.time), ...data.drinks.map((d) => d.time)];
  const first = dayKey(Math.min(Date.now() - WEATHER_BACKFILL_DAYS * DAY, ...times));
  await syncWeather(db, $state.snapshot(place), first);
  localStorage.setItem(WEATHER_SYNC_KEY, String(Date.now()));
  data.weather = new Map((await db.weather.toArray()).map((w) => [w.day, w]));
}

/** Estimates the last nights from screen activity, when switched on and allowed. */
export async function updateSleep() {
  if (!data.settings.sleep.enabled) return;
  await syncNights(db);
  data.sleep = new Map((await db.sleep.toArray()).map((n) => [n.day, n]));
}

export async function saveNight(night: Night) {
  await db.sleep.put($state.snapshot(night));
  await load();
}

/** Opens the sleep editor for the night ending on `day`, starting from 23:00–7:00 when nothing is known. */
export async function openNight(day: string) {
  await updateSleep();
  edit({ kind: 'sleep', item: data.sleep.get(day) ?? defaultNight(day) });
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
