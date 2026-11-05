import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { format } from 'date-fns';
import { db, type HeadLogDb } from './db';

/** Tables every backup has. */
const TABLES = ['episodes', 'medications', 'intakes', 'drinkPresets', 'drinks', 'settings'] as const;
/** Tables added later; older backups do not have them. */
const OPTIONAL_TABLES = ['sleep'] as const;
const ALL_TABLES = [...TABLES, ...OPTIONAL_TABLES];

export interface Backup {
  app: 'headlog';
  version: 1;
  exportedAt: string;
  tables: Record<(typeof TABLES)[number], unknown[]> & Partial<Record<(typeof OPTIONAL_TABLES)[number], unknown[]>>;
}

export async function createBackup(database: HeadLogDb = db): Promise<Backup> {
  const tables = {} as Backup['tables'];
  for (const name of ALL_TABLES) tables[name] = await database.table(name).toArray();
  return { app: 'headlog', version: 1, exportedAt: new Date().toISOString(), tables };
}

export function isBackup(value: unknown): value is Backup {
  const v = value as Backup;
  return v?.app === 'headlog' && v.version === 1 && TABLES.every((t) => Array.isArray(v.tables?.[t]));
}

/** Replaces all data with the backup. */
export async function restoreBackup(backup: Backup, database: HeadLogDb = db) {
  await database.transaction('rw', ALL_TABLES.map((t) => database.table(t)), async () => {
    for (const name of ALL_TABLES) {
      await database.table(name).clear();
      await database.table(name).bulkAdd(backup.tables[name] ?? []);
    }
  });
}

/** Deletes everything, including stored weather, which backups leave out. */
export async function wipe(database: HeadLogDb = db) {
  await database.transaction('rw', [...ALL_TABLES, 'weather'].map((t) => database.table(t)), async () => {
    for (const name of [...ALL_TABLES, 'weather']) await database.table(name).clear();
  });
}

function csvCell(value: unknown): string {
  const s = String(value ?? '');
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per headache and per intake from `from` on, sorted by time. Readable by Excel and doctors. */
export async function createCsv(database: HeadLogDb = db, from = 0): Promise<string> {
  const episodes = (await database.episodes.toArray()).filter((e) => (e.end ?? Date.now()) >= from);
  const intakes = (await database.intakes.toArray()).filter((i) => i.time >= from);
  const fmt = (t: number | null) => (t === null ? '' : format(t, 'yyyy-MM-dd HH:mm'));
  const rows: [number, string[]][] = [
    ...episodes.map((e): [number, string[]] => [
      e.start,
      ['headache', fmt(e.start), fmt(e.end), e.end ? String(Math.round((e.end - e.start) / 60000)) : '', String(e.intensity), '', '', e.tags.join(' '), e.note]
    ]),
    ...intakes.map((i): [number, string[]] => [
      i.time,
      ['medication', fmt(i.time), '', '', '', `${i.name} ${i.dose}`.trim(), i.category, i.relief === null ? '' : String(i.relief), '']
    ])
  ];
  rows.sort((a, b) => a[0] - b[0]);
  const header = ['type', 'start', 'end', 'minutes', 'intensity', 'medication', 'category', 'tags_or_relief', 'note'];
  return [header, ...rows.map((r) => r[1])].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** Hands a file to the Android share sheet, or downloads it in a browser. */
export async function saveFile(name: string, content: string | Uint8Array, mime: string) {
  if (Capacitor.isNativePlatform()) {
    const { uri } =
      typeof content === 'string'
        ? await Filesystem.writeFile({ path: name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 })
        : await Filesystem.writeFile({ path: name, data: toBase64(content), directory: Directory.Cache });
    await Share.share({ title: name, files: [uri] });
    return;
  }
  const url = URL.createObjectURL(new Blob([content as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
