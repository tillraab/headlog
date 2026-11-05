<script lang="ts">
  import { Plus, Trash2 } from '@lucide/svelte';
  import { MED_COLORS, type MedCategory, type Medication } from '$lib/db';
  import { t } from '$lib/i18n.svelte';
  import { data, deleteMedication, saveMedication } from '$lib/store.svelte';
  import OrderButtons from './OrderButtons.svelte';
  import Sheet from './Sheet.svelte';

  const CATEGORIES: MedCategory[] = ['analgesic', 'triptan', 'combination', 'opioid', 'preventive', 'other'];

  let openMed = $state<number | null>(null);

  async function addMed() {
    await saveMedication({
      name: t('set.name'),
      dose: '',
      category: 'analgesic',
      color: MED_COLORS[data.medications.length % MED_COLORS.length],
      order: data.medications.length ? Math.max(...data.medications.map((m) => m.order)) + 1 : 0
    });
    openMed = data.medications[data.medications.length - 1]?.id ?? null;
  }

  async function updateMed(med: Medication, patch: Partial<Medication>) {
    await saveMedication({ ...$state.snapshot(med), ...patch });
  }

  function updateLimit(med: Medication, days: string, window: string) {
    const n = Math.round(Number(days));
    const m = Math.min(365, Math.max(1, Math.round(Number(window)) || 30));
    return updateMed(med, n > 0 ? { limitDays: Math.min(n, m), limitWindow: m } : { limitDays: undefined, limitWindow: undefined });
  }
</script>

<Sheet id="medList" title={t('set.meds')}>
  <p class="mb-3 text-xs text-muted">{t('set.medsHint')}</p>
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
        <OrderButtons list={data.medications} index={i} table="medications" />
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
</Sheet>
