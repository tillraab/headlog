<script lang="ts">
  /** The table of known medications by class, searchable; each entry has an Add button unless it is already in the user's list. */
  import { i18n, t } from '$lib/i18n.svelte';
  import { CATEGORIES, isAcute } from '$lib/medication';
  import { displayName, ingredientName, mainName, otherNames, searchMedicines, type Medicine } from '$lib/medicines';
  import { addMedication, data } from '$lib/store.svelte';
  import { Check, Plus } from '@lucide/svelte';
  import { closeSheet, toast } from '$lib/ui.svelte';
  import SectionLabel from './SectionLabel.svelte';
  import Sheet from './Sheet.svelte';

  let query = $state('');

  const found = $derived(searchMedicines(query));
  const groups = $derived(CATEGORIES.map((category) => ({ category, medicines: found.filter((m) => m.category === category) })).filter((g) => g.medicines.length));

  /** Whether a medication of that name is already in the user's list. */
  function inList(name: string): boolean {
    return data.medications.some((m) => m.name.toLowerCase() === name.toLowerCase());
  }

  async function add(medicine: Medicine) {
    const name = displayName(mainName(medicine, i18n.lang));
    await addMedication(name, medicine.category);
    closeSheet('medLookup');
    toast(t('lookup.added', { name, category: t(`cat.${medicine.category}`) }));
  }
</script>

<Sheet id="medLookup" title={t('lookup.title')} full>
  <div class="sticky top-0 z-10 bg-bg pb-1">
    <input class="w-full bg-surface" type="search" placeholder={t('lookup.search')} aria-label={t('lookup.search')} bind:value={query} />
  </div>
  {#each groups as { category, medicines } (category)}
    <div class="mt-5 mb-1.5 flex items-baseline gap-2">
      <SectionLabel>{t(`cat.${category}`)}</SectionLabel>
      <span class="rounded-full px-2 py-0.5 text-caption font-medium {isAcute(category) ? 'bg-med-soft text-med' : 'bg-surface-2 text-muted'}">
        {isAcute(category) ? t('grid.counts') : t('grid.notCounted')}
      </span>
    </div>
    <ul class="card flex flex-col p-1">
      {#each medicines as medicine (medicine.names[0])}
        {@const main = mainName(medicine, i18n.lang)}
        {@const others = otherNames(medicine, main)}
        {@const added = inList(displayName(main))}
        <li class="flex min-h-14 items-center gap-3 px-3 py-2">
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="text-sm font-medium">{displayName(main)}{#if others.length}<span class="font-normal text-muted">{' · '}{others.map(displayName).join(', ')}</span>{/if}</span>
            {#if medicine.ingredients.length > 1}<span class="text-xs text-muted">{medicine.ingredients.map((i) => displayName(ingredientName(i, i18n.lang))).join(' + ')}</span>{/if}
            <span class="text-caption text-muted tabular">{medicine.atc}</span>
          </span>
          {#if added}
            <span class="flex shrink-0 items-center gap-1 px-2 text-sm text-muted"><Check size={18} />{t('lookup.inList')}</span>
          {:else}
            <button class="press flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-surface-2 px-3 text-sm font-medium text-primary" aria-label={t('lookup.addNamed', { name: displayName(main) })} onclick={() => add(medicine)}>
              <Plus size={18} />{t('lookup.add')}
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="mt-4 text-sm text-muted">{t('lookup.none')}</p>
  {/each}
  <p class="mt-5 text-caption text-muted">{t('lookup.source')}</p>
</Sheet>
