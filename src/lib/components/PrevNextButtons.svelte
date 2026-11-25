<script lang="ts">
  /** A pair of round arrow buttons that step back and forth, e.g. between months or days. */
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';

  let {
    prevLabel,
    nextLabel,
    onprev,
    onnext,
    nextDisabled = false
  }: { prevLabel: string; nextLabel: string; onprev: () => void; onnext: () => void; nextDisabled?: boolean } = $props();
</script>

<div class="flex shrink-0 gap-1">
  <button class="press grid size-11 place-items-center rounded-full bg-surface-2" onclick={onprev} aria-label={prevLabel}>
    <ChevronLeft size={24} />
  </button>
  <button class="press grid size-11 place-items-center rounded-full bg-surface-2 disabled:opacity-40" disabled={nextDisabled} onclick={onnext} aria-label={nextLabel}>
    <ChevronRight size={24} />
  </button>
</div>
