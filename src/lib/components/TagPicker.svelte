<script lang="ts">
  /**
   * Symptoms and triggers of a headache as a checklist from the user's own list. "Add" takes new words, puts them on
   * the list and ticks them; "Edit" removes entries from the list, not from earlier headaches.
   */
  import { Plus, Trash2 } from '@lucide/svelte';
  import { t } from '$lib/i18n.svelte';
  import { data, saveSettings } from '$lib/store.svelte';
  import { myTags, withTag } from '$lib/tags';

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

  function add() {
    const next = withTag(list, text);
    if (!next.tag) return;
    if (next.list !== list) void saveSettings({ tags: next.list });
    if (!selected.includes(next.tag)) onchange([...selected, next.tag]);
    text = '';
    adding = false;
  }

  function remove(tag: string) {
    void saveSettings({ tags: list.filter((x) => x !== tag) });
  }
</script>

<div class="flex flex-col gap-1">
  <div class="flex items-center justify-between">
    <span class="text-sm text-muted">{t('edit.tags')}</span>
    {#if list.length}
      <button class="press min-h-9 px-1 text-sm font-medium text-primary" onclick={() => ((editing = !editing), (adding = false))}>
        {editing ? t('tags.done') : t('tags.edit')}
      </button>
    {/if}
  </div>
  {#if shown.length}
    <ul class="flex flex-col rounded-xl bg-surface-2 px-3">
      {#each shown as tag, i (tag)}
        <li class="flex min-h-12 items-center gap-3 {i ? 'border-t border-line' : ''}">
          {#if editing}
            <span class="flex-1">{tag}</span>
            <button class="press -mr-2 grid size-11 place-items-center text-over" onclick={() => remove(tag)} aria-label={t('tags.remove', { tag })}>
              <Trash2 size={18} />
            </button>
          {:else}
            <label class="flex flex-1 cursor-pointer items-center gap-3 py-2">
              <input type="checkbox" class="size-6 accent-primary" checked={selected.includes(tag)} onchange={() => toggle(tag)} />
              {tag}
            </label>
          {/if}
        </li>
      {/each}
    </ul>
  {:else if !adding}
    <p class="text-sm text-muted">{t('tags.empty')}</p>
  {/if}
  {#if adding}
    <form class="mt-1 flex gap-2" onsubmit={(e) => (e.preventDefault(), add())}>
      <input class="min-w-0 flex-1" bind:this={field} bind:value={text} placeholder={t('tags.placeholder')} />
      <button class="press btn-primary disabled:opacity-50" disabled={!text.trim()}>{t('tags.addButton')}</button>
      <button type="button" class="press min-h-11 px-2 text-sm font-medium" onclick={() => ((adding = false), (text = ''))}>{t('edit.cancel')}</button>
    </form>
  {:else if !editing}
    <button class="press mt-1 flex min-h-11 items-center gap-1 self-start px-1 font-medium text-primary" onclick={() => (adding = true)}>
      <Plus size={18} />{t('tags.add')}
    </button>
  {/if}
</div>
