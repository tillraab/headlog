import type { DrinkReminderSettings, ReminderSettings } from './reminders';
import type { FactorKey } from './prognosis';
import type { Place } from './weather';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  waterGoalMl: number;
  limit: number;
  theme: Theme;
  /** Name printed on the doctor report. */
  reportName: string;
  /** Water reminders: half the goal by `noon`, the full goal by `evening` (hours of the day). */
  reminders: ReminderSettings;
  /** Minutes after an intake to ask whether it helped, 0 for off. */
  reliefCheckMinutes: number;
  /** Hours between "still a headache?" notifications, 0 for off. */
  headacheCheckHours: number;
  /** "Don't forget to drink" after some hours without a logged drink, inside a daily window. */
  drinkReminder: DrinkReminderSettings;
  /** Daily weather for the home town. */
  weather: { enabled: boolean; place: Place | null };
  /** Estimate sleep from screen activity; falling asleep is assumed to take `fallAsleepMinutes` after the screen goes off. */
  sleep: { enabled: boolean; fallAsleepMinutes: number };
  /** Morning notification asking whether last night's times are right. */
  sleepCheck: { enabled: boolean; hour: number };
  /** Evening notification when a headache is more likely tomorrow. */
  riskAlert: { enabled: boolean; hour: number };
  /** What the calendar marks: headaches, medication, and days on which each factor was unfavourable. */
  calendar: Record<'headache' | 'medication' | FactorKey, boolean>;
}

export const DEFAULT_SETTINGS: Settings = {
  waterGoalMl: 2000,
  limit: 10,
  theme: 'system',
  reportName: '',
  reminders: { enabled: false, noon: 12, evening: 18 },
  reliefCheckMinutes: 60,
  headacheCheckHours: 3,
  drinkReminder: { enabled: false, from: 8, to: 20, everyHours: 2 },
  weather: { enabled: false, place: null },
  sleep: { enabled: false, fallAsleepMinutes: 15 },
  sleepCheck: { enabled: true, hour: 9 },
  riskAlert: { enabled: true, hour: 20 },
  calendar: { headache: true, medication: true, weather: false, sleep: false, hydration: false, caffeine: false, alcohol: false }
};

/** Settings as stored by older versions, with fields that were renamed since. */
type StoredSettings = Partial<Settings> & {
  /** Became `reliefCheckMinutes`; false is 0. */
  reliefCheck?: boolean;
  /** Drink check-ins at fixed times became the drink reminder. */
  drinkCheckins?: { enabled: boolean };
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The settings to use from what is stored: the defaults, with the stored values on top. Settings that
 * are objects are merged one level deep, so a field added to one later gets its default. Renamed
 * settings are carried over.
 */
export function mergeSettings(stored: unknown): Settings {
  const { reliefCheck, drinkCheckins, ...saved } = (isObject(stored) ? stored : {}) as StoredSettings;
  const renamed: Partial<Settings> = {};
  if (reliefCheck === false) renamed.reliefCheckMinutes = 0;
  // Whoever had drink check-ins on keeps a drink reminder.
  if (!saved.drinkReminder && drinkCheckins?.enabled) renamed.drinkReminder = { ...DEFAULT_SETTINGS.drinkReminder, enabled: true };
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS, ...renamed, ...saved };
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (isObject(value)) merged[key] = { ...value, ...(isObject(merged[key]) ? merged[key] : {}) };
  }
  return merged as unknown as Settings;
}
