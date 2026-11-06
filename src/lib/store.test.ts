import { beforeEach, describe, expect, it } from 'vitest';
import { wipe } from './backup';
import { db, seed } from './db';
import { data, load, saveSettings, translateDrinkNames, updateDrinkPreset, updateMedication } from './store.svelte';

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

describe('updateDrinkPreset', () => {
  it('keeps both of two quick edits to different fields', async () => {
    const [glass] = await db.drinkPresets.orderBy('order').toArray();
    await Promise.all([updateDrinkPreset(glass.id, { ml: 500 }), updateDrinkPreset(glass.id, { emoji: '🍺' })]);
    const saved = (await db.drinkPresets.get(glass.id))!;
    expect([saved.ml, saved.emoji]).toEqual([500, '🍺']);
  });

  it('removes a field set to undefined', async () => {
    const id = await db.drinkPresets.add({ name: 'Cola', emoji: '🥤', ml: 330, order: 9, caffeineMg: 30 });
    await updateDrinkPreset(id, { caffeineMg: undefined });
    expect((await db.drinkPresets.get(id))!.caffeineMg).toBeUndefined();
  });
});

describe('updateMedication', () => {
  it('keeps both of two quick edits to different fields', async () => {
    const [med] = await db.medications.orderBy('order').toArray();
    await Promise.all([updateMedication(med.id, { dose: '10 mg' }), updateMedication(med.id, { name: 'Rizatriptan' })]);
    const saved = (await db.medications.get(med.id))!;
    expect([saved.name, saved.dose]).toEqual(['Rizatriptan', '10 mg']);
  });
});
