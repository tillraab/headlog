import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackup, wipe } from './backup';
import { db, seed } from './db';
import { contentHash, pull, push, type GistLink } from './gist';

const link: GistLink = { token: 't', gistId: null, lastSync: null, lastHash: null };

/** Fake GitHub gist API that keeps one gist in memory. */
function fakeGitHub(initial: string | null = null) {
  let content = initial;
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push(`${method} ${url.replace('https://api.github.com', '')}`);
    if (method === 'GET' && url.includes('/gists?')) {
      return Response.json(content === null ? [] : [{ id: 'g1', files: { 'headlog-backup.json': {} } }]);
    }
    if (method === 'GET') return Response.json({ id: 'g1', files: { 'headlog-backup.json': { content } } });
    content = JSON.parse(String(init.body)).files['headlog-backup.json'].content;
    return Response.json({ id: 'g1', files: {} });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, content: () => content };
}

beforeEach(async () => {
  await wipe(db);
  await seed(db);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('push', () => {
  it('creates a secret gist when the account has none', async () => {
    const gh = fakeGitHub();
    await push(link);
    expect(gh.calls).toEqual(['GET /gists?per_page=100', 'POST /gists']);
  });

  it('updates the existing gist of the account', async () => {
    const gh = fakeGitHub('{}');
    await push(link);
    expect(gh.calls).toEqual(['GET /gists?per_page=100', 'PATCH /gists/g1']);
  });

  it('skips the upload when nothing changed', async () => {
    const gh = fakeGitHub();
    const first = await push(link);
    await push(first);
    expect(gh.calls).toHaveLength(2);
  });

  it('remembers the gist and the content it uploaded', async () => {
    fakeGitHub();
    const result = await push(link);
    expect([result.gistId, result.lastHash]).toEqual(['g1', contentHash(await createBackup())]);
  });
});

describe('pull', () => {
  it('returns the backup stored in the gist', async () => {
    const backup = await createBackup();
    fakeGitHub(JSON.stringify(backup));
    expect((await pull({ ...link, gistId: 'g1' })).tables.medications).toEqual(backup.tables.medications);
  });

  it('rejects a gist that holds something else', async () => {
    fakeGitHub('{"hello":1}');
    await expect(pull({ ...link, gistId: 'g1' })).rejects.toThrow('Not a HeadLog backup');
  });
});
