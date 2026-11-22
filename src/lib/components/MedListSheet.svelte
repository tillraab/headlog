<script lang="ts">
  import { MED_COLORS } from '$lib/colors';
  import type { Medication } from '$lib/db';
  import { CATEGORIES, guessCategory, type MedCategory } from '$lib/medication';
  import { toast } from '$lib/ui.svelte';
  import { t } from '$lib/i18n.svelte';
  import { addToList, data, updateInList } from '$lib/store.svelte';
  import EditableList from './EditableList.svelte';
  import Sheet from './Sheet.svelte';

  function addMed() {
    return addToList('medications', { name: t('set.name'), dose: '', category: 'analgesic', color: MED_COLORS[data.medications.length % MED_COLORS.length] });
  }

  /** Renames, and picks the category when the name is a known active ingredient or brand. */
  async function rename(med: Medication, name: string) {
    const category = guessCategory(name);
    await updateMed(med, category ? { name, category } : { name });
    if (category && category !== med.category) toast(t('set.categoryGuessed', { category: t(`cat.${category}`) }));
  }

  function updateMed(med: Medication, patch: Partial<Medication>) {
    return updateInList('medications', med.id, patch);
  }

  function updateLimit(med: Medication, days: string, window: string) {
    const n = Math.round(Number(days));
    const m = Math.min(365, Math.max(1, Math.round(Number(window)) || 30));
    return updateMed(med, n > 0 ? { limitDays: Math.min(n, m), limitWindow: m } : { limitDays: undefined, limitWindow: undefined });
  }
</script>

<Sheet id="medList" title={t('set.meds')} info={t('set.medsHint')}>
  <EditableList items={data.medications} table="medications" addLabel={t('set.addMed')} onadd={addMed}>
    {#snippet summary(med: Medication)}
    <span class="size-4 shrink-0 rounded-full" style:background-color={med.color}></span>
    <span class="flex min-w-0 flex-col">
      <span class="text-body font-medium">{med.name} <span class="text-muted">{med.dose}</span></span>
      <span class="text-sm text-muted">
        {t(`cat.${med.category}`)}{med.limitDays ? ` · ${t('set.limitOption', { n: med.limitDays, m: med.limitWindow ?? 30 })}` : ''}
      </span>
    </span>
    {/snippet}
    {#snippet details(med: Medication)}
    <div class="grid grid-cols-2 gap-2">
      <label class="flex flex-col gap-1 text-xs text-muted">
        {t('set.name')}
        <input class="bg-surface" value={med.name} onchange={(e) => (e.currentTarget.value.trim() ? rename(med, e.currentTarget.value.trim()) : (e.currentTarget.value = med.name))} />
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
      <p class="col-span-2 -mt-1 rounded-lg bg-surface px-3 py-2 text-sm text-muted">{t(`catDesc.${med.category}`)}</p>

      <div class="col-span-2 flex flex-col gap-1 text-xs text-muted">
        {t('set.limitDays')}
        <div class="flex flex-wrap items-center gap-2 text-base text-fg">
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
        <span class="text-sm">{t('set.limitHint')}</span>
      </div>
      <div class="col-span-2 flex flex-wrap items-center gap-1">
        {#each MED_COLORS as color (color)}
          <button
            class="press grid size-11 place-items-center rounded-full"
            onclick={() => updateMed(med, { color })}
            aria-label={color}
          >
            <span
              class="size-8 rounded-full {med.color === color ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface-2' : ''}"
              style:background-color={color}
            ></span>
          </button>
        {/each}
      </div>
    </div>
    {/snippet}
  </EditableList>
</Sheet>
