<script lang="ts">
  import { ChevronDown, ChevronRight } from '@lucide/svelte';
  import { createBackup, isBackup, restoreBackup, saveFile, wipe } from '$lib/backup';
  import { loadDemo } from '$lib/demo';
  import { fmt, i18n, setLang, t, type Lang } from '$lib/i18n.svelte';
  import { formatLiters } from '$lib/days';
  import { data, load, saveSettings, translateDrinkNames, updateSleep, updateWeather } from '$lib/store.svelte';
  import { requestReminderPermission } from '$lib/reminders';
  import { connect, disconnect, pauseSync, restoreFromGist, sync, syncNow } from '$lib/sync.svelte';
  import { openUsageAccessSettings, screenAccess } from '$lib/sleep';
  import { searchPlaces, type Place } from '$lib/weather';
  import { applyTheme, openSheet, toast, type Theme } from '$lib/ui.svelte';
  import Sheet from './Sheet.svelte';


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
    await restoreBackup(parsed);
    await load();
    toast(t('set.imported'));
  }

  async function demo() {
    if (!confirm(t('set.demoConfirm'))) return;
    pauseSync();
    const place = $state.snapshot(data.settings.weather.place);
    await loadDemo(Date.now(), undefined, i18n.lang);
    await load();
    await saveSettings({ weather: { enabled: true, place }, sleep: { enabled: true } });
  }

  async function reset() {
    if (!confirm(t('set.wipeConfirm'))) return;
    pauseSync();
    await wipe();
    await load();
  }

  let token = $state('');

  function reliefLabel(minutes: number): string {
    return t('rem.after', { d: duration(minutes) });
  }

  function duration(minutes: number): string {
    return minutes < 60 ? t('rem.minutes', { n: minutes }) : t('rem.hours', { n: (minutes / 60).toLocaleString(i18n.lang) });
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
    } catch {
      toast(t('sync.failed', { error: sync.error }));
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

  async function changeLang(lang: Lang) {
    setLang(lang);
    await translateDrinkNames(lang);
  }

  async function setTheme(theme: Theme) {
    applyTheme(theme);
    await saveSettings({ theme });
  }
</script>

{#snippet group(title: string, hint?: string)}
  <h3 class="mt-6 mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
  {#if hint}<p class="mb-2 text-xs text-muted">{hint}</p>{/if}
{/snippet}

<Sheet id="settings" title={t('set.title')} full>
  {@render group(t('set.lists'))}
  <div class="card flex flex-col p-1 text-body">
    <button class="press flex items-center justify-between rounded-xl px-3 py-3 text-left" onclick={() => openSheet('medList')}>
      <span>💊 {t('set.meds')}</span>
      <span class="flex items-center gap-1 text-sm text-muted">{data.medications.length}<ChevronRight size={16} /></span>
    </button>
    <button class="press flex items-center justify-between rounded-xl px-3 py-3 text-left" onclick={() => openSheet('drinkList')}>
      <span>💧 {t('set.drinks')}</span>
      <span class="flex items-center gap-1 text-sm text-muted">{t('set.goalShort', { goal: formatLiters(data.settings.waterGoalMl) })}<ChevronRight size={16} /></span>
    </button>
  </div>
  {@render group(t('set.general'))}
  <div class="card flex flex-col gap-4 p-4">
    <label class="flex items-center justify-between gap-4 text-body">
      {t('set.limit')}
      <select class="w-20" value={data.settings.limit} onchange={(e) => saveSettings({ limit: Number(e.currentTarget.value) })}>
        {#each [6, 8, 10, 12, 15] as n (n)}<option value={n}>{n}</option>{/each}
      </select>
    </label>
    <div class="flex items-center justify-between gap-4 text-body">
      {t('set.language')}
      <div class="flex rounded-full bg-surface-2 p-1 text-sm">
        {#each [['de', 'Deutsch'], ['en', 'English']] as [code, name] (code)}
          <button class="press rounded-full px-3 py-1 {i18n.lang === code ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => changeLang(code as Lang)}>{name}</button>
        {/each}
      </div>
    </div>
    <div class="flex items-center justify-between gap-4 text-body">
      {t('set.theme')}
      <div class="flex rounded-full bg-surface-2 p-1 text-sm">
        {#each [['system', t('set.themeSystem')], ['light', t('set.themeLight')], ['dark', t('set.themeDark')]] as [value, name] (value)}
          <button class="press rounded-full px-3 py-1 {data.settings.theme === value ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => setTheme(value as Theme)}>
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
      <select
        class="w-32 shrink-0"
        value={data.settings.riskAlert.enabled ? data.settings.riskAlert.hour : 0}
        onchange={(e) => {
          const hour = Number(e.currentTarget.value);
          void saveSettings({ riskAlert: hour ? { enabled: true, hour } : { ...data.settings.riskAlert, enabled: false } });
        }}
      >
        <option value={0}>{t('rem.off')}</option>
        {#each [18, 19, 20, 21, 22] as h (h)}<option value={h}>{String(h).padStart(2, '0')}:00</option>{/each}
      </select>
    </label>
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
      <div class="flex items-center justify-between gap-4 text-body">
        {t('rem.drinkWindow')}
        <span class="flex shrink-0 items-center gap-1">
          <select class="w-24" aria-label={t('rem.drinkFrom')} value={data.settings.drinkReminder.from} onchange={(e) => setDrinkReminder({ from: Number(e.currentTarget.value) })}>
            {#each [5, 6, 7, 8, 9, 10, 11, 12] as h (h)}<option value={h}>{String(h).padStart(2, '0')}:00</option>{/each}
          </select>
          –
          <select class="w-24" aria-label={t('rem.drinkTo')} value={data.settings.drinkReminder.to} onchange={(e) => setDrinkReminder({ to: Number(e.currentTarget.value) })}>
            {#each [16, 17, 18, 19, 20, 21, 22, 23] as h (h)}<option value={h}>{String(h).padStart(2, '0')}:00</option>{/each}
          </select>
        </span>
      </div>
      <p class="-mt-2 text-xs text-muted">{t('rem.drinkHint')}</p>
    {/if}
    <label class="flex items-center justify-between gap-4 text-body">
      {t('rem.enabled')}
      <input
        type="checkbox"
        class="size-6 accent-primary"
        checked={data.settings.reminders.enabled}
        onchange={(e) => toggleReminders(e.currentTarget)}
      />
    </label>
    <p class="-mt-2 text-xs text-muted">{t('rem.hint')}</p>
    {#if data.settings.reminders.enabled}
      {#each [['noon', [10, 11, 12, 13, 14, 15]], ['evening', [16, 17, 18, 19, 20, 21]]] as const as [field, hours] (field)}
        <label class="flex items-center justify-between gap-4 text-body">
          {t(field === 'noon' ? 'rem.noon' : 'rem.evening')}
          <select
            class="w-28"
            value={data.settings.reminders[field]}
            onchange={(e) => saveSettings({ reminders: { ...data.settings.reminders, [field]: Number(e.currentTarget.value) } })}
          >
            {#each hours as h (h)}<option value={h}>{String(h).padStart(2, '0')}:00</option>{/each}
          </select>
        </label>
      {/each}
    {/if}
  </div>

  {@render group(t('sleep.title'), t('sleep.hint'))}
  <div class="card flex flex-col gap-3 p-4 text-body">
    {#if access && !access.supported}
      <p class="text-sm text-muted">{t('sleep.unsupported')}</p>
    {:else}
      <label class="flex items-center justify-between gap-4">
        {t('sleep.setting')}
        <input
          type="checkbox"
          class="size-6 shrink-0 accent-primary"
          checked={data.settings.sleep.enabled}
          onchange={async (e) => {
            await saveSettings({ sleep: { enabled: e.currentTarget.checked } });
            await checkAccess();
          }}
        />
      </label>
      {#if data.settings.sleep.enabled && access?.granted}
        <p class="text-xs text-muted">{data.sleep.size ? t('sleep.nights', { n: data.sleep.size }) : t('sleep.none')}</p>
      {/if}
      {#if data.settings.sleep.enabled}
        <label class="flex items-center justify-between gap-4">
          {t('sleep.checkSetting')}
          <select
            class="w-32 shrink-0"
            value={data.settings.sleepCheck.enabled ? data.settings.sleepCheck.hour : 0}
            onchange={(e) => {
              const hour = Number(e.currentTarget.value);
              void saveSettings({ sleepCheck: hour ? { enabled: true, hour } : { ...data.settings.sleepCheck, enabled: false } });
            }}
          >
            <option value={0}>{t('rem.off')}</option>
            {#each [7, 8, 9, 10, 11] as h (h)}<option value={h}>{String(h).padStart(2, '0')}:00</option>{/each}
          </select>
        </label>
      {/if}
      {#if data.settings.sleep.enabled && access && !access.granted}
        <p class="text-xs text-muted">{t('sleep.allowHint')}</p>
        <button class="press rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg" onclick={() => openUsageAccessSettings()}>
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
      <p class="text-xs text-muted">{t('weather.days', { n: data.weather.size })}</p>
    {/if}
    <form
      class="flex gap-2"
      onsubmit={(e) => {
        e.preventDefault();
        if (placeQuery.trim()) void findPlaces();
      }}
    >
      <input placeholder={data.settings.weather.place ? t('weather.change') : t('weather.search')} bind:value={placeQuery} />
      <button class="press shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-50" disabled={!placeQuery.trim()}>
        {t('weather.find')}
      </button>
    </form>
    {#if places.length}
      <ul class="flex flex-col">
        {#each places as place, i (i)}
          <li>
            <button class="press w-full rounded-xl px-3 py-2 text-left hover:bg-surface-2" onclick={() => choosePlace(place)}>
              <span class="font-medium">{place.name}</span> <span class="text-xs text-muted">{place.region}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if placeError}<p class="text-xs text-over">{placeError}</p>{/if}
  </div>

  {@render group(t('sync.title'), t('sync.hint'))}
  <div class="card flex flex-col gap-3 p-4 text-body">
    {#if sync.link}
      {#if sync.link.paused}<p class="rounded-xl bg-med-soft p-3 text-sm">{t('sync.paused')}</p>{/if}
      <p class="text-sm text-muted">
        {sync.link.lastSync ? t('sync.last', { time: fmt(sync.link.lastSync, 'd. MMM HH:mm') }) : t('sync.never')}
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          class="press rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg disabled:opacity-50"
          disabled={sync.busy}
          onclick={backupNow}>{t('sync.now')}</button
        >
        <button class="press rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-medium disabled:opacity-50" disabled={sync.busy} onclick={restoreGist}>
          {t('sync.restore')}
        </button>
        <button class="press rounded-xl px-4 py-2.5 text-sm font-medium text-over" onclick={disconnect}>{t('sync.disconnect')}</button>
      </div>
      <button class="press self-start text-sm font-medium text-primary underline underline-offset-4" onclick={() => openSheet('versions')}>
        {t('versions.open')}
      </button>
    {:else}
      <input type="password" autocomplete="off" placeholder="github_pat_…" bind:value={token} />
      <div class="flex items-center justify-between gap-2">
        <a class="text-sm text-primary underline underline-offset-4" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
          {t('sync.tokenLink')}
        </a>
        <button
          class="press rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg disabled:opacity-50"
          disabled={!token.trim() || sync.busy}
          onclick={linkGist}>{t('sync.connect')}</button
        >
      </div>
    {/if}
    {#if sync.error}<p class="text-xs text-over">{sync.error}</p>{/if}
  </div>

  {@render group(t('set.backup'), t('set.backupHint'))}
  <div class="card grid grid-cols-2 gap-2 p-4">
    <button class="press rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg" onclick={exportJson}>{t('set.export')}</button>
    <button class="press rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-medium" onclick={() => fileInput?.click()}>{t('set.import')}</button>
  </div>

  <details class="group mt-6">
    <summary class="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold tracking-wide text-muted uppercase">
      {t('set.advanced')}
      <ChevronDown size={14} class="transition-transform group-open:rotate-180" />
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

  <p class="mt-6 text-center text-xs text-muted">{t('set.about', { v: __APP_VERSION__ })}</p>
</Sheet>
