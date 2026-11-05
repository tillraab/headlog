import { beforeEach, describe, expect, it } from 'vitest';
import { wipe } from './backup';
import { db, seed } from './db';
import { data, load, saveSettings, translateDrinkNames } from './store.svelte';

beforeEach(async () => {
  await wipe(db);
  await seed(db, 'de');
});

describe('translateDrinkNames', () => {
  it('renames the default drinks into the new language', async () => {
    await translateDrinkNames('en');
    expect((await db.drinkPresets.orderBy('order').toArray()).map((p) => p.name)).toEqual(['Glass', 'Bottle', 'Coffee', 'Tea']);
  });

  it('keeps names the user chose', async () => {
    const [first] = await db.drinkPresets.orderBy('order').toArray();
    await db.drinkPresets.update(first.id, { name: 'Große Tasse' });
    await translateDrinkNames('en');
    expect((await db.drinkPresets.get(first.id))!.name).toBe('Große Tasse');
  });
});

describe('saveSettings', () => {
  it('stores nested values taken from the current settings', async () => {
    await load();
    await saveSettings({ drinkCheckins: { ...data.settings.drinkCheckins, enabled: true } });
    expect(data.settings.drinkCheckins).toEqual({ enabled: true, times: ['10:00', '13:00', '16:00', '19:00'] });
  });
});

describe('caffeine defaults', () => {
  it('gives coffee and drinks logged with it their caffeine once', async () => {
    const coffee = (await db.drinkPresets.toArray()).find((p) => p.name === 'Kaffee')!;
    await db.drinkPresets.update(coffee.id, { caffeineMg: undefined });
    await db.drinks.add({ time: 1, presetId: coffee.id, name: 'Kaffee', emoji: '☕', ml: 200 });
    await db.settings.delete('caffeineDefaults');
    await load();
    expect((await db.drinks.toArray())[0].caffeineMg).toBe(80);
  });
});
