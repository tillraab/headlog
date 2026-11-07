import { describe, expect, it } from 'vitest';
import { fromLocalInput, toLocalInput } from './ui.svelte';

describe('fromLocalInput', () => {
  it.each(['', 'garbage', '2026-13-40T99:99'])('returns null for %j', (value) => {
    expect(fromLocalInput(value)).toBeNull();
  });

  it('reads back what toLocalInput wrote', () => {
    const time = new Date('2026-03-10T14:35').getTime();
    expect(fromLocalInput(toLocalInput(time))).toBe(time);
  });
});
