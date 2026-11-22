<script lang="ts">
  /** Backup to a GitHub gist, with its encryption, or to a JSON file. */
  import { Lock, LockOpen } from '@lucide/svelte';
  import { createBackup, isBackup, saveFile } from '$lib/backup';
  import { PassphraseError } from '$lib/crypto';
  import { fmt, t } from '$lib/i18n.svelte';
  import { data, restore } from '$lib/store.svelte';
  import { backupProblem, connect, disconnect, restoreFromGist, setPassphrase, sync, syncNow } from '$lib/sync.svelte';
  import { openSheet, toast } from '$lib/ui.svelte';

  let fileInput = $state<HTMLInputElement>();

  async function exportJson() {
    const backup = await createBackup();
    await saveFile(`headlog-backup-${backup.exportedAt.slice(0, 10)}.json`, JSON.stringify(backup, null, 1), 'application/json');
  }

  async function importFile(file: File) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      parsed = null;
    }
    if (!isBackup(parsed)) {
      toast(t('set.importFailed'));
      return;
    }
    if (!confirm(t('set.importConfirm'))) return;
    try {
      await restore(parsed);
    } catch {
      toast(t('set.restoreFailed'));
      return;
    }
    toast(t('set.imported'));
  }

  let token = $state('');

  async function guarded(task: () => Promise<unknown>) {
    try {
      await task();
    } catch (e) {
      // An encrypted backup asks for its passphrase in the card instead.
      if (e instanceof PassphraseError && e.reason === 'missing') return;
      toast(e instanceof PassphraseError ? t('crypt.wrong') : t('sync.failed', { error: sync.error }));
    }
  }

  function linkGist() {
    return guarded(async () => {
      const existing = await connect(token.trim());
      token = '';
      if (existing && confirm(t('sync.existing'))) {
        await restoreFromGist();
        toast(t('set.imported'));
      } else if (!existing) {
        toast(t('sync.done'));
      }
    });
  }

  function backupNow() {
    const empty = !data.episodes.length && !data.intakes.length && !data.drinks.length;
    if (empty && !confirm(t('sync.emptyConfirm'))) return;
    if (sync.link?.pausedFor === 'demo' && !confirm(t('sync.demoConfirm'))) return;
    return guarded(async () => {
      await syncNow(true);
      toast(t('sync.done'));
    });
  }

  function restoreGist() {
    if (!confirm(t('sync.restoreConfirm'))) return;
    return guarded(async () => {
      await restoreFromGist();
      toast(t('set.imported'));
    });
  }
  /** The backup way shown: the gist when one is connected, otherwise the file. */
  let backupMethod = $state<'gist' | 'file'>(sync.link ? 'gist' : 'file');
  const encrypted = $derived(!!sync.link?.passphrase);
  /** The error a locked backup reports; the card asks for the passphrase instead of showing it. */
  const NEEDS_PASSPHRASE = new PassphraseError('missing').message;
  /** The passphrase fields are shown to set a first passphrase, or to change it. */
  let changing = $state(false);
  let passphrase = $state('');
  let passphrase2 = $state('');
  /** The passphrase typed to open an encrypted backup when restoring. */
  let unlockWith = $state('');

  function encryptGist(next: string | null) {
    if (!confirm(t(next ? 'crypt.moveConfirm' : 'crypt.removeConfirm'))) return;
    return guarded(async () => {
      await setPassphrase(next);
      passphrase = passphrase2 = '';
      changing = false;
      toast(t(next ? 'crypt.done' : 'crypt.removed'));
    });
  }

  function unlock() {
    return guarded(async () => {
      await restoreFromGist(undefined, unlockWith);
      unlockWith = '';
      toast(t('set.imported'));
    });
  }
</script>

