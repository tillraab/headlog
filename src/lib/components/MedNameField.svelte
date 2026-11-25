<script lang="ts">
  /**
   * The name field of a medication: known medications as suggestions while typing, and under it what the name is
   * recognised as. A suggestion sets name and class together; a typed name is saved when the field is left.
   */
  import type { Medication } from '$lib/db';
  import { i18n, t } from '$lib/i18n.svelte';
  import { recognise, type MedCategory } from '$lib/medication';
  import { displayName, ingredientName, suggestMedicines, type MedicineMatch } from '$lib/medicines';

  let {
    med,
    onrename,
    onpick
  }: {
    med: Medication;
    /** A typed name, saved when the field is left. */
    onrename: (name: string) => void;
    /** A suggestion: its name and class. */
    onpick: (name: string, category: MedCategory) => void;
  } = $props();

  const id = $props.id();
  /** What is typed, until it is the saved name. */
  let edited = $state<string | null>(null);
  const text = $derived(edited ?? med.name);
  let typing = $state(false);
  let active = $state(0);
  /** The name a suggestion saved, so leaving the field afterwards does not save it again. */
  let picked = '';

  const suggestions = $derived(typing ? suggestMedicines(text) : []);
  const recognised = $derived(recognise(text));

  function ingredients(list: string[]): string {
    return list.map((i) => ingredientName(i, i18n.lang)).join(' + ');
  }

  function pick(match: MedicineMatch) {
    edited = picked = displayName(match.name);
    typing = false;
    onpick(edited, match.medicine.category);
  }

  function commit() {
    typing = false;
    const name = text.trim();
    if (!name) edited = null;
    else if (name !== med.name && name !== picked) onrename(name);
  }

  function keydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' && suggestions.length) active = (active + 1) % suggestions.length;
    else if (e.key === 'ArrowUp' && suggestions.length) active = (active - 1 + suggestions.length) % suggestions.length;
    else if (e.key === 'Enter' && suggestions.length) pick(suggestions[active]);
    else if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
    else if (e.key === 'Escape' && suggestions.length) typing = false;
    else return;
    e.preventDefault();
  }

  /** Leaving the field for a suggestion is not leaving it. */
  function focusout(e: FocusEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) commit();
  }
</script>

<div class="col-span-2 flex flex-col gap-1" onfocusout={focusout}>
  <label class="flex flex-col gap-1 text-xs text-muted">
    {t('set.name')}
    <input
      class="bg-surface"
      value={text}
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      aria-expanded={suggestions.length > 0}
      aria-controls="{id}-list"
      aria-activedescendant={suggestions.length ? `${id}-${active}` : undefined}
      oninput={(e) => {
        edited = e.currentTarget.value;
        picked = '';
        typing = true;
        active = 0;
      }}
      onkeydown={keydown}
    />
  </label>
  {#if suggestions.length}
    <ul id="{id}-list" role="listbox" aria-label={t('set.suggestions')} class="card flex flex-col overflow-hidden p-1">
      {#each suggestions as match, i (match.name)}
        <li
          id="{id}-{i}"
          role="option"
          aria-selected={i === active}
          tabindex="-1"
          class="press flex min-h-11 cursor-pointer flex-col justify-center rounded-lg px-3 py-1.5 {i === active ? 'bg-surface-2' : ''}"
          onclick={() => pick(match)}
          onkeydown={(e) => e.key === 'Enter' && pick(match)}
        >
          <span class="text-sm font-medium">{displayName(match.name)}</span>
          <span class="text-xs text-muted">{ingredients(match.medicine.ingredients)} · {t(`cat.${match.medicine.category}`)}</span>
        </li>
      {/each}
    </ul>
  {:else if recognised}
    <p class="text-xs text-muted">{t('set.recognised', { what: `${ingredients(recognised.ingredients)} · ${t(`cat.${recognised.category}`)}` })}</p>
  {:else if med.category === 'unknown'}
    <p class="text-xs text-caution">{t('set.unrecognised')}</p>
  {/if}
</div>
