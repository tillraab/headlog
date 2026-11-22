<script lang="ts">
  /** The sleep estimate from screen activity, the time to fall asleep and the morning check. */
  import { t } from '$lib/i18n.svelte';
  import { FALL_ASLEEP_OPTIONS, openUsageAccessSettings, screenAccess } from '$lib/sleep';
  import { data, saveSettings, updateSleep } from '$lib/store.svelte';
  import HourSelect from '../HourSelect.svelte';
  import Toggle from '../Toggle.svelte';

  let access = $state<{ supported: boolean; granted: boolean } | null>(null);

  /** Checks usage access again, e.g. after returning from Android's settings. */
  async function checkAccess() {
    access = await screenAccess();
    if (access.granted) await updateSleep();
  }

  $effect(() => {
    void checkAccess();
    const onVisible = () => document.visibilityState === 'visible' && void checkAccess();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });
</script>

<div class="card flex flex-col gap-3 p-4 text-body">
  {#if access && !access.supported}
    <p class="text-muted">{t('sleep.unsupported')}</p>
  {:else}
    <div class="flex items-center justify-between gap-4">
      {t('sleep.setting')}
      <Toggle
        label={t('sleep.setting')}
        checked={data.settings.sleep.enabled}
        onchange={async (enabled) => {
          await saveSettings({ sleep: { ...data.settings.sleep, enabled } });
          await checkAccess();
        }}
      />
    </div>
    {#if data.settings.sleep.enabled}
      <label class="flex items-center justify-between gap-4">
        {t('sleep.fallAsleepSetting')}
        <select
          class="w-32 shrink-0"
          value={data.settings.sleep.fallAsleepMinutes}
          onchange={async (e) => {
            await saveSettings({ sleep: { ...data.settings.sleep, fallAsleepMinutes: Number(e.currentTarget.value) } });
            await updateSleep();
          }}
        >
          {#each FALL_ASLEEP_OPTIONS as n (n)}<option value={n}>{t('sleep.minutes', { n })}</option>{/each}
        </select>
      </label>
    {/if}
    {#if data.settings.sleep.enabled && access?.granted}
      <p class="text-sm text-muted">{data.sleep.size ? t('sleep.nights', { n: data.sleep.size }) : t('sleep.none')}</p>
    {/if}
    {#if data.settings.sleep.enabled}
      <label class="flex items-center justify-between gap-4">
        {t('sleep.checkSetting')}
        <HourSelect setting={data.settings.sleepCheck} hours={[7, 8, 9, 10, 11]} onchange={(sleepCheck) => saveSettings({ sleepCheck })} />
      </label>
    {/if}
    {#if data.settings.sleep.enabled && access && !access.granted}
      <p class="text-sm text-muted">{t('sleep.allowHint')}</p>
      <button class="press btn-primary" onclick={() => openUsageAccessSettings()}>
        {t('sleep.allow')}
      </button>
    {/if}
  {/if}
</div>
