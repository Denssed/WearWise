import { describe, expect, it } from 'vitest';
import {
  parseStoredGarments,
  parseStoredPlan,
  parseStoredProfile,
} from './schemas';

const validGarment = {
  id: 'a3b1c2d4-0000-4000-8000-000000000001',
  name: 'Camisa Oxford',
  category: 'top',
  subcategory: 'Camisa',
  cutout_image_url: 'https://example.com/a.png',
  colors: ['Azul'],
  pattern: 'liso',
  fabric: 'Algodón',
  seasons: ['verano'],
  formality: 3,
  wash_care_group: 'colors',
  care_instructions: 'Frío',
  current_wears: 0,
  max_wears_before_wash: 3,
  total_lifetime_wears: 0,
  status: 'clean',
  ai_styling_notes: '',
  is_favorite: false,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('parseStoredGarments', () => {
  it('devuelve null si no hay datos o el JSON está corrupto', () => {
    expect(parseStoredGarments(null)).toBeNull();
    expect(parseStoredGarments('{no es json')).toBeNull();
    expect(parseStoredGarments('{"a":1}')).toBeNull();
  });

  it('descarta prendas inválidas y conserva las válidas', () => {
    const raw = JSON.stringify([validGarment, { id: 'x', name: 5 }, 'basura']);
    const result = parseStoredGarments(raw);
    expect(result).toHaveLength(1);
    expect(result![0].name).toBe('Camisa Oxford');
  });

  it('rellena valores por defecto y normaliza nulls de Supabase', () => {
    const remoteRow = {
      ...validGarment,
      original_image_url: null,
      last_worn_at: null,
      care_instructions: null,
      user_id: 'ignorado',
    };
    const [g] = parseStoredGarments(JSON.stringify([remoteRow]))!;
    expect(g.original_image_url).toBeUndefined();
    expect(g.last_worn_at).toBeUndefined();
    expect(g.care_instructions).toBe('');
    expect('user_id' in g).toBe(false);
  });

  it('rechaza categorías desconocidas', () => {
    const raw = JSON.stringify([{ ...validGarment, category: 'sombrero' }]);
    expect(parseStoredGarments(raw)).toEqual([]);
  });
});

describe('parseStoredProfile', () => {
  it('acepta perfiles parciales y rechaza tipos incorrectos', () => {
    expect(parseStoredProfile(JSON.stringify({ displayName: 'Ana' }))).toEqual({
      displayName: 'Ana',
    });
    expect(parseStoredProfile(JSON.stringify({ latitude: 'no' }))).toBeNull();
    expect(parseStoredProfile(null)).toBeNull();
  });
});

describe('parseStoredPlan', () => {
  it('devuelve null para planes mal formados', () => {
    expect(parseStoredPlan('{"id":"p"}')).toBeNull();
    expect(parseStoredPlan('basura')).toBeNull();
  });
});
