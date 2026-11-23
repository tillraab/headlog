<script lang="ts">
  /** The small uppercase heading above a group of cards or rows. */
  import type { Snippet } from 'svelte';

  let { children, class: cls = '' }: { children: Snippet; class?: string } = $props();
</script>

<h3 class="text-sm font-semibold tracking-wide text-muted uppercase {cls}">{@render children()}</h3>
