<script lang="ts" module>
  export interface Row {
    label: string;
    summary: string;
    values: (number | null)[];
    color: string;
    kind: 'bars' | 'line';
    /** Dashed reference line, e.g. the hydration goal. */
    reference?: number;
    /** Days to mark with a tick at the top, e.g. pressure drops. */
    marks?: boolean[];
    markColor?: string;
  }
</script>

<script lang="ts">
  /**
   * Charts that share one time axis, one row each. Headache days run as faint red bands through
   * every row, so it shows what went on around them.
   */

  let { rows, bands, labels }: { rows: Row[]; bands: boolean[]; labels: [string, string, string] } = $props();

  const H = 48;
</script>

<div class="flex flex-col gap-3">
  {#each rows as row (row.label)}
    {@const known = row.values.filter((v): v is number => v !== null)}
    {@const max = Math.max(row.reference ?? 0, ...known, 1)}
    {@const min = row.kind === 'line' ? Math.min(...known) : 0}
    {@const range = Math.max(max - min, 1)}
    {@const n = row.values.length}
    {@const y = (v: number) => H - ((v - min) / range) * (H - 4) - 2}
    <div class="flex flex-col gap-1">
      <div class="flex items-baseline justify-between text-xs">
        <span class="font-semibold">{row.label}</span>
        <span class="text-muted tabular">{row.summary}</span>
      </div>
      <svg viewBox="0 0 {n} {H}" preserveAspectRatio="none" class="h-12 w-full overflow-visible rounded-md bg-surface-2/60">
        {#each bands as band, i (i)}
          {#if band}<rect x={i} width="1" y="0" height={H} fill="var(--color-pain)" opacity="0.13" />{/if}
        {/each}
        {#if row.reference !== undefined}
          <line x1="0" x2={n} y1={y(row.reference)} y2={y(row.reference)} stroke={row.color} stroke-width="1" stroke-dasharray="3 2" opacity="0.7" vector-effect="non-scaling-stroke" />
        {/if}
        {#if row.kind === 'bars'}
          {#each row.values as v, i (i)}
            {#if v}<rect x={i + 0.15} width="0.7" y={y(v)} height={H - 2 - y(v)} fill={row.color} />{/if}
          {/each}
        {:else}
          {#each row.values as v, i (i)}
            {@const next = row.values[i + 1]}
            {#if v !== null && next !== null && next !== undefined}
              <line x1={i + 0.5} x2={i + 1.5} y1={y(v)} y2={y(next)} stroke={row.color} stroke-width="2" vector-effect="non-scaling-stroke" />
            {/if}
          {/each}
        {/if}
        {#each row.marks ?? [] as mark, i (i)}
          {#if mark}<line x1={i + 0.5} x2={i + 0.5} y1="0" y2="7" stroke={row.markColor ?? row.color} stroke-width="3" vector-effect="non-scaling-stroke" />{/if}
        {/each}
      </svg>
    </div>
  {/each}
  <div class="flex justify-between text-2xs text-muted">
    {#each labels as label, i (i)}<span>{label}</span>{/each}
  </div>
</div>
