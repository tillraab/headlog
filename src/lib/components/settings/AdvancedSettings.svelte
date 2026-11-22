<script lang="ts">
  /** Demo data and deleting everything, folded away. */
  import { ChevronDown } from '@lucide/svelte';
  import { wipe } from '$lib/backup';
  import { loadDemo } from '$lib/demo';
  import { i18n, t } from '$lib/i18n.svelte';
  import { data, load, saveSettings } from '$lib/store.svelte';
  import { pauseSync } from '$lib/sync.svelte';

  async function demo() {
    if (!confirm(t('set.demoConfirm'))) return;
    pauseSync('demo');
    const place = $state.snapshot(data.settings.weather.place);
    await loadDemo(Date.now(), undefined, i18n.lang);
    await load();
    await saveSettings({ weather: { enabled: true, place }, sleep: { ...data.settings.sleep, enabled: true } });
  }

  async function reset() {
    if (!confirm(t('set.wipeConfirm'))) return;
    pauseSync('wipe');
    await wipe();
    await load();
  }
</script>

<details class="group mt-6">
  <summary class="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold tracking-wide text-muted uppercase">
    {t('set.advanced')}
    <ChevronDown size={20} class="transition-transform group-open:rotate-180" />
  </summary>
  <div class="card mt-2 flex flex-col p-1 text-body">
    <button class="press rounded-xl px-3 py-3 text-left" onclick={demo}>{t('set.demo')}</button>
    <button class="press rounded-xl px-3 py-3 text-left text-over" onclick={reset}>{t('set.wipe')}</button>
  </div>
</details>
