<script lang="ts">
  import { ArrowDown, ArrowUp, Plus, Trash2 } from '@lucide/svelte';
  import { createBackup, createCsv, isBackup, restoreBackup, saveFile, wipe } from '$lib/backup';
  import { MED_COLORS, type DrinkPreset, type MedCategory, type Medication } from '$lib/db';
  import { loadDemo } from '$lib/demo';
  import { i18n, setLang, t, type Lang } from '$lib/i18n.svelte';
  import { data, deleteDrinkPreset, deleteMedication, load, saveDrinkPreset, saveMedication, saveSettings, swapOrder } from '$lib/store.svelte';
  import { applyTheme, toast, type Theme } from '$lib/ui.svelte';
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

  async function exportCsv() {
    await saveFile(`headlog-${new Date().toISOString().slice(0, 10)}.csv`, await createCsv(), 'text/csv');
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
    await loadDemo(Date.now(), undefined, i18n.lang);
    await load();
  }

  async function reset() {
    if (!confirm(t('set.wipeConfirm'))) return;
    await wipe();
    await load();
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
              <span class="text-xs text-muted">{t(`cat.${med.category}`)}</span>
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
          <button class="press rounded-full px-3 py-1 {i18n.lang === code ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => setLang(code as Lang)}>{name}</button>
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

  {@render group(t('set.data'))}
  <div class="card flex flex-col p-1 text-left text-body">
    <button class="press rounded-xl px-3 py-3 text-left" onclick={exportJson}>{t('set.export')}</button>
    <button class="press rounded-xl px-3 py-3 text-left" onclick={() => fileInput?.click()}>{t('set.import')}</button>
    <button class="press rounded-xl px-3 py-3 text-left" onclick={exportCsv}>{t('set.exportCsv')}</button>
    <button class="press rounded-xl px-3 py-3 text-left" onclick={demo}>{t('set.demo')}</button>
    <button class="press rounded-xl px-3 py-3 text-left text-over" onclick={reset}>{t('set.wipe')}</button>
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

  <p class="mt-6 text-center text-xs text-muted">{t('set.about', { v: __APP_VERSION__ })}</p>
</Sheet>
