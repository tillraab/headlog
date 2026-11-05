<script lang="ts" module>
  import type { Light } from '$lib/prognosis';

  export const LIGHT_COLOR: Record<Light, string> = { green: 'var(--color-ok)', yellow: 'var(--color-caution)', red: 'var(--color-over)' };
</script>

<script lang="ts">
  /** A small traffic light with the current lamp lit. `size` is the lamp diameter in px. */
  let { light, size = 12 }: { light: Light; size?: number } = $props();
</script>

<span class="flex flex-col rounded-full bg-fg shadow-sm" style:gap="{size / 4}px" style:padding="{size / 2.4}px" aria-hidden="true">
  {#each ['red', 'yellow', 'green'] as const as lamp (lamp)}
    <span
      class="rounded-full transition-colors"
      style:width="{size}px"
      style:height="{size}px"
      style:background-color={light === lamp ? LIGHT_COLOR[lamp] : 'color-mix(in oklab, var(--color-bg) 22%, transparent)'}
      style:box-shadow={light === lamp ? `0 0 ${size / 1.5}px ${LIGHT_COLOR[lamp]}` : undefined}
    ></span>
  {/each}
</span>
