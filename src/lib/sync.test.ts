import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackup, wipe } from './backup';
import { db, seed } from './db';

/** localStorage of the WebView, where the Gist link lives. Stubbed before the module reads it. */
const storage = new Map<string, string>();
const fakeStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key)
};
vi.stubGlobal('localStorage', fakeStorage);

const { connect, disconnect, pauseSync, restoreFromGist, sync, syncNow } = await import('./sync.svelte');

/** Fake GitHub gist API that keeps one gist in memory. `status` makes every call fail with it. */
function fakeGitHub(content: string | null, status = 200) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      calls.push(`${method} ${url.replace('https://api.github.com', '')}`);
      if (status !== 200) return new Response('', { status });
      if (method === 'GET' && url.includes('/gists?')) return Response.json(content === null ? [] : [{ id: 'g1', files: { 'headlog-backup.json': {} } }]);
      if (method === 'GET') return Response.json({ id: 'g1', files: { 'headlog-backup.json': { content } } });
      return Response.json({ id: 'g1', files: {} });
    })
  );
  return calls;
}

const linked = { token: 't', gistId: 'g1', lastSync: null, lastHash: null };

beforeEach(async () => {
  disconnect();
  sync.error = '';
  await wipe(db);
  await seed(db);
  await db.episodes.add({ start: 1, end: 2, intensity: 5, tags: [], note: '' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal('localStorage', fakeStorage);
});

describe('connect', () => {
  it('uploads nothing to an account that already has a backup, and says so', async () => {
    const calls = fakeGitHub('{}');
    const existing = await connect('t');
    expect([existing, calls]).toEqual([true, ['GET /gists?per_page=100']]);
  });

  it('creates a gist for an account without one', async () => {
    const calls = fakeGitHub(null);
    await connect('t');
    expect([calls.at(-1), sync.link?.gistId]).toEqual(['POST /gists', 'g1']);
  });

  it('keeps the link in localStorage', async () => {
    fakeGitHub(null);
    await connect('t');
    expect(JSON.parse(storage.get('headlog.gist')!).token).toBe('t');
  });
});

describe('syncNow', () => {
  it('uploads nothing while paused', async () => {
    sync.link = linked;
    pauseSync();
    const calls = fakeGitHub('{}');
    await syncNow();
    expect(calls).toEqual([]);
  });

  it('uploads and unpauses on a manual backup', async () => {
    sync.link = linked;
    pauseSync();
    const calls = fakeGitHub('{}');
    await syncNow(true);
    expect([calls, sync.link?.paused]).toEqual([['PATCH /gists/g1'], false]);
  });

  it('does not start a second upload while one is running', async () => {
    sync.link = linked;
    const calls = fakeGitHub('{}');
    await Promise.all([syncNow(), syncNow()]);
    expect(calls).toEqual(['PATCH /gists/g1']);
  });

  it('shows the error of a rejected token and is no longer busy', async () => {
    sync.link = linked;
    fakeGitHub('{}', 401);
    await syncNow().catch(() => {});
    expect([sync.error, sync.busy]).toEqual(['GitHub 401', false]);
  });
});

describe('restoreFromGist', () => {
  it('forgets the last upload and resumes automatic uploads', async () => {
    const backup = await createBackup();
    sync.link = { ...linked, lastHash: 'old', paused: true };
    fakeGitHub(JSON.stringify(backup));
    await restoreFromGist();
    expect([sync.link?.lastHash, sync.link?.paused]).toEqual([null, false]);
  });
});
