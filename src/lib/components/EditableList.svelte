<script lang="ts" generics="T extends { id: number; order: number; name: string }">
  /**
   * One of the user's own lists (medications, drinks): each entry folds open to edit it, moves up and down, and can be
   * deleted with an undo; "Add" puts a new entry at the end and opens it.
   */
  import { Plus, Trash2 } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import { t } from '$lib/i18n.svelte';
  import { removeFromList, type ListTable } from '$lib/store.svelte';
  import { toast } from '$lib/ui.svelte';
  import OrderButtons from './OrderButtons.svelte';

  let {
    items,
    table,
    addLabel,
    onadd,
    summary,
    details
  }: {
    items: T[];
    table: ListTable;
    addLabel: string;
    /** Adds an entry and returns its id. */
    onadd: () => Promise<number>;
    /** The folded entry. */
    summary: Snippet<[T]>;
    /** The fields of the open entry. */
    details: Snippet<[T]>;
  } = $props();

  let open = $state<number | null>(null);

  async function add() {
    open = await onadd();
  }

  async function remove(item: T) {
    toast(t('toast.removed', { name: item.name }), await removeFromList(table, item.id));
  }
</script>

<ul class="card flex flex-col p-1">
  {#each items as item, i (item.id)}
    <li class="rounded-xl {open === item.id ? 'bg-surface-2' : ''}">
      <div class="flex items-center gap-2 py-1 pl-3">
        <button class="press flex min-w-0 flex-1 items-center gap-3 py-2 text-left" onclick={() => (open = open === item.id ? null : item.id)}>
          {@render summary(item)}
        </button>
        <OrderButtons list={items} index={i} {table} />
      </div>
      {#if open === item.id}
        <div class="flex flex-col gap-2 px-3 pb-3">
          {@render details(item)}
          <button class="press btn-quiet flex items-center gap-1.5 self-end text-over" onclick={() => remove(item)}>
            <Trash2 size={18} />{t('edit.delete')}
          </button>
        </div>
      {/if}
    </li>
  {/each}
  <li>
    <button class="press flex min-h-12 w-full items-center gap-2 rounded-xl px-3 py-3 font-medium text-primary" onclick={add}>
      <Plus size={22} />{addLabel}
    </button>
  </li>
</ul>
