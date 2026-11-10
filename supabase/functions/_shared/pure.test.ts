import { describe, expect, it } from 'vitest';
import {
  base64ByteLength,
  extractJson,
  isOwnStoragePath,
  sanitizeAnalysis,
  sanitizePlan,
} from './pure';

describe('isOwnStoragePath', () => {
  const uid = '11111111-1111-4111-8111-111111111111';
  it('acepta rutas dentro de la carpeta del usuario', () => {
    expect(isOwnStoragePath(`${uid}/original-abc.jpg`, uid)).toBe(true);
  });
  it('rechaza carpetas ajenas, recorridos de directorio y valores raros', () => {
    expect(isOwnStoragePath('22222222-2222-4222-8222-222222222222/a.jpg', uid)).toBe(false);
    expect(isOwnStoragePath(`${uid}/../otro/a.jpg`, uid)).toBe(false);
    expect(isOwnStoragePath(`${uid}//a.jpg`, uid)).toBe(false);
    expect(isOwnStoragePath(`${uid}/`, uid)).toBe(false);
    expect(isOwnStoragePath(`${uid}/a b.jpg`, uid)).toBe(false);
    expect(isOwnStoragePath(null, uid)).toBe(false);
    expect(isOwnStoragePath(`${uid}x/a.jpg`, uid)).toBe(false);
  });
});

describe('extractJson', () => {
  it('extrae JSON dentro de bloques markdown o con texto extra', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Claro: {"a":{"b":2}} listo')).toEqual({ a: { b: 2 } });
  });
  it('devuelve null con basura', () => {
    expect(extractJson('sin json')).toBeNull();
    expect(extractJson('')).toBeNull();
    expect(extractJson('{roto')).toBeNull();
  });
});

describe('base64ByteLength', () => {
  it('calcula el tamaño decodificado', () => {
    expect(base64ByteLength('QUJD')).toBe(3); // "ABC"
    expect(base64ByteLength('QUI=')).toBe(2);
    expect(base64ByteLength('data:image/png;base64,QQ==')).toBe(1);
  });
});

describe('sanitizeAnalysis', () => {
  it('corrige valores fuera de rango o enumeraciones inválidas', () => {
    const r = sanitizeAnalysis({
      name: ' Camisa ',
      category: 'sombrero',
      wash_care_group: 'otros',
      formality: 9,
      max_wears_before_wash: 0,
      seasons: ['verano', 'monzón'],
      colors: ['Azul', 5, ''],
    })!;
    expect(r.name).toBe('Camisa');
    expect(r.category).toBe('top');
    expect(r.wash_care_group).toBe('colors');
    expect(r.formality).toBe(5);
    expect(r.max_wears_before_wash).toBe(1);
    expect(r.seasons).toEqual(['verano']);
    expect(r.colors).toEqual(['Azul']);
  });
  it('rechaza respuestas sin nombre', () => {
    expect(sanitizeAnalysis({})).toBeNull();
    expect(sanitizeAnalysis(null)).toBeNull();
  });
  it('rellena temporadas si vienen vacías', () => {
    expect(sanitizeAnalysis({ name: 'x', seasons: [] })!.seasons).toHaveLength(4);
  });
});

describe('sanitizePlan', () => {
  const budget = { a: 2, b: 1, c: 5 };
  it('elimina IDs inexistentes y duplicados', () => {
    const r = sanitizePlan(
      { days: [{ dayIndex: 0, garmentIds: ['a', 'a', 'zzz', 'c'] }] },
      budget
    )!;
    expect(r.days[0].garmentIds).toEqual(['a', 'c']);
  });
  it('respeta el límite de usos por semana', () => {
    const r = sanitizePlan(
      {
        days: [
          { garmentIds: ['b', 'a'] },
          { garmentIds: ['b', 'a'] },
          { garmentIds: ['a'] },
        ],
      },
      budget
    )!;
    expect(r.days.map((d) => d.garmentIds)).toEqual([['b', 'a'], ['a']]);
  });
  it('devuelve null si no queda ningún día válido', () => {
    expect(sanitizePlan({ days: [{ garmentIds: ['nope'] }] }, budget)).toBeNull();
    expect(sanitizePlan({ days: [] }, budget)).toBeNull();
    expect(sanitizePlan('x', budget)).toBeNull();
  });
});
