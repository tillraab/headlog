<script lang="ts" module>
  /**
   * How every diary entry is drawn: `line` like a list (time on the left, no fill), `card` like a tile (tinted fill,
   * time on the right). One style for the whole app.
   */
  export const ENTRY_STYLE: 'line' | 'card' = 'line';
</script>

<script lang="ts">
  /** One diary entry (headache, medication or drink) with its time, icon, title and details; a tap opens it. */
  import { Pill, Zap } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  let {
    kind,
    time,
    title,
    sub = '',
    lines = [],
    emoji = '',
    trailing,
    onclick
  }: {
    kind: 'episode' | 'intake' | 'drink';
    time: string;
    title: string;
    /** Shown muted after the title, e.g. the dose or the amount. */
    sub?: string;
    /** Smaller lines below the title. */
    lines?: string[];
    /** The drink's emoji as its icon. */
    emoji?: string;
    /** Shown at the right end, before the time in the card style. */
    trailing?: Snippet;
    onclick: () => void;
  } = $props();

  const TINT = { episode: 'bg-pain-soft', intake: 'bg-med-soft', drink: 'bg-surface-2' };
  const ICON = { episode: 'bg-pain-soft text-pain', intake: 'bg-med-soft text-med', drink: 'bg-water-soft' };
  const card = ENTRY_STYLE === 'card';
</script>

<button
  class="press flex min-h-12 w-full items-center gap-3 text-left {card ? `rounded-2xl p-3 ${TINT[kind]}` : 'rounded-xl px-2 py-2 hover:bg-surface-2'}"
  {onclick}
>
  {#if !card}<span class="w-13 shrink-0 text-muted tabular">{time}</span>{/if}
  <span class="grid size-10 shrink-0 place-items-center rounded-full text-xl {ICON[kind]}">
    {#if kind === 'episode'}<Zap size={20} />{:else if kind === 'intake'}<Pill size={20} />{:else}{emoji}{/if}
  </span>
  <span class="flex min-w-0 flex-1 flex-col">
    <span><span class={card ? 'font-semibold' : ''}>{title}</span>{#if sub}<span class="text-muted tabular"> {sub}</span>{/if}</span>
    {#each lines as line, i (i)}<span class="text-xs text-muted">{line}</span>{/each}
  </span>
  {#if trailing}{@render trailing()}{/if}
  {#if card}<span class="shrink-0 text-muted tabular">{time}</span>{/if}
</button>
