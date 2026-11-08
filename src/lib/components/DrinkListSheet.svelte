<script lang="ts">
  import { Plus, Trash2 } from '@lucide/svelte';
  import type { DrinkPreset } from '$lib/db';
  import { num, t } from '$lib/i18n.svelte';
  import { data, deleteDrinkPreset, saveDrinkPreset, saveSettings, updateDrinkPreset } from '$lib/store.svelte';
  import OrderButtons from './OrderButtons.svelte';
  import Sheet from './Sheet.svelte';

  const EMOJIS = ['🥛', '🍶', '💧', '☕', '🍵', '🧃', '🥤', '🫖', '🧋', '⚡', '🍺', '🍷', '🥂', '🍹'];

  let openDrink = $state<number | null>(null);

  async function addDrink() {
    await saveDrinkPreset({
      name: t('set.name'),
      emoji: '💧',
      ml: 250,
      order: data.drinkPresets.length ? Math.max(...data.drinkPresets.map((p) => p.order)) + 1 : 0
    });
    openDrink = data.drinkPresets[data.drinkPresets.length - 1]?.id ?? null;
  }

  async function updateDrink(preset: DrinkPreset, patch: Partial<DrinkPreset>) {
    await updateDrinkPreset(preset.id, patch);
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
  <ul class="card flex flex-col p-1">
    {#each data.drinkPresets as preset, i (preset.id)}
      <li class="rounded-xl {openDrink === preset.id ? 'bg-surface-2' : ''}">
        <div class="flex items-center gap-2 py-1 pl-3">
          <button class="press flex flex-1 items-center gap-3 py-2 text-left" onclick={() => (openDrink = openDrink === preset.id ? null : preset.id)}>
            <span class="text-2xl">{preset.emoji}</span>
            <span class="flex min-w-0 flex-col">
              <span class="text-body font-medium">{preset.name} <span class="text-muted tabular">{preset.ml} ml</span></span>
              {#if preset.caffeineMg || preset.alcohol}
                <span class="text-sm text-muted">
                  {[preset.caffeineMg ? t('drink.caffeineShort', { mg: preset.caffeineMg }) : '', preset.alcohol ? t('drink.alcohol') : ''].filter(Boolean).join(' · ')}
                </span>
              {/if}
            </span>
          </button>
          <OrderButtons list={data.drinkPresets} index={i} table="drinkPresets" />
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
            <label class="flex flex-col gap-1 text-xs text-muted">
              {t('drink.caffeine')}
              <input
                class="bg-surface"
                type="number"
                inputmode="numeric"
                min="0"
                step="10"
                placeholder="0"
                value={preset.caffeineMg ?? ''}
                onchange={(e) => updateDrink(preset, { caffeineMg: Math.max(0, Math.round(Number(e.currentTarget.value))) || undefined })}
              />
            </label>
            <label class="flex items-end gap-2 pb-2.5">
              <input
                type="checkbox"
                class="size-6 accent-primary"
                checked={preset.alcohol ?? false}
                onchange={(e) => updateDrink(preset, { alcohol: e.currentTarget.checked || undefined })}
              />
              {t('drink.alcohol')}
            </label>
            {#if preset.alcohol}<p class="col-span-2 -mt-1 text-sm text-muted">{t('drink.alcoholHint')}</p>{/if}
            <div class="col-span-2 flex flex-wrap items-center gap-1">
              {#each EMOJIS as emoji (emoji)}
                <button class="press grid size-11 place-items-center rounded-full text-2xl {preset.emoji === emoji ? 'bg-surface' : ''}" onclick={() => updateDrink(preset, { emoji })}>
                  {emoji}
                </button>
              {/each}
              <button class="press ml-auto grid size-11 place-items-center rounded-full text-over" onclick={() => deleteDrinkPreset(preset.id)} aria-label={t('edit.delete')}>
                <Trash2 size={22} />
              </button>
            </div>
          </div>
        {/if}
      </li>
    {/each}
    <li>
      <button class="press flex min-h-12 w-full items-center gap-2 rounded-xl px-3 py-3 font-medium text-primary" onclick={addDrink}>
        <Plus size={22} />{t('set.addDrink')}
      </button>
    </li>
  </ul>
</Sheet>
