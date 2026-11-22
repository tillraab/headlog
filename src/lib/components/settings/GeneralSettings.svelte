<script lang="ts">
  /** Language and theme. */
  import { i18n, setLang, t, type Lang } from '$lib/i18n.svelte';
  import type { Theme } from '$lib/settings';
  import { data, saveSettings } from '$lib/store.svelte';
  import { applyTheme } from '$lib/ui.svelte';
  import Segmented from '../Segmented.svelte';

  function changeLang(lang: Lang) {
    setLang(lang);
  }

  async function setTheme(theme: Theme) {
    applyTheme(theme);
    await saveSettings({ theme });
  }
</script>

<div class="card flex flex-col gap-4 p-4">
  <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-body">
    {t('set.language')}
    <Segmented
      options={[
        ['de', 'Deutsch'],
        ['en', 'English']
      ]}
      value={i18n.lang}
      onchange={changeLang}
    />
  </div>
  <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-body">
    {t('set.theme')}
    <Segmented
      options={[
        ['system', t('set.themeSystem')],
        ['light', t('set.themeLight')],
        ['dark', t('set.themeDark')]
      ]}
      value={data.settings.theme}
      onchange={setTheme}
    />
  </div>
</div>
