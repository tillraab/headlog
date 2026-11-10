<script lang="ts">
  /** Shows a date range with its number of days; a tap opens the range picker. */
  import { CalendarRange } from '@lucide/svelte';
  import { keyToDate, rangeDayCount } from '$lib/days';
  import { fmt, t } from '$lib/i18n.svelte';
  import { pickRange, tap } from '$lib/ui.svelte';

  let { from, to, onpick }: { from: string; to: string; onpick: (range: { from: string; to: string }) => void } = $props();

  const n = $derived(rangeDayCount(from, to));
</script>

<button
  class="press flex min-h-11 w-full items-center gap-2 rounded-xl bg-surface-2 px-3 text-left text-sm"
  aria-haspopup="dialog"
  onclick={() => {
    tap();
    pickRange(from, to, onpick);
  }}
>
  <CalendarRange size={18} class="shrink-0 text-muted" />
  <span class="min-w-0 flex-1 truncate font-medium tabular">{fmt(keyToDate(from), 'd. MMM yyyy')} – {fmt(keyToDate(to), 'd. MMM yyyy')}</span>
  <span class="shrink-0 text-muted tabular">{t(n === 1 ? 'range.day' : 'range.days', { n })}</span>
</button>
