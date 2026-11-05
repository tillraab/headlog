import Dexie, { type EntityTable } from 'dexie';

export type MedCategory = 'analgesic' | 'triptan' | 'combination' | 'opioid' | 'preventive' | 'other';

/** A headache episode. `end` is null while the headache is ongoing. */
export interface Episode {
  id: number;
  start: number;
  end: number | null;
  /** Peak intensity from 1 (barely noticeable) to 10 (worst imaginable). */
  intensity: number;
  /** Symptom and trigger tags, keys of `TAGS`. */
  tags: string[];
  note: string;
}

export interface Medication {
  id: number;
  name: string;
  dose: string;
  category: MedCategory;
  color: string;
  order: number;
  /** Personal limit: at most `limitDays` days with this medication in any `limitWindow` days (default 30). */
  limitDays?: number;
  limitWindow?: number;
}

/** One intake. Name, dose and category are copied so history survives edits to the list. */
export interface Intake {
  id: number;
  time: number;
  medId: number;
  name: string;
  dose: string;
  category: MedCategory;
  /** Relief rating after the fact: 0 none, 1 some, 2 good. Null when not rated. */
  relief: number | null;
}

export interface DrinkPreset {
  id: number;
  name: string;
  emoji: string;
  ml: number;
  order: number;
}

export interface Drink {
  id: number;
  time: number;
  presetId: number | null;
  name: string;
  emoji: string;
  ml: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

/** A row that may not be stored yet. */
export type Draft<T extends { id: number }> = Omit<T, 'id'> & { id?: number };

export class HeadLogDb extends Dexie {
  episodes!: EntityTable<Episode, 'id'>;
  medications!: EntityTable<Medication, 'id'>;
  intakes!: EntityTable<Intake, 'id'>;
  drinkPresets!: EntityTable<DrinkPreset, 'id'>;
  drinks!: EntityTable<Drink, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'headlog') {
    super(name);
    this.version(1).stores({
      episodes: '++id, start, end',
      medications: '++id, order',
      intakes: '++id, time, medId',
      drinkPresets: '++id, order',
      drinks: '++id, time',
      settings: 'key'
    });
  }
}

/** Categories that count toward medication overuse and the 10/20 rule. */
export const ACUTE_CATEGORIES: readonly MedCategory[] = ['analgesic', 'triptan', 'combination', 'opioid', 'other'];

export const MED_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#3b82f6', '#ec4899', '#14b8a6', '#64748b'];

export const DEFAULT_MEDICATIONS: Omit<Medication, 'id'>[] = [
  { name: 'Ibuprofen', dose: '400 mg', category: 'analgesic', color: MED_COLORS[0], order: 0 },
  { name: 'Paracetamol', dose: '500 mg', category: 'analgesic', color: MED_COLORS[4], order: 1 },
  { name: 'Sumatriptan', dose: '50 mg', category: 'triptan', color: MED_COLORS[2], order: 2 }
];

const DRINK_NAMES = { en: ['Glass', 'Bottle', 'Coffee', 'Tea'], de: ['Glas', 'Flasche', 'Kaffee', 'Tee'] };

export function defaultDrinkPresets(lang: 'en' | 'de'): Omit<DrinkPreset, 'id'>[] {
  const [glass, bottle, coffee, tea] = DRINK_NAMES[lang];
  return [
    { name: glass, emoji: '🥛', ml: 250, order: 0 },
    { name: bottle, emoji: '🍶', ml: 700, order: 1 },
    { name: coffee, emoji: '☕', ml: 200, order: 2 },
    { name: tea, emoji: '🍵', ml: 300, order: 3 }
  ];
}

/** Fills an empty database with the default lists, once. */
export async function seed(db: HeadLogDb, lang: 'en' | 'de' = 'en'): Promise<void> {
  await db.transaction('rw', db.medications, db.drinkPresets, db.settings, async () => {
    if (await db.settings.get('seeded')) return;
    await db.medications.bulkAdd(DEFAULT_MEDICATIONS);
    await db.drinkPresets.bulkAdd(defaultDrinkPresets(lang));
    await db.settings.put({ key: 'seeded', value: true });
  });
}

export const db = new HeadLogDb();
