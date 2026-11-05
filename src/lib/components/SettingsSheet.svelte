<script lang="ts">
  import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2, X } from '@lucide/svelte';
  import { createBackup, isBackup, restoreBackup, saveFile, wipe } from '$lib/backup';
  import { exportForDoctor } from '$lib/doctor.svelte';
  import { MED_COLORS, type DrinkPreset, type MedCategory, type Medication } from '$lib/db';
  import { loadDemo } from '$lib/demo';
  import { fmt, i18n, setLang, t, type Lang } from '$lib/i18n.svelte';
  import { data, deleteDrinkPreset, deleteMedication, load, saveDrinkPreset, saveMedication, saveSettings, swapOrder, translateDrinkNames } from '$lib/store.svelte';
  import { MAX_CHECKIN_TIMES, requestReminderPermission } from '$lib/reminders';
  import { connect, disconnect, pauseSync, restoreFromGist, sync, syncNow } from '$lib/sync.svelte';
  import { applyTheme, openSheet, toast, type Theme } from '$lib/ui.svelte';
  import Sheet from './Sheet.svelte';

  const CATEGORIES: MedCategory[] = ['analgesic', 'triptan', 'combination', 'opioid', 'preventive', 'other'];
  const EMOJIS = ['🥛', '🍶', '💧', '☕', '🍵', '🧃', '🥤', '🫖', '🍺', '🧋'];

  let openMed = $state<number | null>(null);
  let openDrink = $state<number | null>(null);
  let fileInput = $state<HTMLInputElement>();

  function nextOrder(list: { order: number }[]) {
    return list.length ? Math.max(...list.map((x) => x.order)) + 1 : 0;
  }

  async function addMed() {
    await saveMedication({
      name: t('set.name'),
      dose: '',
      category: 'analgesic',
      color: MED_COLORS[data.medications.length % MED_COLORS.length],
      order: nextOrder(data.medications)
    });
    openMed = data.medications[data.medications.length - 1]?.id ?? null;
  }

  async function addDrink() {
    await saveDrinkPreset({ name: t('set.name'), emoji: '💧', ml: 250, order: nextOrder(data.drinkPresets) });
    openDrink = data.drinkPresets[data.drinkPresets.length - 1]?.id ?? null;
  }

  async function updateMed(med: Medication, patch: Partial<Medication>) {
    await saveMedication({ ...$state.snapshot(med), ...patch });
  }

  async function updateDrink(preset: DrinkPreset, patch: Partial<DrinkPreset>) {
    await saveDrinkPreset({ ...$state.snapshot(preset), ...patch });
  }

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
    await loadDemo(Date.now(), undefined, i18n.lang);
    await load();
  }

  async function reset() {
    if (!confirm(t('set.wipeConfirm'))) return;
    pauseSync();
    await wipe();
    await load();
  }

  let token = $state('');
  let reportMonths = $state(3);
  let reportFormat = $state<'pdf' | 'csv'>('pdf');

  function reliefLabel(minutes: number): string {
    return t('rem.after', { d: duration(minutes) });
  }

  function duration(minutes: number): string {
    return minutes < 60 ? t('rem.minutes', { n: minutes }) : t('rem.hours', { n: (minutes / 60).toLocaleString(i18n.lang) });
  }

  function updateLimit(med: Medication, days: string, window: string) {
    const n = Math.round(Number(days));
    const m = Math.min(365, Math.max(1, Math.round(Number(window)) || 30));
    return updateMed(med, n > 0 ? { limitDays: Math.min(n, m), limitWindow: m } : { limitDays: undefined, limitWindow: undefined });
  }

  let newCheckin = $state('');

  async function toggleCheckins(input: HTMLInputElement) {
    const enabled = await allowed(input);
    await saveSettings({ drinkCheckins: { ...data.settings.drinkCheckins, enabled } });
  }

  /** Whether a reminder switch may turn on. Turns the switch back off when notifications are not allowed. */
  async function allowed(input: HTMLInputElement): Promise<boolean> {
    if (!input.checked || (await requestReminderPermission())) return input.checked;
    toast(t('rem.denied'));
    input.checked = false;
    return false;
  }

  async function setCheckinTimes(times: string[]) {
    const unique = [...new Set(times)].sort().slice(0, MAX_CHECKIN_TIMES);
    await saveSettings({ drinkCheckins: { ...data.settings.drinkCheckins, times: unique } });
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

{#snippet orderButtons(list: { id: number; order: number }[], i: number, table: 'medications' | 'drinkPresets')}
  <button class="press grid size-9 place-items-center rounded-full disabled:opacity-30" disabled={i === 0} onclick={() => swapOrder(table, list[i], list[i - 1])} aria-label="Up">
    <ArrowUp size={16} />
  </button>
  <button
    class="press grid size-9 place-items-center rounded-full disabled:opacity-30"
    disabled={i === list.length - 1}
    onclick={() => swapOrder(table, list[i], list[i + 1])}
    aria-label="Down"
  >
    <ArrowDown size={16} />
  </button>
{/snippet}

<Sheet id="settings" title={t('set.title')} full>
  {@render group(t('set.meds'), t('set.medsHint'))}
  <ul class="card flex flex-col p-1">
    {#each data.medications as med, i (med.id)}
      <li class="rounded-xl {openMed === med.id ? 'bg-surface-2' : ''}">
        <div class="flex items-center gap-2 py-1 pl-3">
          <button class="press flex flex-1 items-center gap-3 py-2 text-left" onclick={() => (openMed = openMed === med.id ? null : med.id)}>
            <span class="size-3.5 rounded-full" style:background-color={med.color}></span>
            <span class="flex flex-col">
              <span class="text-body font-medium">{med.name} <span class="text-muted">{med.dose}</span></span>
              <span class="text-xs text-muted">
                {t(`cat.${med.category}`)}{med.limitDays ? ` · ${t('set.limitOption', { n: med.limitDays, m: med.limitWindow ?? 30 })}` : ''}
              </span>
            </span>
          </button>
          {@render orderButtons(data.medications, i, 'medications')}
        </div>
        {#if openMed === med.id}
          <div class="grid grid-cols-2 gap-2 px-3 pb-3">
            <label class="flex flex-col gap-1 text-xs text-muted">
              {t('set.name')}
              <input class="bg-surface" value={med.name} onchange={(e) => updateMed(med, { name: e.currentTarget.value.trim() || med.name })} />
            </label>
            <label class="flex flex-col gap-1 text-xs text-muted">
              {t('set.dose')}
              <input class="bg-surface" value={med.dose} placeholder="400 mg" onchange={(e) => updateMed(med, { dose: e.currentTarget.value.trim() })} />
            </label>
            <label class="col-span-2 flex flex-col gap-1 text-xs text-muted">
              {t('set.category')}
              <select class="bg-surface" value={med.category} onchange={(e) => updateMed(med, { category: e.currentTarget.value as MedCategory })}>
                {#each CATEGORIES as c (c)}<option value={c}>{t(`cat.${c}`)}</option>{/each}
              </select>
            </label>

            <div class="col-span-2 flex flex-col gap-1 text-xs text-muted">
              {t('set.limitDays')}
              <div class="flex items-center gap-2 text-sm text-fg">
                {t('set.limitMax')}
                <input
                  class="w-16 bg-surface text-center"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  placeholder="–"
                  value={med.limitDays ?? ''}
                  onchange={(e) => updateLimit(med, e.currentTarget.value, String(med.limitWindow ?? 30))}
                />
                {t('set.limitIn')}
                <input
                  class="w-16 bg-surface text-center"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  value={med.limitWindow ?? 30}
                  onchange={(e) => updateLimit(med, String(med.limitDays ?? ''), e.currentTarget.value)}
                />
                {t('set.limitDaysUnit')}
              </div>
              <span>{t('set.limitHint')}</span>
            </div>
            <div class="col-span-2 flex items-center gap-2">
              {#each MED_COLORS as color (color)}
                <button
                  class="press size-7 rounded-full {med.color === color ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface-2' : ''}"
                  style:background-color={color}
                  onclick={() => updateMed(med, { color })}
                  aria-label={color}
                ></button>
              {/each}
              <button class="press ml-auto grid size-9 place-items-center rounded-full text-over" onclick={() => deleteMedication(med.id)} aria-label={t('edit.delete')}>
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        {/if}
      </li>
    {/each}
    <li>
      <button class="press flex w-full items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-primary" onclick={addMed}>
        <Plus size={18} />{t('set.addMed')}
      </button>
    </li>
  </ul>

  {@render group(t('set.drinks'), t('set.drinksHint'))}
  <ul class="card flex flex-col p-1">
    {#each data.drinkPresets as preset, i (preset.id)}
      <li class="rounded-xl {openDrink === preset.id ? 'bg-surface-2' : ''}">
        <div class="flex items-center gap-2 py-1 pl-3">
          <button class="press flex flex-1 items-center gap-3 py-2 text-left" onclick={() => (openDrink = openDrink === preset.id ? null : preset.id)}>
            <span class="text-2xl">{preset.emoji}</span>
            <span class="text-body font-medium">{preset.name} <span class="text-muted tabular">{preset.ml} ml</span></span>
          </button>
          {@render orderButtons(data.drinkPresets, i, 'drinkPresets')}
        </div>
        {#if openDrink === preset.id}
          <div class="grid grid-cols-2 gap-2 px-3 pb-3">
            <label class="flex flex-col gap-1 text-xs text-muted">
              {t('set.name')}
              <input class="bg-surface" value={preset.name} onchange={(e) => updateDrink(preset, { name: e.currentTarget.value.trim() || preset.name })} />
            </label>
            <label class="flex flex-col gap-1 text-xs text-muted">
              ml
              <input class="bg-surface" type="number" inputmode="numeric" min="10" step="50" value={preset.ml} onchange={(e) => updateDrink(preset, { ml: Math.max(10, Number(e.currentTarget.value) || preset.ml) })} />
            </label>
            <div class="col-span-2 flex flex-wrap items-center gap-1">
              {#each EMOJIS as emoji (emoji)}
                <button class="press grid size-9 place-items-center rounded-full text-xl {preset.emoji === emoji ? 'bg-surface' : ''}" onclick={() => updateDrink(preset, { emoji })}>
                  {emoji}
                </button>
              {/each}
              <button class="press ml-auto grid size-9 place-items-center rounded-full text-over" onclick={() => deleteDrinkPreset(preset.id)} aria-label={t('edit.delete')}>
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        {/if}
      </li>
    {/each}
    <li>
      <button class="press flex w-full items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-primary" onclick={addDrink}>
        <Plus size={18} />{t('set.addDrink')}
      </button>
    </li>
  </ul>

  {@render group(t('set.general'))}
  <div class="card flex flex-col gap-4 p-4">
    <label class="flex items-center justify-between gap-4 text-body">
      {t('set.waterGoal')}
      <select class="w-28" value={data.settings.waterGoalMl} onchange={(e) => saveSettings({ waterGoalMl: Number(e.currentTarget.value) })}>
        {#each [1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3500, 4000] as ml (ml)}
          <option value={ml}>{(ml / 1000).toLocaleString()} l</option>
        {/each}
      </select>
    </label>
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
      {t('rem.headacheSetting')}
      <select class="w-32 shrink-0" value={data.settings.headacheCheckHours} onchange={(e) => saveSettings({ headacheCheckHours: Number(e.currentTarget.value) })}>
        <option value={0}>{t('rem.off')}</option>
        {#each [1, 2, 3, 4, 6] as n (n)}<option value={n}>{t('rem.headacheEvery', { d: duration(n * 60) })}</option>{/each}
      </select>
    </label>
    <label class="flex items-center justify-between gap-4 text-body">
      {t('rem.checkinSetting')}
      <input
        type="checkbox"
        class="size-6 shrink-0 accent-primary"
        checked={data.settings.drinkCheckins.enabled}
        onchange={(e) => toggleCheckins(e.currentTarget)}
      />
    </label>
    {#if data.settings.drinkCheckins.enabled}
      <div class="-mt-2 flex flex-col gap-2">
        <div class="flex flex-wrap gap-2">
          {#each data.settings.drinkCheckins.times as time (time)}
            <span class="flex items-center gap-1 rounded-full bg-water-soft py-1 pr-1 pl-3 text-sm font-medium tabular">
              {time}
              <button
                class="press grid size-6 place-items-center rounded-full"
                onclick={() => setCheckinTimes(data.settings.drinkCheckins.times.filter((x) => x !== time))}
                aria-label={t('edit.delete')}
              >
                <X size={14} />
              </button>
            </span>
          {/each}
          {#if data.settings.drinkCheckins.times.length < MAX_CHECKIN_TIMES}
            <label class="flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1 pl-3 text-sm font-medium">
              <Plus size={14} />
              <input
                type="time"
                class="w-24 bg-transparent p-0 text-sm"
                aria-label={t('rem.checkinAdd')}
                bind:value={newCheckin}
                onchange={() => {
                  if (newCheckin) void setCheckinTimes([...data.settings.drinkCheckins.times, newCheckin]);
                  newCheckin = '';
                }}
              />
            </label>
          {/if}
        </div>
        <p class="text-xs text-muted">{t('rem.checkinHint')}</p>
      </div>
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

  {@render group(t('set.doctor'))}
  <div class="card flex flex-col gap-3 p-4">
    <label class="flex flex-col gap-1 text-xs text-muted">
      {t('pdf.name')}
      <input value={data.settings.reportName} placeholder={t('pdf.namePlaceholder')} onchange={(e) => saveSettings({ reportName: e.currentTarget.value.trim() })} />
    </label>
    <div class="grid grid-cols-2 gap-2">
      <select bind:value={reportMonths}>
        {#each [1, 3, 6, 12] as n (n)}<option value={n}>{t('pdf.months', { n })}</option>{/each}
      </select>
      <div class="flex rounded-xl bg-surface-2 p-1 text-sm">
        {#each [['pdf', 'PDF'], ['csv', 'CSV']] as const as [value, name] (value)}
          <button class="press flex-1 rounded-lg py-1.5 {reportFormat === value ? 'bg-surface font-semibold shadow-sm' : 'text-muted'}" onclick={() => (reportFormat = value)}>
            {name}
          </button>
        {/each}
      </div>
    </div>
    <button class="press rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg" onclick={() => exportForDoctor(reportMonths, reportFormat)}>{t('set.doctorExport')}</button>
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
