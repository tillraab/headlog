<script lang="ts">
  import { showInfo, tap, type InfoPart } from '$lib/ui.svelte';

  /**
   * One limit as a compact row: name, count against the limit and a bar that runs a little past the
   * limit, like the ring of the main limit. A tap explains the limit.
   */
  let {
    count,
    limit,
    title,
    sub,
    color,
    info,
    sources = []
  }: { count: number; limit: number; title: string; sub: string; color: string; info: InfoPart[]; sources?: readonly string[] } = $props();

  const OVERRUN = 1.25;
  const fill = $derived(Math.min(1, count / (limit * OVERRUN)));
</script>

<button
  class="press flex min-h-11 w-full flex-col gap-1.5 rounded-xl px-1 py-1.5 text-left"
  aria-haspopup="dialog"
  onclick={() => {
    tap();
    showInfo(title, info, sources);
  }}
>
  <span class="flex w-full items-baseline gap-2">
    <span class="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
    <span class="shrink-0 text-xs text-muted">{sub}</span>
    <span class="w-12 shrink-0 text-right text-sm font-semibold tabular" style:color>{count}<span class="text-xs text-muted">/{limit}</span></span>
  </span>
  <span class="relative h-2 w-full overflow-hidden rounded-full bg-surface-2">
    <span class="absolute inset-y-0 right-0 bg-over/25" style:width="{(1 - 1 / OVERRUN) * 100}%"></span>
    <span class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style:width="{fill * 100}%" style:background-color={color}></span>
  </span>
</button>
