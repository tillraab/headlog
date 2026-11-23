<script lang="ts">
  /** The heading of a settings section, with an (i) when there is more to say. */
  import type { InfoPart } from '$lib/ui.svelte';
  import InfoButton from '../InfoButton.svelte';
  import SectionLabel from '../SectionLabel.svelte';

  let { title, hint }: { title: string; hint?: InfoPart | InfoPart[] } = $props();
</script>

<div class="mt-6 mb-2 flex min-h-6 items-center gap-1">
  <SectionLabel>{title}</SectionLabel>
  {#if hint}<InfoButton {title} text={hint} />{/if}
</div>
