<script lang="ts">
  import { ArrowDown, ArrowUp } from '@lucide/svelte';
  import { t } from '$lib/i18n.svelte';
  import { swapOrder } from '$lib/store.svelte';

  /** Up and down buttons that swap an entry with its neighbour in a sorted list. */
  let { list, index, table }: { list: { id: number; order: number }[]; index: number; table: 'medications' | 'drinkPresets' } = $props();
</script>

<button class="press grid size-11 place-items-center rounded-full disabled:opacity-30" disabled={index === 0} onclick={() => swapOrder(table, list[index], list[index - 1])} aria-label={t('a11y.up')}>
  <ArrowUp size={20} />
</button>
<button
  class="press grid size-11 place-items-center rounded-full disabled:opacity-30"
  disabled={index === list.length - 1}
  onclick={() => swapOrder(table, list[index], list[index + 1])}
  aria-label={t('a11y.down')}
>
  <ArrowDown size={20} />
</button>
