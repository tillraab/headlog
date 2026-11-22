<script lang="ts" generics="T extends string">
  /** A row of options of which one is chosen, e.g. the period in Insights or the theme. `fill` stretches it to the full width. */
  let { options, value, onchange, fill = false }: { options: [T, string][]; value: T; onchange: (value: T) => void; fill?: boolean } = $props();
</script>

<div class="flex rounded-full bg-surface-2 p-1 text-sm font-medium" role="group">
  {#each options as [key, label] (key)}
    <button
      class="press min-h-11 rounded-full px-3 whitespace-nowrap {fill ? 'flex-1' : ''} {value === key ? 'bg-surface shadow-sm' : 'text-muted'}"
      aria-pressed={value === key}
      onclick={() => onchange(key)}>{label}</button
    >
  {/each}
</div>
