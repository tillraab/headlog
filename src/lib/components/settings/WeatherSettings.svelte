<script lang="ts">
  /** The home town for the weather, found by name. */
  import { i18n, t } from '$lib/i18n.svelte';
  import { data, saveSettings, updateWeather } from '$lib/store.svelte';
  import { toast } from '$lib/ui.svelte';
  import { searchPlaces, type Place } from '$lib/weather';

  let placeQuery = $state('');
  let places = $state<(Place & { region: string })[]>([]);
  let placeError = $state('');

  async function findPlaces() {
    placeError = '';
    try {
      places = await searchPlaces(placeQuery.trim(), i18n.lang);
      if (!places.length) placeError = t('weather.noPlace');
    } catch (e) {
      placeError = e instanceof Error ? e.message : String(e);
    }
  }

  async function choosePlace(place: Place) {
    places = [];
    placeQuery = '';
    await saveSettings({ weather: { enabled: true, place: { name: place.name, latitude: place.latitude, longitude: place.longitude } } });
    try {
      await updateWeather(true);
      toast(t('weather.loaded'));
    } catch (e) {
      placeError = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<div class="card flex flex-col gap-3 p-4 text-body">
  {#if data.settings.weather.place}
    <label class="flex items-center justify-between gap-4">
      <span>🌦️ {data.settings.weather.place.name}</span>
      <input
        type="checkbox"
        class="size-6 shrink-0 accent-primary"
        checked={data.settings.weather.enabled}
        onchange={async (e) => {
          await saveSettings({ weather: { ...data.settings.weather, enabled: e.currentTarget.checked } });
          if (e.currentTarget.checked) void updateWeather(true).catch(() => {});
        }}
      />
    </label>
    <p class="text-sm text-muted">{t('weather.days', { n: data.weather.size })}</p>
  {/if}
  <form
    class="flex gap-2"
    onsubmit={(e) => {
      e.preventDefault();
      if (placeQuery.trim()) void findPlaces();
    }}
  >
    <input placeholder={data.settings.weather.place ? t('weather.change') : t('weather.search')} bind:value={placeQuery} />
    <button class="press btn-primary shrink-0" disabled={!placeQuery.trim()}>
      {t('weather.find')}
    </button>
  </form>
  {#if places.length}
    <ul class="flex flex-col">
      {#each places as place, i (i)}
        <li>
          <button class="press min-h-11 w-full rounded-xl px-3 py-2 text-left hover:bg-surface-2" onclick={() => choosePlace(place)}>
            <span class="font-medium">{place.name}</span> <span class="text-sm text-muted">{place.region}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if placeError}<p class="text-sm text-over">{placeError}</p>{/if}
</div>