<div class="card flex flex-col gap-3 p-4 text-body">
  <div class="flex rounded-full bg-surface-2 p-1 text-sm">
    {#each [['gist', t('backup.gist')], ['file', t('backup.file')]] as [key, label] (key)}
      <button
        class="press min-h-10 flex-1 rounded-full px-3 py-1.5 font-medium {backupMethod === key ? 'bg-surface shadow-sm' : 'text-muted'}"
        aria-pressed={backupMethod === key}
        onclick={() => (backupMethod = key as 'gist' | 'file')}>{label}</button
      >
    {/each}
  </div>
  {#if backupMethod === 'file'}
    <p class="text-muted">{t('set.backupHint')}</p>
    <div class="grid grid-cols-2 gap-2">
      <button class="press btn-primary" onclick={exportJson}>{t('set.export')}</button>
      <button class="press min-h-11 rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-medium" onclick={() => fileInput?.click()}>{t('set.import')}</button>
    </div>
  {:else if sync.link}
    {#if backupProblem(sync.link)}<p class="rounded-xl bg-pain-soft p-3">{backupProblem(sync.link)}</p>{/if}
    {#if sync.link.paused && !sync.locked}<p class="rounded-xl bg-med-soft p-3">{t(sync.link.pausedFor === 'demo' ? 'sync.pausedDemo' : 'sync.paused')}</p>{/if}
    <p class="text-muted">
      {sync.link.lastSync ? t('sync.last', { time: fmt(sync.link.lastSync, 'd. MMM HH:mm') }) : t('sync.never')}
      {#if encrypted}<span class="text-ok"> · 🔒 {t('crypt.short')}</span>{/if}
    </p>
    <div class="flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
      {#if sync.locked}
        <p class="flex items-center gap-2 font-medium text-caution"><Lock size={18} />{t('crypt.locked')}</p>
        <p class="text-sm text-muted">{t('crypt.lockedHint')}</p>
        <input type="password" class="bg-surface" autocomplete="current-password" bind:value={unlockWith} placeholder={t('crypt.passphrase')} />
        <button class="press btn-primary self-start disabled:opacity-50" disabled={!unlockWith || sync.busy} onclick={unlock}>{t('crypt.unlock')}</button>
      {:else if encrypted && !changing}
        <p class="flex items-center gap-2 font-medium text-ok"><Lock size={18} />{t('crypt.on')}</p>
        <p class="text-sm text-muted">{t('crypt.onHint')}</p>
        <div class="flex flex-wrap gap-2">
          <button class="press min-h-11 rounded-xl bg-surface px-4 py-2.5 text-sm font-medium" onclick={() => (changing = true)}>{t('crypt.change')}</button>
          <button class="press min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium text-over disabled:opacity-50" disabled={sync.busy} onclick={() => encryptGist(null)}>
            {t('crypt.remove')}
          </button>
        </div>
      {:else}
        {#if encrypted}
          <p class="flex items-center gap-2 font-medium"><Lock size={18} />{t('crypt.change')}</p>
        {:else}
          <p class="flex items-center gap-2 font-medium text-caution"><LockOpen size={18} />{t('crypt.off')}</p>
          <p class="text-sm text-muted">{t('crypt.offHint')}</p>
        {/if}
        <label class="flex flex-col gap-1 text-sm text-muted">
          {t('crypt.passphrase')}
          <input type="password" class="bg-surface" autocomplete="new-password" bind:value={passphrase} placeholder={t('crypt.placeholder')} />
        </label>
        <label class="flex flex-col gap-1 text-sm text-muted">
          {t('crypt.repeat')}
          <input type="password" class="bg-surface" autocomplete="new-password" bind:value={passphrase2} />
        </label>
        <p class="text-sm text-muted">{t('crypt.warning')}</p>
        <div class="flex flex-wrap gap-2">
          <button
            class="press btn-primary disabled:opacity-50"
            disabled={passphrase.length < 8 || passphrase !== passphrase2 || sync.busy}
            onclick={() => encryptGist(passphrase)}>{t(encrypted ? 'crypt.save' : 'crypt.set')}</button
          >
          {#if changing}
            <button class="press min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium" onclick={() => ((changing = false), (passphrase = passphrase2 = ''))}>{t('edit.cancel')}</button>
          {/if}
        </div>
      {/if}
    </div>
    <div class="flex flex-wrap gap-2">
      <button
        class="press btn-primary disabled:opacity-50"
        disabled={sync.busy || sync.locked}
        onclick={backupNow}>{t('sync.now')}</button
      >
      <button class="press min-h-11 rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-medium disabled:opacity-50" disabled={sync.busy} onclick={restoreGist}>
        {t('sync.restore')}
      </button>
      <button class="press min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium text-over" onclick={disconnect}>{t('sync.disconnect')}</button>
    </div>
    <button class="press min-h-11 self-start font-medium text-primary underline underline-offset-4" onclick={() => openSheet('versions')}>
      {t('versions.open')}
    </button>
  {:else}
    <input type="password" autocomplete="off" placeholder="github_pat_…" bind:value={token} />
    <div class="flex flex-wrap items-center justify-between gap-2">
      <a class="text-primary underline underline-offset-4" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
        {t('sync.tokenLink')}
      </a>
      <button
        class="press btn-primary disabled:opacity-50"
        disabled={!token.trim() || sync.busy}
        onclick={linkGist}>{t('sync.connect')}</button
      >
    </div>
  {/if}
  {#if sync.error && !(sync.locked && sync.error === NEEDS_PASSPHRASE)}<p class="text-sm text-over">{sync.error}</p>{/if}
</div>
<input
  bind:this={fileInput}
  type="file"
  accept="application/json,.json"
  class="hidden"
  onchange={(e) => {
    const file = e.currentTarget.files?.[0];
    if (file) void importFile(file);
    e.currentTarget.value = '';
  }}
/>
