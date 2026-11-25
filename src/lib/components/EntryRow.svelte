<script lang="ts">
  /** One diary entry (headache, medication or drink) as a list row: a short lead (time or day), icon, title and details; a tap opens it. */
  import { Pill, Zap } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  let {
    kind,
    lead,
    title,
    sub = '',
    lines = [],
    emoji = '',
    below,
    trailing,
    onclick
  }: {
    kind: 'episode' | 'intake' | 'drink';
    /** The left column: the time, or the day in lists that span several days. A list sets `--lead-width` when its labels need more room than a time. */
    lead: string;
    title: string;
    /** Shown muted after the title, e.g. the dose or the amount. */
    sub?: string;
    /** Smaller lines below the title. */
    lines?: string[];
    /** The drink's emoji as its icon. */
    emoji?: string;
    /** Shown under the lines. */
    below?: Snippet;
    /** Shown at the right end. */
    trailing?: Snippet;
    onclick: () => void;
  } = $props();

  const ICON = { episode: 'bg-pain-soft text-pain', intake: 'bg-med-soft text-med', drink: 'bg-water-soft' };
</script>

<button class="press flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2" {onclick}>
  <span class="w-[var(--lead-width,calc(var(--spacing)*13))] shrink-0 whitespace-nowrap text-muted tabular">{lead}</span>
  <span class="grid size-10 shrink-0 place-items-center rounded-full text-xl {ICON[kind]}">
    {#if kind === 'episode'}<Zap size={20} />{:else if kind === 'intake'}<Pill size={20} />{:else}{emoji}{/if}
  </span>
  <span class="flex min-w-0 flex-1 flex-col">
    <span>{title}{#if sub}<span class="whitespace-nowrap text-muted tabular">{` ${sub}`}</span>{/if}</span>
    {#each lines as line, i (i)}<span class="text-xs text-muted">{line}</span>{/each}
    {#if below}{@render below()}{/if}
  </span>
  {#if trailing}{@render trailing()}{/if}
</button>
