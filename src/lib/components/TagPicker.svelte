<script lang="ts">
  /**
   * Symptoms and triggers of a headache from the user's own list. "Add" takes a new one, typed or picked from the
   * built-in ideas, puts it on the list and ticks it; "Edit" removes tags from the list, not from earlier headaches.
   */
  import { Plus, X } from '@lucide/svelte';
  import { t, tagLabel } from '$lib/i18n.svelte';
  import { data, saveSettings } from '$lib/store.svelte';
  import { myTags, tagFromText, tagIdeas } from '$lib/tags';

  let { selected, onchange }: { selected: string[]; onchange: (tags: string[]) => void } = $props();

  const list = $derived(myTags(data.settings.tags, data.episodes));
  /** The list, plus tags of this headache that were removed from it since. */
  const shown = $derived([...list, ...selected.filter((tag) => !list.includes(tag))]);
  let adding = $state(false);
  let editing = $state(false);
  let text = $state('');
  let field = $state<HTMLInputElement>();
  /** The text field takes the keyboard as soon as it opens. */
  $effect(() => {
    if (adding) field?.focus();
  });

  function toggle(tag: string) {
    onchange(selected.includes(tag) ? selected.filter((x) => x !== tag) : [...selected, tag]);
  }

  function add(tag: string) {
    if (!tag) return;
    if (!list.includes(tag)) void saveSettings({ tags: [...list, tag] });
    if (!selected.includes(tag)) onchange([...selected, tag]);
    text = '';
    adding = false;
  }

  function remove(tag: string) {
    void saveSettings({ tags: list.filter((x) => x !== tag) });
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center justify-between">
    <span class="text-sm text-muted">{t('edit.tags')}</span>
    {#if list.length}
      <button class="press min-h-9 px-1 text-sm font-medium text-primary" onclick={() => ((editing = !editing), (adding = false))}>
        {editing ? t('tags.done') : t('tags.edit')}
      </button>
    {/if}
  </div>
  <div class="flex flex-wrap gap-2">
    {#each shown as tag (tag)}
      {#if editing}
        <button class="press flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 py-2 pr-3 pl-4" onclick={() => remove(tag)} aria-label={t('tags.remove', { tag: tagLabel(tag) })}>
          {tagLabel(tag)}<X size={16} class="text-over" />
        </button>
      {:else}
        <button
          class="press min-h-11 rounded-full px-4 py-2 {selected.includes(tag) ? 'bg-primary text-primary-fg' : 'bg-surface-2'}"
          aria-pressed={selected.includes(tag)}
          onclick={() => toggle(tag)}>{tagLabel(tag)}</button
        >
      {/if}
    {/each}
    {#if !editing && !adding}
      <button class="press flex min-h-11 items-center gap-1 rounded-full border border-dashed border-line px-4 py-2 text-muted" onclick={() => (adding = true)}>
        <Plus size={16} />{t('tags.add')}
      </button>
    {/if}
  </div>
  {#if !list.length && !adding}
    <p class="text-sm text-muted">{t('tags.empty')}</p>
  {/if}
  {#if adding}
    <div class="flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
      <form class="flex gap-2" onsubmit={(e) => (e.preventDefault(), add(tagFromText(text)))}>
        <input class="min-w-0 flex-1 bg-surface" bind:this={field} bind:value={text} placeholder={t('tags.placeholder')} />
        <button class="press btn-primary disabled:opacity-50" disabled={!text.trim()}>{t('tags.addButton')}</button>
      </form>
      {#if tagIdeas(list).length}
        <span class="text-xs text-muted">{t('tags.ideas')}</span>
        <div class="flex flex-wrap gap-1.5">
          {#each tagIdeas(list) as tag (tag)}
            <button class="press min-h-9 rounded-full bg-surface px-3 py-1 text-sm" onclick={() => add(tag)}>+ {tagLabel(tag)}</button>
          {/each}
        </div>
      {/if}
      <button class="press min-h-9 self-end px-1 text-sm font-medium" onclick={() => ((adding = false), (text = ''))}>{t('edit.cancel')}</button>
    </div>
  {/if}
</div>
