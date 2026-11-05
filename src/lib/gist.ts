import { createBackup, isBackup, type Backup } from './backup';

const FILE = 'headlog-backup.json';
const API = 'https://api.github.com';
const STORAGE_KEY = 'headlog.gist';

/** Connection to the gist. Lives in localStorage so it never ends up inside a backup. */
export interface GistLink {
  token: string;
  gistId: string | null;
  lastSync: number | null;
  /** Content of the last upload, to skip uploads without changes. */
  lastHash: string | null;
}

export function readLink(): GistLink | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as GistLink) : null;
}

export function writeLink(link: GistLink | null) {
  if (link) localStorage.setItem(STORAGE_KEY, JSON.stringify(link));
  else localStorage.removeItem(STORAGE_KEY);
}

async function api<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return (await res.json()) as T;
}

interface GistFile {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}

interface Gist {
  id: string;
  files: Record<string, GistFile>;
}

/** Finds an existing HeadLog gist of the token's user. */
export async function findGist(token: string): Promise<string | null> {
  const gists = await api<Gist[]>(token, '/gists?per_page=100');
  return gists.find((g) => FILE in g.files)?.id ?? null;
}

/** Hash of the backup without its timestamp, so unchanged data is not uploaded again. */
export function contentHash(backup: Backup): string {
  const text = JSON.stringify(backup.tables);
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return `${text.length}:${h}`;
}

/** Uploads the current data to the gist, creating a secret gist on first use. Returns the updated link. */
export async function push(link: GistLink, force = false): Promise<GistLink> {
  const backup = await createBackup();
  const hash = contentHash(backup);
  if (!force && link.gistId && hash === link.lastHash) return link;
  const files = { [FILE]: { content: JSON.stringify(backup) } };
  const gistId = link.gistId ?? (await findGist(link.token));
  const gist = gistId
    ? await api<Gist>(link.token, `/gists/${gistId}`, { method: 'PATCH', body: JSON.stringify({ files }) })
    : await api<Gist>(link.token, '/gists', {
        method: 'POST',
        body: JSON.stringify({ description: 'HeadLog backup', public: false, files })
      });
  return { ...link, gistId: gist.id, lastSync: Date.now(), lastHash: hash };
}

/** Reads the backup stored in the gist. */
export async function pull(link: GistLink): Promise<Backup> {
  const gistId = link.gistId ?? (await findGist(link.token));
  if (!gistId) throw new Error('No HeadLog gist found');
  const gist = await api<Gist>(link.token, `/gists/${gistId}`);
  const file = gist.files[FILE];
  const text = file?.truncated && file.raw_url ? await (await fetch(file.raw_url)).text() : file?.content;
  const parsed: unknown = text ? JSON.parse(text) : null;
  if (!isBackup(parsed)) throw new Error('Not a HeadLog backup');
  return parsed;
}
