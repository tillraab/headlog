<script lang="ts">
  /** Links to the medication list and the drink list with the hydration goal. */
  import { ChevronRight } from '@lucide/svelte';
  import { formatLiters } from '$lib/days';
  import { t } from '$lib/i18n.svelte';
  import { data } from '$lib/store.svelte';
  import { openSheet } from '$lib/ui.svelte';
</script>

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
