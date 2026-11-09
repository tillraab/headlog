<script lang="ts">
  import type { InfoPart } from '$lib/ui.svelte';
  import InfoButton from './InfoButton.svelte';

  /** The title of a card, with an (i) button when the card has an explanation. */
  let { title, info, sources, class: cls = '' }: { title: string; info?: InfoPart | InfoPart[]; sources?: readonly string[]; class?: string } = $props();
</script>

<div class="flex min-h-7 items-center gap-1 {cls}">
  <h2 class="min-w-0 text-lg font-semibold">{title}</h2>
  {#if info}<InfoButton {title} text={info} {sources} />{/if}
</div>
