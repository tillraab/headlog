<script lang="ts">
  import { hourLabel } from '$lib/days';
  import { t } from '$lib/i18n.svelte';

  /** "Off" or one of `hours`, for a notification that is either off or comes at an hour of the day. */
  let {
    setting,
    hours,
    onchange
  }: { setting: { enabled: boolean; hour: number }; hours: number[]; onchange: (setting: { enabled: boolean; hour: number }) => void } = $props();
</script>

<select
  class="w-32 shrink-0"
  value={setting.enabled ? setting.hour : 0}
  onchange={(e) => {
    const hour = Number(e.currentTarget.value);
    onchange(hour ? { enabled: true, hour } : { ...setting, enabled: false });
  }}
>
  <option value={0}>{t('rem.off')}</option>
  {#each hours as h (h)}<option value={h}>{hourLabel(h)}</option>{/each}
</select>
