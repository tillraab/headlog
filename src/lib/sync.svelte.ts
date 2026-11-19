import { restoreBackup } from './backup';
import { PassphraseError } from './crypto';
import { deleteGist, findGist, pull, push, readLink, writeLink, type GistLink } from './gist';

/** `locked`: the gist holds an encrypted backup this phone has no working passphrase for. */
export const sync = $state<{ link: GistLink | null; busy: boolean; error: string; locked: boolean }>({
  link: typeof localStorage !== 'undefined' ? readLink() : null,
  busy: false,
  error: '',
  locked: false
});

async function run(task: () => Promise<void>) {
  if (sync.busy) return;
  sync.busy = true;
  sync.error = '';
  try {
    await task();
  } catch (e) {
    sync.error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    sync.busy = false;
  }
}

function save(link: GistLink | null) {
  sync.link = link;
  writeLink(link);
}

/**
 * Links the token. Returns true when the account already has a HeadLog gist, so the caller can
 * offer to restore it before the next upload overwrites it.
 */
export async function connect(token: string): Promise<boolean> {
  let existing = false;
  await run(async () => {
    const gistId = await findGist(token);
    existing = gistId !== null;
    const link = { token, gistId, lastSync: null, lastHash: null };
    save(existing ? link : await push(link, true));
  });
  return existing;
}

export function disconnect() {
  sync.locked = false;
  save(null);
}

export async function syncNow(force = false) {
  const link = sync.link;
  if (!link) return;
  await run(async () => {
    const result = await push(link, force);
    save(force ? { ...result, paused: false } : result);
  });
}

/** Stops automatic uploads, so deleted or demo data does not overwrite the backup. */
export function pauseSync() {
  if (sync.link) save({ ...sync.link, paused: true });
}

/** Uploads changes quietly, for app start and when the app goes to the background. */
export function syncQuietly() {
  syncNow().catch(() => {});
}

/**
 * Restores the current backup, or an earlier `version` of it. A `passphrase` that opens an encrypted backup is kept
 * for the next uploads.
 */
export async function restoreFromGist(version?: string, passphrase?: string) {
  const link = sync.link;
  if (!link) return;
  await run(async () => {
    try {
      await restoreBackup(await pull(link, version, passphrase ?? link.passphrase));
    } catch (e) {
      if (e instanceof PassphraseError) {
        sync.locked = true;
        // No upload may replace the encrypted backup before it is opened.
        save({ ...link, paused: true });
      }
      throw e;
    }
    sync.locked = false;
    save({ ...link, lastHash: null, paused: false, ...(passphrase ? { passphrase, salt: undefined } : {}) });
  });
}

/**
 * Sets, changes or removes (null) the passphrase. The backup moves to a new gist and the old one is deleted, so no
 * earlier version stays readable without the passphrase or needs an old one.
 */
export async function setPassphrase(passphrase: string | null) {
  const link = sync.link;
  if (!link) return;
  await run(async () => {
    const moved = await push({ ...link, passphrase, salt: undefined, paused: false }, true, true);
    if (link.gistId && link.gistId !== moved.gistId) await deleteGist(link.token, link.gistId);
    save(moved);
  });
}
