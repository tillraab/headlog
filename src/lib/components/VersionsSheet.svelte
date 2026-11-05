<script lang="ts">
  import { isToday, isYesterday, startOfDay } from 'date-fns';
  import { untrack } from 'svelte';
  import type { Backup } from '$lib/backup';
  import type { Drink, Episode, Intake } from '$lib/db';
  import { listVersions, pull, VERSIONS_PER_PAGE, type GistVersion } from '$lib/gist';
  import { fmt, t } from '$lib/i18n.svelte';
  import { load } from '$lib/store.svelte';
  import { restoreFromGist, sync } from '$lib/sync.svelte';
  import { closeSheet, sheets, toast } from '$lib/ui.svelte';
  import Sheet from './Sheet.svelte';

  interface Preview {
    episodes: number;
    intakes: number;
    drinks: number;
    latest: number | null;
  }

  let versions = $state<GistVersion[]>([]);
  let page = $state(0);
  let more = $state(true);
  let loading = $state(false);
  let error = $state('');
  let selected = $state<string | null>(null);
  let previews = $state<Record<string, Preview | 'loading' | 'error'>>({});

  const open = $derived(sheets.stack.includes('versions'));

  const days = $derived.by(() => {
    const groups: { day: number; items: GistVersion[] }[] = [];
    for (const v of versions) {
      const day = startOfDay(v.at).getTime();
      const last = groups[groups.length - 1];
      if (last?.day === day) last.items.push(v);
      else groups.push({ day, items: [v] });
    }
    return groups;
  });

  /** Starts fresh each time the sheet opens. */
  $effect(() => {
    if (!open) return;
    untrack(reset);
  });

  function reset() {
    versions = [];
    page = 0;
    more = true;
    selected = null;
    previews = {};
    void loadMore();
  }

  async function loadMore() {
    if (!sync.link || loading) return;
    loading = true;
    error = '';
    try {
      const next = await listVersions(sync.link, page + 1);
      versions = [...versions, ...next];
      page += 1;
      more = next.length === VERSIONS_PER_PAGE;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function summarize(backup: Backup): Preview {
    const { episodes, intakes, drinks } = backup.tables as { episodes: Episode[]; intakes: Intake[]; drinks: Drink[] };
    const times = [...episodes.map((e) => e.start), ...intakes.map((i) => i.time), ...drinks.map((d) => d.time)];
    return { episodes: episodes.length, intakes: intakes.length, drinks: drinks.length, latest: times.length ? Math.max(...times) : null };
  }

  async function select(version: string) {
    selected = selected === version ? null : version;
    if (!selected || previews[version] || !sync.link) return;
    previews[version] = 'loading';
    try {
      previews[version] = summarize(await pull(sync.link, version));
    } catch {
      previews[version] = 'error';
    }
  }

  async function restore(v: GistVersion) {
    if (!confirm(t('versions.confirm', { time: fmt(v.at, 'd. MMM yyyy, HH:mm') }))) return;
    try {
      await restoreFromGist(v.version);
      await load();
      toast(t('set.imported'));
      closeSheet('versions');
      closeSheet('settings');
    } catch {
      toast(t('sync.failed', { error: sync.error }));
    }
  }

  function dayLabel(day: number): string {
    if (isToday(day)) return t('versions.today');
    if (isYesterday(day)) return t('versions.yesterday');
    return fmt(day, 'EEEE, d. MMMM yyyy');
  }
</script>

<Sheet id="versions" title={t('versions.title')}>
  <p class="mb-4 text-sm text-muted">{t('versions.hint')}</p>

  {#each days as group (group.day)}
    <h3 class="mt-4 mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{dayLabel(group.day)}</h3>
    <ul class="card flex flex-col p-1">
      {#each group.items as v (v.version)}
        {@const preview = previews[v.version]}
        <li class="rounded-xl {selected === v.version ? 'bg-surface-2' : ''}">
          <button class="press flex w-full items-center justify-between px-3 py-3 text-left" onclick={() => select(v.version)}>
            <span class="text-body font-medium tabular">{fmt(v.at, 'HH:mm')}</span>
            {#if v === versions[0]}<span class="rounded-full bg-ok/12 px-2 py-0.5 text-xs font-medium text-ok">{t('versions.current')}</span>{/if}
          </button>
          {#if selected === v.version}
            <div class="flex flex-col gap-3 px-3 pb-3 text-sm">
              {#if preview === 'loading' || !preview}
                <p class="text-muted">…</p>
              {:else if preview === 'error'}
                <p class="text-over">{t('versions.failed')}</p>
              {:else}
                <p>
                  {t('versions.counts', { e: preview.episodes, i: preview.intakes, d: preview.drinks })}
                  <br /><span class="text-muted">
                    {preview.latest ? t('versions.latest', { time: fmt(preview.latest, 'd. MMM yyyy, HH:mm') }) : t('versions.empty')}
                  </span>
                </p>
                <button class="press rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-fg disabled:opacity-50" disabled={sync.busy} onclick={() => restore(v)}>
                  {t('versions.restore')}
                </button>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/each}

  {#if loading}
    <p class="mt-4 text-center text-sm text-muted">…</p>
  {:else if error}
    <p class="mt-4 text-sm text-over">{t('sync.failed', { error })}</p>
  {:else if more && versions.length}
    <button class="press mt-4 w-full rounded-xl bg-surface-2 py-2.5 text-sm font-medium" onclick={loadMore}>{t('versions.more')}</button>
  {:else if !versions.length}
    <p class="text-sm text-muted">{t('versions.none')}</p>
  {/if}
</Sheet>
