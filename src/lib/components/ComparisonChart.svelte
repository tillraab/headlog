<script lang="ts" module>
  export interface Pair {
    label: string;
    headache: number;
    clear: number;
    format: (value: number) => string;
    note: string;
  }
</script>

<script lang="ts">
  /** Pairs of bars: the value on or before headache days, and on or before days without headache. */

  let { pairs, headacheLabel, clearLabel }: { pairs: Pair[]; headacheLabel: string; clearLabel: string } = $props();
</script>

<div class="flex flex-col gap-4">
  <div class="flex gap-4 text-xs text-muted">
    <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-pain"></span>{headacheLabel}</span>
    <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-muted/50"></span>{clearLabel}</span>
  </div>
  {#each pairs as pair (pair.label)}
    {@const max = Math.max(pair.headache, pair.clear, 0.0001)}
    <div class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{pair.label}</span>
      {#each [
        { value: pair.headache, color: 'var(--color-pain)' },
        { value: pair.clear, color: 'color-mix(in oklab, var(--color-muted) 50%, transparent)' }
      ] as bar, i (i)}
        <div class="flex items-center gap-2">
          <div class="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div class="h-full rounded-full" style:width="{(bar.value / max) * 100}%" style:background-color={bar.color}></div>
          </div>
          <span class="w-16 text-right text-xs tabular">{pair.format(bar.value)}</span>
        </div>
      {/each}
      <span class="text-xs text-muted">{pair.note}</span>
    </div>
  {/each}
</div>
