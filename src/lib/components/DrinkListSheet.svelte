<script lang="ts">
  import type { DrinkPreset } from '$lib/db';
  import { num, t } from '$lib/i18n.svelte';
  import { addToList, data, saveSettings, updateInList } from '$lib/store.svelte';
  import EditableList from './EditableList.svelte';
  import Sheet from './Sheet.svelte';

  const EMOJIS = ['🥛', '🍶', '💧', '☕', '🍵', '🧃', '🥤', '🫖', '🧋', '⚡', '🍺', '🍷', '🥂', '🍹'];

  function addDrink() {
    return addToList('drinkPresets', { name: t('set.name'), emoji: '💧', ml: 250 });
  }

  function updateDrink(drink: DrinkPreset, patch: Partial<DrinkPreset>) {
    return updateInList('drinkPresets', drink.id, patch);
  }
</script>

<Sheet id="drinkList" title={t('set.drinks')} info={t('set.drinksHint')}>
  <div class="card mb-4 p-4">
    <label class="flex items-center justify-between gap-4 text-body">
      {t('set.waterGoal')}
      <select class="w-28" value={data.settings.waterGoalMl} onchange={(e) => saveSettings({ waterGoalMl: Number(e.currentTarget.value) })}>
        {#each [1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3500, 4000] as ml (ml)}
          <option value={ml}>{num(ml / 1000, 0, 2)} l</option>
        {/each}
      </select>
    </label>
  </div>
  <EditableList items={data.drinkPresets} table="drinkPresets" addLabel={t('set.addDrink')} onadd={addDrink}>
    {#snippet summary(drink: DrinkPreset)}
    <span class="text-2xl">{drink.emoji}</span>
    <span class="flex min-w-0 flex-col">
      <span class="text-body font-medium">{drink.name} <span class="text-muted tabular">{drink.ml} ml</span></span>
      {#if drink.caffeineMg || drink.alcohol}
        <span class="text-sm text-muted">
          {[drink.caffeineMg ? t('drink.caffeineShort', { mg: drink.caffeineMg }) : '', drink.alcohol ? t('drink.alcohol') : ''].filter(Boolean).join(' · ')}
        </span>
      {/if}
    </span>
    {/snippet}
    {#snippet details(drink: DrinkPreset)}
    <div class="grid grid-cols-2 gap-2">
      <label class="flex flex-col gap-1 text-xs text-muted">
        {t('set.name')}
        <input class="bg-surface" value={drink.name} onchange={(e) => updateDrink(drink, { name: e.currentTarget.value.trim() || drink.name })} />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted">
        ml
        <input class="bg-surface" type="number" inputmode="numeric" min="10" step="50" value={drink.ml} onchange={(e) => updateDrink(drink, { ml: Math.max(10, Number(e.currentTarget.value) || drink.ml) })} />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted">
        {t('drink.caffeine')}
        <input
          class="bg-surface"
          type="number"
          inputmode="numeric"
          min="0"
          step="10"
          placeholder="0"
          value={drink.caffeineMg ?? ''}
          onchange={(e) => updateDrink(drink, { caffeineMg: Math.max(0, Math.round(Number(e.currentTarget.value))) || undefined })}
        />
      </label>
      <label class="flex items-end gap-2 pb-2.5">
        <input
          type="checkbox"
          class="size-6 accent-primary"
          checked={drink.alcohol ?? false}
          onchange={(e) => updateDrink(drink, { alcohol: e.currentTarget.checked || undefined })}
        />
        {t('drink.alcohol')}
      </label>
      {#if drink.alcohol}<p class="col-span-2 -mt-1 text-sm text-muted">{t('drink.alcoholHint')}</p>{/if}
      <div class="col-span-2 flex flex-wrap items-center gap-1">
        {#each EMOJIS as emoji (emoji)}
          <button class="press grid size-11 place-items-center rounded-full text-2xl {drink.emoji === emoji ? 'bg-surface' : ''}" onclick={() => updateDrink(drink, { emoji })}>
            {emoji}
          </button>
        {/each}
      </div>
    </div>
    {/snippet}
  </EditableList>
</Sheet>
