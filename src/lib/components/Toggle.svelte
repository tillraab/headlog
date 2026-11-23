<script lang="ts">
  /** An on/off switch for a setting; lists you tick from keep their checkboxes. */
  let { checked, onchange, label }: { checked: boolean; onchange: (value: boolean) => void; label?: string } = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  class="press relative h-8 w-13 shrink-0 rounded-full transition-colors {checked ? 'bg-primary' : 'bg-surface-2 ring-1 ring-line ring-inset'}"
  onclick={() => onchange(!checked)}
>
  <span class="absolute top-1 left-1 size-6 rounded-full bg-surface shadow transition-transform {checked ? 'translate-x-5' : ''}"></span>
</button>
