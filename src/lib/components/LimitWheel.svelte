<script lang="ts">
  import { Info } from '@lucide/svelte';
  import { showInfo, tap, type InfoPart } from '$lib/ui.svelte';

  /**
   * A day count against its limit as a large three-quarter ring, with the limit's name and a line on
   * why this limit applies below; a tap explains the limit.
   */
  let {
    count,
    limit,
    title,
    note,
    color,
    info,
    sources = []
  }: { count: number; limit: number; title: string; note: string; color: string; info: InfoPart[]; sources?: readonly string[] } = $props();

  const R = 40;
  const C = 2 * Math.PI * R;
  const ARC = 0.75;
  /** The ring runs a little past the limit, so being over it stays visible. */
  const OVERRUN = 1.25;
  const fill = $derived(Math.min(1, count / (limit * OVERRUN)));
  const limitAt = 1 / OVERRUN;
</script>

<button
  class="press relative flex w-full flex-col items-center rounded-2xl bg-surface-2 px-3 pt-3 pb-3"
  aria-haspopup="dialog"
  onclick={() => {
    tap();
    showInfo(title, info, sources);
  }}
>
  <Info size={20} class="absolute top-3 right-3 text-muted" />
  <div class="relative size-36">
    <svg viewBox="0 0 100 100" class="size-full rotate-135">
      <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-surface)" stroke-width="8" stroke-linecap="round" stroke-dasharray="{C * ARC} {C}" />
      <circle
        cx="50"
        cy="50"
        r={R}
        fill="none"
        stroke="var(--color-over)"
        stroke-opacity="0.25"
        stroke-width="8"
        stroke-dasharray="0 {C * ARC * limitAt} {C * ARC * (1 - limitAt)} {C}"
      />
      <circle cx="50" cy="50" r={R} fill="none" stroke={color} stroke-width="8" stroke-linecap="round" stroke-dasharray="{Math.max(0.001, C * ARC * fill)} {C}" class="transition-all duration-700" />
    </svg>
    <p class="absolute inset-0 flex items-center justify-center pt-1 text-4xl font-semibold tabular" style:color>
      {count}<span class="text-lg text-muted">/{limit}</span>
    </p>
  </div>
  <p class="-mt-5 text-center font-semibold">{title}</p>
  <p class="text-center text-sm text-muted">{note}</p>
</button>
