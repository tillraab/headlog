<script lang="ts">
  /** The notifications: relief question, evening warning, headache check and the two drink reminders. */
  import { setHours, startOfDay } from 'date-fns';
  import { hourLabel } from '$lib/days';
  import { num, t } from '$lib/i18n.svelte';
  import { prognosisInput, tomorrowRisk } from '$lib/prognosis';
  import { requestReminderPermission } from '$lib/reminders';
  import { clock, data, saveSettings } from '$lib/store.svelte';
  import { toast } from '$lib/ui.svelte';
  import HourSelect from '../HourSelect.svelte';
  import InfoButton from '../InfoButton.svelte';
  import Toggle from '../Toggle.svelte';

  /** What the evening warning will say tonight, as the data stands now; nothing once the hour has passed. */
  const riskTonight = $derived.by(() => {
    if (!data.settings.riskAlert.enabled) return '';
    const at = setHours(startOfDay(clock.now), data.settings.riskAlert.hour).getTime();
    if (at <= clock.now) return '';
    const risk = tomorrowRisk(prognosisInput(data), at);
    const hour = hourLabel(data.settings.riskAlert.hour);
    if (risk.light === 'green') return t('risk.tonightNone', { hour });
    return t('risk.tonight', { hour, factors: risk.factors.map((k) => t(`prog.tomorrowFactor.${k}`)).join(', ') });
  });

  function reliefLabel(minutes: number): string {
    return t('rem.after', { d: duration(minutes) });
  }

  function duration(minutes: number): string {
    return minutes < 60 ? t('rem.minutes', { n: minutes }) : t('rem.hours', { n: num(minutes / 60, 0, 2) });
  }

  async function toggleDrinkReminder(want: boolean) {
    await setDrinkReminder({ enabled: await allowed(want) });
  }

  function setDrinkReminder(patch: Partial<typeof data.settings.drinkReminder>) {
    return saveSettings({ drinkReminder: { ...data.settings.drinkReminder, ...patch } });
  }

  /** Whether a reminder switch may turn on. Turns the switch back off when notifications are not allowed. */
  async function allowed(want: boolean): Promise<boolean> {
    if (!want || (await requestReminderPermission())) return want;
    toast(t('rem.denied'));
    return false;
  }

  async function toggleReminders(want: boolean) {
    await saveSettings({ reminders: { ...data.settings.reminders, enabled: await allowed(want) } });
  }
</script>

<div class="card flex flex-col gap-4 p-4">
  <label class="flex items-center justify-between gap-4 text-body">
    {t('rem.reliefSetting')}
    <select class="w-32 shrink-0" value={data.settings.reliefCheckMinutes} onchange={(e) => saveSettings({ reliefCheckMinutes: Number(e.currentTarget.value) })}>
      <option value={0}>{t('rem.off')}</option>
      {#each [30, 60, 90, 120, 180, 240] as n (n)}<option value={n}>{reliefLabel(n)}</option>{/each}
    </select>
  </label>
  <label class="flex items-center justify-between gap-4 text-body">
    {t('risk.setting')}
    <HourSelect setting={data.settings.riskAlert} hours={[18, 19, 20, 21, 22]} onchange={(riskAlert) => saveSettings({ riskAlert })} />
  </label>
  {#if riskTonight}<p class="-mt-2 text-sm text-muted">{riskTonight}</p>{/if}
  <label class="flex items-center justify-between gap-4 text-body">
    {t('rem.headacheSetting')}
    <select class="w-32 shrink-0" value={data.settings.headacheCheckHours} onchange={(e) => saveSettings({ headacheCheckHours: Number(e.currentTarget.value) })}>
      <option value={0}>{t('rem.off')}</option>
      {#each [1, 2, 3, 4, 6] as n (n)}<option value={n}>{t('rem.headacheEvery', { d: duration(n * 60) })}</option>{/each}
    </select>
  </label>
  <div class="flex items-center justify-between gap-4 text-body">
    {t('rem.drinkSetting')}
    <Toggle label={t('rem.drinkSetting')} checked={data.settings.drinkReminder.enabled} onchange={toggleDrinkReminder} />
  </div>
  {#if data.settings.drinkReminder.enabled}
    <label class="flex items-center justify-between gap-4 text-body">
      {t('rem.drinkAfter')}
      <select class="w-32 shrink-0" value={data.settings.drinkReminder.everyHours} onchange={(e) => setDrinkReminder({ everyHours: Number(e.currentTarget.value) })}>
        {#each [1, 1.5, 2, 3, 4] as n (n)}<option value={n}>{duration(n * 60)}</option>{/each}
      </select>
    </label>
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-body">
      <span class="flex items-center gap-1">{t('rem.drinkWindow')}<InfoButton title={t('rem.drinkWindow')} text={t('rem.drinkHint')} /></span>
      <span class="flex shrink-0 items-center gap-1">
        <select class="w-24" aria-label={t('rem.drinkFrom')} value={data.settings.drinkReminder.from} onchange={(e) => setDrinkReminder({ from: Number(e.currentTarget.value) })}>
          {#each [5, 6, 7, 8, 9, 10, 11, 12] as h (h)}<option value={h}>{hourLabel(h)}</option>{/each}
        </select>
        –
        <select class="w-24" aria-label={t('rem.drinkTo')} value={data.settings.drinkReminder.to} onchange={(e) => setDrinkReminder({ to: Number(e.currentTarget.value) })}>
          {#each [16, 17, 18, 19, 20, 21, 22, 23] as h (h)}<option value={h}>{hourLabel(h)}</option>{/each}
        </select>
      </span>
    </div>
  {/if}
  <div class="flex items-center justify-between gap-4 text-body">
    <span class="flex items-center gap-1">{t('rem.enabled')}<InfoButton title={t('rem.enabled')} text={t('rem.hint')} /></span>
    <Toggle label={t('rem.enabled')} checked={data.settings.reminders.enabled} onchange={toggleReminders} />
  </div>
  {#if data.settings.reminders.enabled}
    {#each [['noon', [10, 11, 12, 13, 14, 15]], ['evening', [16, 17, 18, 19, 20, 21]]] as const as [field, hours] (field)}
      <label class="flex items-center justify-between gap-4 text-body">
        {t(field === 'noon' ? 'rem.noon' : 'rem.evening')}
        <select
          class="w-28"
          value={data.settings.reminders[field]}
          onchange={(e) => saveSettings({ reminders: { ...data.settings.reminders, [field]: Number(e.currentTarget.value) } })}
        >
          {#each hours as h (h)}<option value={h}>{hourLabel(h)}</option>{/each}
        </select>
      </label>
    {/each}
  {/if}
</div>
