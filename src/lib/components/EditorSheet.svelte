<script lang="ts">
  import { fromPreset } from '$lib/db';
  import { editor } from '$lib/editor.svelte';
  import { t, tagLabel, TAGS } from '$lib/i18n.svelte';
  import { data, remove, saveDrink, saveEpisode, saveIntake } from '$lib/store.svelte';
  import { closeSheet, fromLocalInput, toast, toLocalInput } from '$lib/ui.svelte';
  import IntensityPicker from './IntensityPicker.svelte';
  import Sheet from './Sheet.svelte';

  const current = $derived(editor.current);
  const title = $derived(
    current?.kind === 'episode' ? t('edit.headache') : current?.kind === 'intake' ? t('edit.intake') : t('edit.drink')
  );
  let error = $state('');

  function close() {
    error = '';
    closeSheet('editor');
  }

  async function save() {
    const c = editor.current;
    if (!c) return;
    if (c.kind === 'episode') {
      if (c.item.end !== null && c.item.end <= c.item.start) {
        error = t('edit.endBeforeStart');
        return;
      }
      await saveEpisode(c.item);
    } else if (c.kind === 'intake') {
      const med = data.medications.find((m) => m.id === c.item.medId);
      if (med && c.item.id === undefined) Object.assign(c.item, { name: med.name, dose: med.dose, category: med.category });
      await saveIntake(c.item);
    } else {
      await saveDrink(c.item);
    }
    toast(t('toast.saved'));
    close();
  }

  async function del() {
    const c = editor.current;
    if (!c || c.item.id === undefined) return;
    const table = c.kind === 'episode' ? 'episodes' : c.kind === 'intake' ? 'intakes' : 'drinks';
    const undo = await remove(table, c.item.id);
    toast(t('toast.deleted'), undo);
    close();
  }

  function toggleTag(tag: string) {
    if (editor.current?.kind !== 'episode') return;
    const tags = editor.current.item.tags;
    editor.current.item.tags = tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag];
  }
</script>

<Sheet id="editor" {title}>
  {#if current}
    <div class="flex flex-col gap-4">
      {#if current.kind === 'episode'}
        {@const ep = current.item}
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted">{t('edit.start')}</span>
          <input type="datetime-local" value={toLocalInput(ep.start)} onchange={(e) => (ep.start = fromLocalInput(e.currentTarget.value))} />
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            class="size-5 accent-primary"
            checked={ep.end === null}
            onchange={(e) => (ep.end = e.currentTarget.checked ? null : Math.max(Date.now(), ep.start + 60000))}
          />
          {t('edit.ongoing')}
        </label>
        {#if ep.end !== null}
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted">{t('edit.end')}</span>
            <input type="datetime-local" value={toLocalInput(ep.end)} onchange={(e) => (ep.end = fromLocalInput(e.currentTarget.value))} />
          </label>
        {/if}
        <div class="flex flex-col gap-2 text-sm">
          <span class="text-muted">{t('today.intensity')}</span>
          <IntensityPicker value={ep.intensity} onchange={(v) => (ep.intensity = v)} />
        </div>
        <div class="flex flex-col gap-2 text-sm">
          <span class="text-muted">{t('edit.tags')}</span>
          <div class="flex flex-wrap gap-2">
            {#each TAGS as tag (tag)}
              <button
                class="press rounded-full px-3 py-1.5 text-sm {ep.tags.includes(tag) ? 'bg-primary text-primary-fg' : 'bg-surface-2'}"
                onclick={() => toggleTag(tag)}>{tagLabel(tag)}</button
              >
            {/each}
          </div>
        </div>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted">{t('edit.note')}</span>
          <textarea rows="2" bind:value={ep.note} placeholder={t('edit.notePlaceholder')}></textarea>
        </label>
      {:else if current.kind === 'intake'}
        {@const intake = current.item}
        {#if intake.id === undefined}
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted">{t('edit.intake')}</span>
            <select bind:value={intake.medId}>
              {#each data.medications as med (med.id)}
                <option value={med.id}>{med.name} {med.dose}</option>
              {/each}
            </select>
          </label>
        {:else}
          <p class="text-body font-medium">{intake.name} <span class="text-muted">{intake.dose}</span></p>
        {/if}
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted">{t('edit.time')}</span>
          <input type="datetime-local" value={toLocalInput(intake.time)} onchange={(e) => (intake.time = fromLocalInput(e.currentTarget.value))} />
        </label>
        <div class="flex flex-col gap-2 text-sm">
          <span class="text-muted">{t('edit.relief')}</span>
          <div class="grid grid-cols-3 gap-2">
            {#each [t('edit.reliefNone'), t('edit.reliefSome'), t('edit.reliefGood')] as label, i (i)}
              <button
                class="press rounded-xl py-2.5 {intake.relief === i ? 'bg-primary text-primary-fg' : 'bg-surface-2'}"
                onclick={() => (intake.relief = intake.relief === i ? null : i)}>{label}</button
              >
            {/each}
          </div>
        </div>
      {:else}
        {@const drink = current.item}
        {#if drink.id === undefined}
          <div class="grid grid-cols-4 gap-2">
            {#each data.drinkPresets as p (p.id)}
              <button
                class="press flex flex-col items-center rounded-xl py-2 text-xs {drink.presetId === p.id ? 'bg-primary text-primary-fg' : 'bg-surface-2'}"
                onclick={() => Object.assign(drink, fromPreset(p))}
              >
                <span class="text-xl">{p.emoji}</span>{p.name}
              </button>
            {/each}
          </div>
        {:else}
          <p class="text-body font-medium">{drink.emoji} {drink.name}</p>
        {/if}
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted">{t('edit.amount')}</span>
          <input type="number" inputmode="numeric" min="0" step="50" bind:value={drink.ml} />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted">{t('edit.time')}</span>
          <input type="datetime-local" value={toLocalInput(drink.time)} onchange={(e) => (drink.time = fromLocalInput(e.currentTarget.value))} />
        </label>
      {/if}

      {#if error}<p class="text-sm text-over">{error}</p>{/if}

      <div class="mt-2 flex gap-2">
        {#if current.item.id !== undefined}
          <button class="press rounded-2xl px-4 py-3 font-medium text-over" onclick={del}>{t('edit.delete')}</button>
        {/if}
        <button class="press ml-auto rounded-2xl px-4 py-3 font-medium" onclick={close}>{t('edit.cancel')}</button>
        <button class="press rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-fg" onclick={save}>{t('edit.save')}</button>
      </div>
    </div>
  {/if}
</Sheet>
