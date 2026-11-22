<script lang="ts">
  /** Language and theme. */
  import { i18n, setLang, t, type Lang } from '$lib/i18n.svelte';
  import type { Theme } from '$lib/settings';
  import { data, saveSettings } from '$lib/store.svelte';
  import { applyTheme } from '$lib/ui.svelte';

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
    <div class="flex rounded-full bg-surface-2 p-1">
      {#each [['de', 'Deutsch'], ['en', 'English']] as [code, name] (code)}
        <button class="press min-h-10 rounded-full px-3 py-1 {i18n.lang === code ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => changeLang(code as Lang)}>{name}</button>
      {/each}
    </div>
  </div>
  <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-body">
    {t('set.theme')}
    <div class="flex rounded-full bg-surface-2 p-1">
      {#each [['system', t('set.themeSystem')], ['light', t('set.themeLight')], ['dark', t('set.themeDark')]] as [value, name] (value)}
        <button class="press min-h-10 rounded-full px-3 py-1 {data.settings.theme === value ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => setTheme(value as Theme)}>
          {name}
        </button>
      {/each}
    </div>
  </div>
</div>
