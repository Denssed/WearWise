import { describe, expect, it } from 'vitest';
import { LEGACY_KEYS, storageKeys } from './keys';
import { KeyValueStorage, migrateLegacyData } from './legacyMigration';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: KeyValueStorage = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
  return { storage, data };
}

const baseGarment = {
  name: 'Playera',
  category: 'top',
  subcategory: 'Playera',
  cutout_image_url: 'file:///a.jpg',
  colors: [],
  pattern: 'liso',
  fabric: 'Algodón',
  seasons: ['verano'],
  formality: 2,
  wash_care_group: 'colors',
  care_instructions: '',
  current_wears: 0,
  max_wears_before_wash: 2,
  total_lifetime_wears: 0,
  status: 'clean',
  ai_styling_notes: '',
  is_favorite: false,
  created_at: '2026-01-01T00:00:00.000Z',
};

let counter = 0;
const fakeId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

describe('migrateLegacyData', () => {
  it('no hace nada si no hay datos legacy', async () => {
    const { storage, data } = memoryStorage();
    expect(await migrateLegacyData(storage, 'u1', fakeId)).toBe(0);
    expect(data.size).toBe(0);
  });

  it('migra prendas reales, regenera IDs no-UUID, descarta demo y limpia las claves legacy', async () => {
    const { storage, data } = memoryStorage({
      [LEGACY_KEYS.garments]: JSON.stringify([
        { ...baseGarment, id: 'g-top-1' }, // demo
        { ...baseGarment, id: 'garment-1712345678' }, // id viejo
        { ...baseGarment, id: '11111111-1111-4111-8111-111111111111' }, // uuid válido
      ]),
      [LEGACY_KEYS.weeklyPlan]: '{}',
      [LEGACY_KEYS.apiSettings]: '{"claudeApiKey":"sk-secreto"}',
    });

    const migrated = await migrateLegacyData(storage, 'u1', fakeId);
    expect(migrated).toBe(2);

    const saved = JSON.parse(data.get(storageKeys('u1').garments)!);
    expect(saved).toHaveLength(2);
    expect(saved.map((g: { id: string }) => g.id)).toContain('11111111-1111-4111-8111-111111111111');
    expect(saved.every((g: { id: string }) => g.id !== 'garment-1712345678')).toBe(true);

    for (const key of Object.values(LEGACY_KEYS)) expect(data.has(key)).toBe(false);
  });

  it('no pisa datos que el usuario ya tiene y solo migra una vez', async () => {
    const keys = storageKeys('u1');
    const { storage, data } = memoryStorage({
      [LEGACY_KEYS.garments]: JSON.stringify([{ ...baseGarment, id: 'garment-1' }]),
      [keys.garments]: '[]',
    });
    await migrateLegacyData(storage, 'u1', fakeId);
    expect(data.get(keys.garments)).toBe('[]');
    expect(await migrateLegacyData(storage, 'u2', fakeId)).toBe(0);
    expect(data.has(storageKeys('u2').garments)).toBe(false);
  });
});
