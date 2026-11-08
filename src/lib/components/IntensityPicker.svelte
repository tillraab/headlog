<script lang="ts">
  import { intensityLabel } from '$lib/i18n.svelte';
  import { tap } from '$lib/ui.svelte';

  let { value, onchange }: { value: number; onchange: (value: number) => void } = $props();
</script>

<div class="flex flex-col gap-1.5">
  <div class="grid grid-cols-10 gap-1">
    {#each { length: 10 } as _, i (i)}
      {@const n = i + 1}
      <button
        class="press h-12 rounded-lg text-base font-semibold tabular {n <= value ? 'text-white' : 'bg-surface-2 text-muted'}"
        style:background-color={n <= value ? `color-mix(in oklab, var(--color-pain) ${40 + n * 6}%, var(--color-med))` : undefined}
        onclick={() => {
          tap();
          onchange(n);
        }}
        aria-label={`${n}`}
        aria-pressed={n === value}>{n}</button
      >
    {/each}
  </div>
  <p class="text-sm text-muted">{value}/10 · {intensityLabel(value)}</p>
</div>
