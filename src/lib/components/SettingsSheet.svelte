<script lang="ts">
  import { ChevronDown, ChevronRight, Lock, LockOpen } from '@lucide/svelte';
  import { createBackup, isBackup, restoreBackup, saveFile, wipe } from '$lib/backup';
  import { loadDemo } from '$lib/demo';
  import { fmt, i18n, num, setLang, t, type Lang } from '$lib/i18n.svelte';
  import { formatLiters, hourLabel } from '$lib/days';
  import { clock, data, load, saveSettings, updateSleep, updateWeather } from '$lib/store.svelte';
  import { prognosisInput, tomorrowRisk } from '$lib/prognosis';
  import { setHours, startOfDay } from 'date-fns';
  import { requestReminderPermission } from '$lib/reminders';
  import { PassphraseError } from '$lib/crypto';
  import { connect, disconnect, pauseSync, restoreFromGist, setPassphrase, sync, syncNow } from '$lib/sync.svelte';
  import { FALL_ASLEEP_OPTIONS, openUsageAccessSettings, screenAccess } from '$lib/sleep';
  import { searchPlaces, type Place } from '$lib/weather';
  import type { Theme } from '$lib/settings';
  import { applyTheme, openSheet, toast, type InfoPart } from '$lib/ui.svelte';
  import HourSelect from './HourSelect.svelte';
  import InfoButton from './InfoButton.svelte';
  import Sheet from './Sheet.svelte';

  let fileInput = $state<HTMLInputElement>();

  async function exportJson() {
    const backup = await createBackup();
    await saveFile(`headlog-backup-${backup.exportedAt.slice(0, 10)}.json`, JSON.stringify(backup, null, 1), 'application/json');
  }

  /** What the evening warning will say tonight, as the data stands now; nothing once the hour has passed. */
  const riskTonight = $derived.by(() => {
    if (!data.settings.riskAlert.enabled) return '';
    const at = setHours(startOfDay(clock.now), data.settings.riskAlert.hour).getTime();
    if (at <= clock.now) return '';
    const risk = tomorrowRisk(prognosisInput(data), at);
    const hour = hourLabel(data.settings.riskAlert.hour);
    if (risk.light === 'green') return t('risk.tonightNone', { hour });
    return t('risk.tonight', { hour, factors: risk.factors.map((k) => t(`prog.tomorrowFactor.${k}`)).join(', ') });
  });

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
      await restoreBackup(parsed);
      await load();
    } catch {
      toast(t('set.restoreFailed'));
      return;
    }
    toast(t('set.imported'));
  }

  async function demo() {
    if (!confirm(t('set.demoConfirm'))) return;
    pauseSync('demo');
    const place = $state.snapshot(data.settings.weather.place);
    await loadDemo(Date.now(), undefined, i18n.lang);
    await load();
    await saveSettings({ weather: { enabled: true, place }, sleep: { ...data.settings.sleep, enabled: true } });
  }

  async function reset() {
    if (!confirm(t('set.wipeConfirm'))) return;
    pauseSync('wipe');
    await wipe();
    await load();
  }

  let token = $state('');

  function reliefLabel(minutes: number): string {
    return t('rem.after', { d: duration(minutes) });
  }

  function duration(minutes: number): string {
    return minutes < 60 ? t('rem.minutes', { n: minutes }) : t('rem.hours', { n: num(minutes / 60, 0, 2) });
  }

  let access = $state<{ supported: boolean; granted: boolean } | null>(null);

  /** Checks usage access again, e.g. after returning from Android's settings. */
  async function checkAccess() {
    access = await screenAccess();
    if (access.granted) await updateSleep();
  }

  $effect(() => {
    void checkAccess();
    const onVisible = () => document.visibilityState === 'visible' && void checkAccess();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });

  let placeQuery = $state('');
  let places = $state<(Place & { region: string })[]>([]);
  let placeError = $state('');

  async function findPlaces() {
    placeError = '';
    try {
      places = await searchPlaces(placeQuery.trim(), i18n.lang);
      if (!places.length) placeError = t('weather.noPlace');
    } catch (e) {
      placeError = e instanceof Error ? e.message : String(e);
    }
  }

  async function choosePlace(place: Place) {
    places = [];
    placeQuery = '';
    await saveSettings({ weather: { enabled: true, place: { name: place.name, latitude: place.latitude, longitude: place.longitude } } });
    try {
      await updateWeather(true);
      toast(t('weather.loaded'));
    } catch (e) {
      placeError = e instanceof Error ? e.message : String(e);
    }
  }

  async function toggleDrinkReminder(input: HTMLInputElement) {
    const enabled = await allowed(input);
    await setDrinkReminder({ enabled });
  }

  function setDrinkReminder(patch: Partial<typeof data.settings.drinkReminder>) {
    return saveSettings({ drinkReminder: { ...data.settings.drinkReminder, ...patch } });
  }

  /** Whether a reminder switch may turn on. Turns the switch back off when notifications are not allowed. */
  async function allowed(input: HTMLInputElement): Promise<boolean> {
    if (!input.checked || (await requestReminderPermission())) return input.checked;
    toast(t('rem.denied'));
    input.checked = false;
    return false;
  }

  async function toggleReminders(input: HTMLInputElement) {
    const enabled = await allowed(input);
    await saveSettings({ reminders: { ...data.settings.reminders, enabled } });
  }

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
        await load();
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
      await load();
      toast(t('set.imported'));
    });
  }

  function changeLang(lang: Lang) {
    setLang(lang);
  }

  async function setTheme(theme: Theme) {
    applyTheme(theme);
    await saveSettings({ theme });
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
      await load();
      toast(t('set.imported'));
    });
  }
