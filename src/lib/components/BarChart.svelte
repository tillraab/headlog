<script lang="ts">
  /** Simple bar chart. Each bar can stack a second value drawn behind the first. */
  let {
    bars,
    color = 'var(--color-primary)',
    height = 112,
    limit
  }: {
    bars: { label: string; value: number; title?: string }[];
    color?: string;
    height?: number;
    limit?: { value: number; color: string };
  } = $props();

  const max = $derived(Math.max(1, limit ? limit.value * 1.15 : 0, ...bars.map((b) => b.value)));
</script>

<div class="flex flex-col gap-1">
  <div class="relative mt-4 flex items-end gap-1" style:height="{height}px">
    {#if limit}
      <div
        class="absolute inset-x-0 border-t border-dashed"
        style:bottom="{(limit.value / max) * 100}%"
        style:border-color={limit.color}
      ></div>
    {/if}
    {#each bars as bar, i (i)}
      <div class="relative flex h-full flex-1 flex-col justify-end" title={bar.title ?? `${bar.label}: ${bar.value}`}>
        <div class="relative rounded-t-[4px] transition-[height] duration-500" style:height="{(bar.value / max) * 100}%" style:background-color={color}>
          {#if bar.value > 0}
            <span class="absolute inset-x-0 -top-3.5 text-center text-axis leading-none text-muted tabular">{Math.round(bar.value * 10) / 10}</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
  <div class="flex gap-1">
    {#each bars as bar, i (i)}
      <span class="flex-1 truncate text-center text-caption text-muted">{bar.label}</span>
    {/each}
  </div>
</div>
