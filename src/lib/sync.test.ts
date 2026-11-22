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

const { backupProblem, connect, disconnect, pauseSync, restoreFromGist, setPassphrase, sync, syncNow } = await import('./sync.svelte');

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
    pauseSync('wipe');
    const calls = fakeGitHub('{}');
    await syncNow();
    expect(calls).toEqual([]);
  });

  it('uploads and unpauses on a manual backup', async () => {
    sync.link = linked;
    pauseSync('wipe');
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

describe('setPassphrase', () => {
  /** A gist API where a new gist gets the id g2 and deletes answer 204. */
  function movingGitHub() {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const method = init.method ?? 'GET';
        calls.push(`${method} ${url.replace('https://api.github.com', '')}`);
        if (method === 'DELETE') return new Response(null, { status: 204 });
        return Response.json({ id: 'g2', files: {} });
      })
    );
    return calls;
  }

  it('moves the backup to a new encrypted gist and deletes the old one', async () => {
    const calls = movingGitHub();
    sync.link = linked;
    await setPassphrase('blue kettle');
    expect([calls, sync.link?.gistId, !!sync.link?.passphrase]).toEqual([['POST /gists', 'DELETE /gists/g1'], 'g2', true]);
  });
});


describe('a locked gist', () => {
  it('is never replaced by a manual backup', async () => {
    const calls = fakeGitHub(null);
    sync.link = { ...linked, locked: true };
    await syncNow(true);
    expect(calls).toEqual([]);
  });

  it('is not moved to a new gist by a passphrase', async () => {
    const calls = fakeGitHub(null);
    sync.link = { ...linked, locked: true };
    await setPassphrase('blue kettle');
    expect(calls).toEqual([]);
  });
});

describe('a failing backup', () => {
  it('keeps the error until an upload succeeds', async () => {
    fakeGitHub('{}', 401);
    sync.link = linked;
    await syncNow(true).catch(() => {});
    const failed = sync.link?.lastError;
    fakeGitHub('{}');
    await syncNow(true);
    expect([failed, sync.link?.lastError]).toEqual(['GitHub 401', null]);
  });

  it.each([
    ['GitHub 401', 'no longer accepts the token'],
    ['GitHub 404', 'gist was not found'],
    ['Failed to fetch', 'Failed to fetch']
  ])('explains %s', (error, text) => {
    expect(backupProblem({ ...linked, lastError: error })).toContain(text);
  });
});