</script>

{#snippet group(title: string, hint?: InfoPart | InfoPart[])}
  <div class="mt-6 mb-2 flex min-h-6 items-center gap-1">
    <h3 class="text-sm font-semibold tracking-wide text-muted uppercase">{title}</h3>
    {#if hint}<InfoButton {title} text={hint} />{/if}
  </div>
{/snippet}

<Sheet id="settings" title={t('set.title')} full>
  {@render group(t('set.lists'))}
  <div class="card flex flex-col p-1 text-body">
    <button class="press flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 py-3 text-left" onclick={() => openSheet('medList')}>
      <span>💊 {t('set.meds')}</span>
      <span class="flex items-center gap-1 text-muted">{data.medications.length}<ChevronRight size={20} /></span>
    </button>
    <button class="press flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 py-3 text-left" onclick={() => openSheet('drinkList')}>
      <span>💧 {t('set.drinks')}</span>
      <span class="flex items-center gap-1 text-muted">{t('set.goalShort', { goal: formatLiters(data.settings.waterGoalMl) })}<ChevronRight size={20} /></span>
    </button>
  </div>
  {@render group(t('set.general'))}
  <div class="card flex flex-col gap-4 p-4">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-body">
      {t('set.language')}
      <div class="flex rounded-full bg-surface-2 p-1">
        {#each [['de', 'Deutsch'], ['en', 'English']] as [code, name] (code)}
          <button class="press min-h-10 rounded-full px-3 py-1 {i18n.lang === code ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => changeLang(code as Lang)}>{name}</button>
        {/each}
      </div>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-body">
      {t('set.theme')}
      <div class="flex rounded-full bg-surface-2 p-1">
        {#each [['system', t('set.themeSystem')], ['light', t('set.themeLight')], ['dark', t('set.themeDark')]] as [value, name] (value)}
          <button class="press min-h-10 rounded-full px-3 py-1 {data.settings.theme === value ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => setTheme(value as Theme)}>
            {name}
          </button>
        {/each}
      </div>
    </div>
  </div>

  {@render group(t('rem.title'))}
  <div class="card flex flex-col gap-4 p-4">
    <label class="flex items-center justify-between gap-4 text-body">
      {t('rem.reliefSetting')}
      <select class="w-32 shrink-0" value={data.settings.reliefCheckMinutes} onchange={(e) => saveSettings({ reliefCheckMinutes: Number(e.currentTarget.value) })}>
        <option value={0}>{t('rem.off')}</option>
        {#each [30, 60, 90, 120, 180, 240] as n (n)}<option value={n}>{reliefLabel(n)}</option>{/each}
      </select>
    </label>
    <label class="flex items-center justify-between gap-4 text-body">
      {t('risk.setting')}
      <HourSelect setting={data.settings.riskAlert} hours={[18, 19, 20, 21, 22]} onchange={(riskAlert) => saveSettings({ riskAlert })} />
    </label>
    {#if riskTonight}<p class="-mt-2 text-sm text-muted">{riskTonight}</p>{/if}
    <label class="flex items-center justify-between gap-4 text-body">
      {t('rem.headacheSetting')}
      <select class="w-32 shrink-0" value={data.settings.headacheCheckHours} onchange={(e) => saveSettings({ headacheCheckHours: Number(e.currentTarget.value) })}>
        <option value={0}>{t('rem.off')}</option>
        {#each [1, 2, 3, 4, 6] as n (n)}<option value={n}>{t('rem.headacheEvery', { d: duration(n * 60) })}</option>{/each}
      </select>
    </label>
    <label class="flex items-center justify-between gap-4 text-body">
      {t('rem.drinkSetting')}
      <input
        type="checkbox"
        class="size-6 shrink-0 accent-primary"
        checked={data.settings.drinkReminder.enabled}
        onchange={(e) => toggleDrinkReminder(e.currentTarget)}
      />
    </label>
    {#if data.settings.drinkReminder.enabled}
      <label class="flex items-center justify-between gap-4 text-body">
        {t('rem.drinkAfter')}
        <select class="w-32 shrink-0" value={data.settings.drinkReminder.everyHours} onchange={(e) => setDrinkReminder({ everyHours: Number(e.currentTarget.value) })}>
          {#each [1, 1.5, 2, 3, 4] as n (n)}<option value={n}>{duration(n * 60)}</option>{/each}
        </select>
      </label>
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-body">
        <span class="flex items-center gap-1">{t('rem.drinkWindow')}<InfoButton title={t('rem.drinkWindow')} text={t('rem.drinkHint')} /></span>
        <span class="flex shrink-0 items-center gap-1">
          <select class="w-24" aria-label={t('rem.drinkFrom')} value={data.settings.drinkReminder.from} onchange={(e) => setDrinkReminder({ from: Number(e.currentTarget.value) })}>
            {#each [5, 6, 7, 8, 9, 10, 11, 12] as h (h)}<option value={h}>{hourLabel(h)}</option>{/each}
          </select>
          –
          <select class="w-24" aria-label={t('rem.drinkTo')} value={data.settings.drinkReminder.to} onchange={(e) => setDrinkReminder({ to: Number(e.currentTarget.value) })}>
            {#each [16, 17, 18, 19, 20, 21, 22, 23] as h (h)}<option value={h}>{hourLabel(h)}</option>{/each}
          </select>
        </span>
      </div>
    {/if}
    <label class="flex items-center justify-between gap-4 text-body">
      <span class="flex items-center gap-1">{t('rem.enabled')}<InfoButton title={t('rem.enabled')} text={t('rem.hint')} /></span>
      <input
        type="checkbox"
        class="size-6 shrink-0 accent-primary"
        checked={data.settings.reminders.enabled}
        onchange={(e) => toggleReminders(e.currentTarget)}
      />
    </label>
    {#if data.settings.reminders.enabled}
      {#each [['noon', [10, 11, 12, 13, 14, 15]], ['evening', [16, 17, 18, 19, 20, 21]]] as const as [field, hours] (field)}
        <label class="flex items-center justify-between gap-4 text-body">
          {t(field === 'noon' ? 'rem.noon' : 'rem.evening')}
          <select
            class="w-28"
            value={data.settings.reminders[field]}
            onchange={(e) => saveSettings({ reminders: { ...data.settings.reminders, [field]: Number(e.currentTarget.value) } })}
          >
            {#each hours as h (h)}<option value={h}>{hourLabel(h)}</option>{/each}
          </select>
        </label>
      {/each}
    {/if}
  </div>

  {@render group(t('sleep.title'), t('sleep.hint'))}
  <div class="card flex flex-col gap-3 p-4 text-body">
    {#if access && !access.supported}
      <p class="text-muted">{t('sleep.unsupported')}</p>
    {:else}
      <label class="flex items-center justify-between gap-4">
        {t('sleep.setting')}
        <input
          type="checkbox"
          class="size-6 shrink-0 accent-primary"
          checked={data.settings.sleep.enabled}
          onchange={async (e) => {
            await saveSettings({ sleep: { ...data.settings.sleep, enabled: e.currentTarget.checked } });
            await checkAccess();
          }}
        />
      </label>
      {#if data.settings.sleep.enabled}
        <label class="flex items-center justify-between gap-4">
          {t('sleep.fallAsleepSetting')}
          <select
            class="w-32 shrink-0"
            value={data.settings.sleep.fallAsleepMinutes}
            onchange={async (e) => {
              await saveSettings({ sleep: { ...data.settings.sleep, fallAsleepMinutes: Number(e.currentTarget.value) } });
              await updateSleep();
            }}
          >
            {#each FALL_ASLEEP_OPTIONS as n (n)}<option value={n}>{t('sleep.minutes', { n })}</option>{/each}
          </select>
        </label>
      {/if}
      {#if data.settings.sleep.enabled && access?.granted}
        <p class="text-sm text-muted">{data.sleep.size ? t('sleep.nights', { n: data.sleep.size }) : t('sleep.none')}</p>
      {/if}
      {#if data.settings.sleep.enabled}
        <label class="flex items-center justify-between gap-4">
          {t('sleep.checkSetting')}
          <HourSelect setting={data.settings.sleepCheck} hours={[7, 8, 9, 10, 11]} onchange={(sleepCheck) => saveSettings({ sleepCheck })} />
        </label>
      {/if}
      {#if data.settings.sleep.enabled && access && !access.granted}
        <p class="text-sm text-muted">{t('sleep.allowHint')}</p>
        <button class="press btn-primary" onclick={() => openUsageAccessSettings()}>
          {t('sleep.allow')}
        </button>
      {/if}
    {/if}
  </div>

  {@render group(t('weather.title'), t('weather.hint'))}
  <div class="card flex flex-col gap-3 p-4 text-body">
    {#if data.settings.weather.place}
      <label class="flex items-center justify-between gap-4">
        <span>🌦️ {data.settings.weather.place.name}</span>
        <input
          type="checkbox"
          class="size-6 accent-primary"
          checked={data.settings.weather.enabled}
          onchange={async (e) => {
            await saveSettings({ weather: { ...data.settings.weather, enabled: e.currentTarget.checked } });
            if (e.currentTarget.checked) void updateWeather(true).catch(() => {});
          }}
        />
      </label>
      <p class="text-sm text-muted">{t('weather.days', { n: data.weather.size })}</p>
    {/if}
    <form
      class="flex gap-2"
      onsubmit={(e) => {
        e.preventDefault();
        if (placeQuery.trim()) void findPlaces();
      }}
    >
      <input placeholder={data.settings.weather.place ? t('weather.change') : t('weather.search')} bind:value={placeQuery} />
      <button class="press min-h-11 shrink-0 rounded-xl bg-primary px-4 font-semibold text-primary-fg disabled:opacity-50" disabled={!placeQuery.trim()}>
        {t('weather.find')}
      </button>
    </form>
    {#if places.length}
      <ul class="flex flex-col">
        {#each places as place, i (i)}
          <li>
            <button class="press min-h-11 w-full rounded-xl px-3 py-2 text-left hover:bg-surface-2" onclick={() => choosePlace(place)}>
              <span class="font-medium">{place.name}</span> <span class="text-sm text-muted">{place.region}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if placeError}<p class="text-sm text-over">{placeError}</p>{/if}
  </div>

  {@render group(t('backup.title'), t('sync.hint'))}
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

  <details class="group mt-6">
    <summary class="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold tracking-wide text-muted uppercase">
      {t('set.advanced')}
      <ChevronDown size={20} class="transition-transform group-open:rotate-180" />
    </summary>
    <div class="card mt-2 flex flex-col p-1 text-body">
      <button class="press rounded-xl px-3 py-3 text-left" onclick={demo}>{t('set.demo')}</button>
      <button class="press rounded-xl px-3 py-3 text-left text-over" onclick={reset}>{t('set.wipe')}</button>
    </div>
  </details>
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

  <p class="mt-6 text-center text-sm text-muted">{t('set.about', { v: __APP_VERSION__ })}</p>
</Sheet>
