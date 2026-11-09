<script lang="ts">
  import { Info } from '@lucide/svelte';
  import { t } from '$lib/i18n.svelte';
  import { showInfo, tap, type InfoPart } from '$lib/ui.svelte';

  /** An (i) button that opens an explanation of `title`, so the text does not have to sit on the screen. */
  let { title, text, sources, class: cls = '' }: { title: string; text: InfoPart | InfoPart[]; sources?: readonly string[]; class?: string } = $props();
</script>

<button
  type="button"
  class="press -my-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 {cls}"
  aria-label={`${t('a11y.info')}: ${title}`}
  aria-haspopup="dialog"
  onclick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    tap();
    showInfo(title, text, sources);
  }}
>
  <Info size={20} />
</button>
