<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { celebration } from '$lib/ui.svelte';

  const COLORS = ['#1f8fe0', '#4fb0f5', '#8d80f2', '#5b4bd6', '#ffcf4d', '#16a26b'];

  let shown = $state(0);

  $effect(() => {
    if (!celebration.id) return;
    shown = celebration.id;
    const timer = setTimeout(() => (shown = 0), 2600);
    return () => clearTimeout(timer);
  });

  /** Fixed pseudo-random pieces, so every burst looks lively but the same. */
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 9) * 70,
    duration: 1300 + ((i * 53) % 700),
    color: COLORS[i % COLORS.length],
    size: 6 + (i % 4) * 2,
    drift: ((i * 29) % 80) - 40,
    round: i % 3 === 0
  }));
</script>

{#if shown}
  {#key shown}
    <div class="pointer-events-none fixed inset-0 z-[90] overflow-hidden" transition:fade={{ duration: 300 }}>
      {#each pieces as p, i (i)}
        <span
          class="piece absolute top-0"
          style:left="{p.left}%"
          style:width="{p.size}px"
          style:height="{p.round ? p.size : p.size * 1.6}px"
          style:border-radius={p.round ? '50%' : '2px'}
          style:background-color={p.color}
          style:animation-delay="{p.delay}ms"
          style:animation-duration="{p.duration}ms"
          style:--drift="{p.drift}px"
        ></span>
      {/each}
    </div>
    <div class="pointer-events-none fixed inset-0 z-[91] grid place-items-center px-8" transition:fade={{ duration: 300 }}>
      <div class="card flex flex-col items-center gap-1 px-8 py-6 text-center shadow-2xl" in:scale={{ start: 0.7, duration: 350 }}>
        <span class="text-5xl">💧</span>
        <p class="text-xl font-semibold">{celebration.title}</p>
        <p class="text-sm text-muted">{celebration.text}</p>
      </div>
    </div>
  {/key}
{/if}

<style>
  .piece {
    animation-name: fall;
    animation-timing-function: cubic-bezier(0.25, 0.6, 0.5, 1);
    animation-fill-mode: both;
  }

  @keyframes fall {
    from {
      transform: translate(0, -20px) rotate(0deg);
      opacity: 1;
    }
    to {
      transform: translate(var(--drift), 100vh) rotate(540deg);
      opacity: 0.6;
    }
  }
</style>
