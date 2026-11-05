import { restoreBackup } from './backup';
import { findGist, pull, push, readLink, writeLink, type GistLink } from './gist';

export const sync = $state<{ link: GistLink | null; busy: boolean; error: string }>({
  link: typeof localStorage !== 'undefined' ? readLink() : null,
  busy: false,
  error: ''
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
  save(null);
}

export async function syncNow(force = false) {
  const link = sync.link;
  if (!link) return;
  await run(async () => save(await push(link, force)));
}

/** Uploads changes quietly, for app start and when the app goes to the background. */
export function syncQuietly() {
  syncNow().catch(() => {});
}

export async function restoreFromGist() {
  const link = sync.link;
  if (!link) return;
  await run(async () => {
    await restoreBackup(await pull(link));
    save({ ...link, lastHash: null });
  });
}
