import { beforeEach, describe, expect, it } from 'vitest';
import { wipe } from './backup';
import { db, seed } from './db';
import { confirmNight, data, deleteMedication, endEpisode, load, logIntake, remove, saveSettings, setRelief, translateDrinkNames, updateDrinkPreset, updateMedication } from './store.svelte';

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
    await saveSettings({ drinkReminder: { ...data.settings.drinkReminder, enabled: true } });
    expect(data.settings.drinkReminder).toEqual({ enabled: true, from: 8, to: 20, everyHours: 2 });
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

describe('drink reminder migration', () => {
  it('turns the drink reminder on for whoever had drink check-ins on', async () => {
    await db.settings.put({ key: 'settings', value: { drinkCheckins: { enabled: true, times: ['10:00'] } } });
    await load();
    expect(data.settings.drinkReminder).toEqual({ enabled: true, from: 8, to: 20, everyHours: 2 });
  });
});

describe('setRelief', () => {
  const intake = (time: number) => ({ id: 1, time, medId: 1, name: 'Ibuprofen', dose: '400 mg', category: 'analgesic' as const, relief: null });

  it('rates the intake the question was about', async () => {
    await db.intakes.put(intake(1000));
    await setRelief(1, 2, 1000);
    expect((await db.intakes.get(1))!.relief).toBe(2);
  });

  it('ignores the answer when the id now belongs to an intake with another time', async () => {
    await db.intakes.put(intake(2000));
    await setRelief(1, 2, 1000);
    expect((await db.intakes.get(1))!.relief).toBeNull();
  });

  it('does not create an intake that is gone', async () => {
    await setRelief(1, 2, 1000);
    expect(await db.intakes.count()).toBe(0);
  });
});

describe('relief check migration', () => {
  it('turns the old switched-off relief question into 0 minutes', async () => {
    await db.settings.put({ key: 'settings', value: { reliefCheck: false } });
    await load();
    expect(data.settings.reliefCheckMinutes).toBe(0);
  });
});

describe('intakes', () => {
  it('keep name, dose and category after their medication is edited and deleted', async () => {
    await load();
    const [med] = data.medications;
    const id = await logIntake(med, 1000);
    await updateMedication(med.id, { name: 'Renamed', dose: '1 g', category: 'other' });
    await deleteMedication(med.id);
    const intake = (await db.intakes.get(id))!;
    expect([intake.name, intake.dose, intake.category]).toEqual([med.name, med.dose, med.category]);
  });
});

describe('remove', () => {
  it('returns an undo that restores the identical row', async () => {
    const id = await db.episodes.add({ start: 1000, end: 2000, intensity: 6, tags: ['stress'], note: 'n' });
    const row = await db.episodes.get(id);
    const undo = await remove('episodes', id);
    await undo();
    expect(await db.episodes.get(id)).toEqual(row);
  });
});

describe('endEpisode', () => {
  it('leaves an episode that has already ended as it is', async () => {
    const id = await db.episodes.add({ start: 1000, end: 2000, intensity: 6, tags: [], note: '' });
    await endEpisode(id);
    expect((await db.episodes.get(id))!.end).toBe(2000);
  });

  it('ends an ongoing episode', async () => {
    const id = await db.episodes.add({ start: 1000, end: null, intensity: 6, tags: [], note: '' });
    await endEpisode(id);
    expect((await db.episodes.get(id))!.end).not.toBeNull();
  });
});

describe('confirmNight', () => {
  it('keeps an estimated night as the user confirmed it', async () => {
    await db.sleep.put({ day: '2026-03-10', start: 1000, end: 2000, asleepMs: 1000, breaks: [], source: 'screen' });
    await load();
    await confirmNight('2026-03-10');
    expect((await db.sleep.get('2026-03-10'))!.source).toBe('manual');
  });
});

describe('migrations', () => {
  it('run once: a second load does not clear the weather again', async () => {
    await load();
    const flag = await db.settings.get('weatherDailyMeanDrop');
    await db.weather.put({ day: '2026-03-10', pressure: 1010, pressureDrop: 0, tempMax: 10, tempMin: 2, humidity: 70, precipitation: 0, code: 0 });
    await load();
    expect([flag?.value, await db.weather.count()]).toEqual([true, 1]);
  });

  it('do not run on a database seeded fresh, so demo weather stays', async () => {
    await wipe(db);
    await seed(db);
    await db.weather.put({ day: '2026-03-10', pressure: 1010, pressureDrop: 0, tempMax: 10, tempMin: 2, humidity: 70, precipitation: 0, code: 0 });
    await load();
    expect(await db.weather.count()).toBe(1);
  });

  it('clear weather stored before the daily-mean pressure drop', async () => {
    await db.settings.delete('weatherDailyMeanDrop');
    await db.weather.put({ day: '2026-03-10', pressure: 1010, pressureDrop: 0, tempMax: 10, tempMin: 2, humidity: 70, precipitation: 0, code: 0 });
    await load();
    expect(await db.weather.count()).toBe(0);
  });
});

describe('load', () => {
  it('fills a setting sub-field that the stored settings lack', async () => {
    await db.settings.put({ key: 'settings', value: { drinkReminder: { enabled: true, from: 9, to: 18 } } });
    await load();
    expect(data.settings.drinkReminder.everyHours).toBe(2);
  });
});
