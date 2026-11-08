<script lang="ts">
  import { conflictingOngoing } from '$lib/analysis';
  import { RELIEFS, type Night } from '$lib/db';
  import { fromPreset } from '$lib/drinks';
  import { fromMedication } from '$lib/medication';
  import { editor } from '$lib/editor.svelte';
  import { reliefLabels, t, tagLabel, TAGS } from '$lib/i18n.svelte';
  import { manualNight } from '$lib/sleep';
  import { data, remove, saveDrink, saveEpisode, saveIntake, saveNight, type EntryTable } from '$lib/store.svelte';
  import { closeSheet, fromLocalInput, toast, toLocalInput } from '$lib/ui.svelte';
  import IntensityPicker from './IntensityPicker.svelte';
  import SleepTimeline from './SleepTimeline.svelte';
  import Sheet from './Sheet.svelte';
  import { MINUTE } from '$lib/days';

  const current = $derived(editor.current);
  const title = $derived(
    current?.kind === 'episode' ? t('edit.headache') : current?.kind === 'intake' ? t('edit.intake') : current?.kind === 'sleep' ? t('sleep.title') : t('edit.drink')
  );
  let error = $state('');

  /** The time in a datetime field. A cleared or invalid field shows `current` again and keeps it. */
  function readTime(input: HTMLInputElement, current: number): number {
    const time = fromLocalInput(input.value);
    if (time !== null) return time;
    input.value = toLocalInput(current);
    return current;
  }

  function close() {
    error = '';
    closeSheet('editor');
  }

  async function save() {
    const c = editor.current;
    if (!c) return;
    const times = c.kind === 'episode' ? [c.item.start, c.item.end ?? 0] : c.kind === 'sleep' ? [c.item.start, c.item.end] : [c.item.time];
    if (!times.every(Number.isFinite)) {
      error = t('edit.invalidTime');
      return;
    }
    if (c.kind === 'episode') {
      if (c.item.end !== null && c.item.end <= c.item.start) {
        error = t('edit.endBeforeStart');
        return;
      }
      if (conflictingOngoing(data.episodes, c.item)) {
        error = t('edit.otherOngoing');
        return;
      }
      await saveEpisode(c.item);
    } else if (c.kind === 'intake') {
      const med = data.medications.find((m) => m.id === c.item.medId);
      if (med && c.item.id === undefined) Object.assign(c.item, fromMedication(med));
      await saveIntake(c.item);
    } else if (c.kind === 'sleep') {
      if (c.item.end <= c.item.start) {
        error = t('edit.endBeforeStart');
        return;
      }
      await saveNight(manualNight(c.item.day, c.item.start, c.item.end, c.item.breaks));
    } else {
      await saveDrink(c.item);
    }
    toast(t('toast.saved'));
    close();
  }

  async function del() {
    const c = editor.current;
    if (!c || c.kind === 'sleep' || c.item.id === undefined) return;
    const table: EntryTable = c.kind === 'episode' ? 'episodes' : c.kind === 'intake' ? 'intakes' : 'drinks';
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

<Sheet id="editor" {title} info={current?.kind === 'sleep' ? [t('sleep.dragHint'), t('sleep.editHint')] : undefined}>
  {#if current}
    <div class="flex flex-col gap-4">
      {#if current.kind === 'episode'}
        {@const ep = current.item}
        <label class="flex flex-col gap-1">
          <span class="text-sm text-muted">{t('edit.start')}</span>
          <input type="datetime-local" value={toLocalInput(ep.start)} onchange={(e) => (ep.start = readTime(e.currentTarget, ep.start))} />
        </label>
        <label class="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            class="size-6 accent-primary"
            checked={ep.end === null}
            onchange={(e) => (ep.end = e.currentTarget.checked ? null : Math.max(Date.now(), ep.start + MINUTE))}
          />
          {t('edit.ongoing')}
        </label>
        {#if ep.end !== null}
          <label class="flex flex-col gap-1">
            <span class="text-sm text-muted">{t('edit.end')}</span>
            <input type="datetime-local" value={toLocalInput(ep.end)} onchange={(e) => (ep.end = readTime(e.currentTarget, ep.end ?? ep.start))} />
          </label>
        {/if}
        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted">{t('today.intensity')}</span>
          <IntensityPicker value={ep.intensity} onchange={(v) => (ep.intensity = v)} />
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted">{t('edit.tags')}</span>
          <div class="flex flex-wrap gap-2">
            {#each TAGS as tag (tag)}
              <button
                class="press min-h-11 rounded-full px-4 py-2 {ep.tags.includes(tag) ? 'bg-primary text-primary-fg' : 'bg-surface-2'}"
                onclick={() => toggleTag(tag)}>{tagLabel(tag)}</button
              >
            {/each}
          </div>
        </div>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-muted">{t('edit.note')}</span>
          <textarea rows="2" bind:value={ep.note} placeholder={t('edit.notePlaceholder')}></textarea>
        </label>
      {:else if current.kind === 'intake'}
        {@const intake = current.item}
        {#if intake.id === undefined}
          <label class="flex flex-col gap-1">
            <span class="text-sm text-muted">{t('edit.intake')}</span>
            <select bind:value={intake.medId}>
              {#each data.medications as med (med.id)}
                <option value={med.id}>{med.name} {med.dose}</option>
              {/each}
            </select>
          </label>
        {:else}
          <p class="text-body font-medium">{intake.name} <span class="text-muted">{intake.dose}</span></p>
        {/if}
        <label class="flex flex-col gap-1">
          <span class="text-sm text-muted">{t('edit.time')}</span>
          <input type="datetime-local" value={toLocalInput(intake.time)} onchange={(e) => (intake.time = readTime(e.currentTarget, intake.time))} />
        </label>
        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted">{t('edit.relief')}</span>
          <div class="grid grid-cols-3 gap-2">
            {#each RELIEFS as r (r)}
              <button
                class="press min-h-11 rounded-xl py-2.5 {intake.relief === r ? 'bg-primary text-primary-fg' : 'bg-surface-2'}"
                onclick={() => (intake.relief = intake.relief === r ? null : r)}>{reliefLabels()[r]}</button
              >
            {/each}
          </div>
        </div>
      {:else if current.kind === 'sleep'}
        {#key current.item.day}
          <SleepTimeline
            bind:night={
              () => current.item as Night,
              (night) => {
                if (editor.current?.kind === 'sleep') editor.current.item = night;
              }
            }
          />
        {/key}
      {:else}
        {@const drink = current.item}
        {#if drink.id === undefined}
          <div class="grid grid-cols-4 gap-2">
            {#each data.drinkPresets as p (p.id)}
              <button
                class="press flex min-w-0 flex-col items-center rounded-xl py-2 text-sm {drink.presetId === p.id ? 'bg-primary text-primary-fg' : 'bg-surface-2'}"
                onclick={() => Object.assign(drink, fromPreset(p))}
              >
                <span class="text-2xl">{p.emoji}</span><span class="max-w-full truncate px-1">{p.name}</span>
              </button>
            {/each}
          </div>
        {:else}
          <p class="text-body font-medium">{drink.emoji} {drink.name}</p>
        {/if}
        <label class="flex flex-col gap-1">
          <span class="text-sm text-muted">{t('edit.amount')}</span>
          <input type="number" inputmode="numeric" min="0" step="50" bind:value={drink.ml} />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-muted">{t('edit.time')}</span>
          <input type="datetime-local" value={toLocalInput(drink.time)} onchange={(e) => (drink.time = readTime(e.currentTarget, drink.time))} />
        </label>
      {/if}

      {#if error}<p class="text-over">{error}</p>{/if}

      <div class="mt-2 flex gap-2">
        {#if current.kind !== 'sleep' && current.item.id !== undefined}
          <button class="press rounded-2xl px-4 py-3 font-medium text-over" onclick={del}>{t('edit.delete')}</button>
        {/if}
        <button class="press ml-auto rounded-2xl px-4 py-3 font-medium" onclick={close}>{t('edit.cancel')}</button>
        <button class="press rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-fg" onclick={save}>{t('edit.save')}</button>
      </div>
    </div>
  {/if}
</Sheet>
