<script lang="ts">
  import type { TenTwenty } from '$lib/analysis';
  import { t } from '$lib/i18n.svelte';

  let { rule }: { rule: TenTwenty } = $props();

  const tone = $derived({ ok: 'bg-ok/12 text-ok', caution: 'bg-caution/15 text-caution', over: 'bg-over/12 text-over' }[rule.status]);
</script>

<span class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium whitespace-nowrap {tone}">
  <span class="font-semibold tabular">{rule.count}/{rule.limit}</span>
  <!-- On narrow phones only the count shows, so the card title stays on one line. -->
  <span class="max-[379px]:sr-only">{t('tenTwenty.badge')}</span>
</span>
