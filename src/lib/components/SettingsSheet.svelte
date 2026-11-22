<script lang="ts">
  import { t } from '$lib/i18n.svelte';
  import Sheet from './Sheet.svelte';
  import AdvancedSettings from './settings/AdvancedSettings.svelte';
  import BackupSettings from './settings/BackupSettings.svelte';
  import GeneralSettings from './settings/GeneralSettings.svelte';
  import ListsSettings from './settings/ListsSettings.svelte';
  import ReminderSettings from './settings/ReminderSettings.svelte';
  import SettingsGroup from './settings/SettingsGroup.svelte';
  import SleepSettings from './settings/SleepSettings.svelte';
  import WeatherSettings from './settings/WeatherSettings.svelte';
</script>

<Sheet id="settings" title={t('set.title')} full>
  <SettingsGroup title={t('set.lists')} />
  <ListsSettings />
  <SettingsGroup title={t('set.general')} />
  <GeneralSettings />
  <SettingsGroup title={t('rem.title')} />
  <ReminderSettings />
  <SettingsGroup title={t('sleep.title')} hint={t('sleep.hint')} />
  <SleepSettings />
  <SettingsGroup title={t('weather.title')} hint={t('weather.hint')} />
  <WeatherSettings />
  <SettingsGroup title={t('backup.title')} hint={t('sync.hint')} />
  <BackupSettings />
  <AdvancedSettings />

  <p class="mt-6 text-center text-sm text-muted">{t('set.about', { v: __APP_VERSION__ })}</p>
</Sheet>
