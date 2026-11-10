import { describe, expect, it } from 'vitest';
import { classifyFailure } from '../services/aiErrors';
import {
  emptyFormValues,
  garmentFieldsFromForm,
  validateGarmentForm,
} from './garmentForm';
import { isLocalImageUri, storagePathFromPublicUrl } from './storagePath';

describe('garmentForm', () => {
  it('rellena valores por defecto según la categoría', () => {
    const v = emptyFormValues('outerwear');
    expect(v.subcategory).toBe('Chamarra');
    expect(v.maxWears).toBe('10');
    expect(v.seasons).toHaveLength(4);
  });

  it('valida nombre, puestas y temporadas', () => {
    const v = { ...emptyFormValues(), name: ' ', maxWears: '0', seasons: [] };
    expect(Object.keys(validateGarmentForm(v)).sort()).toEqual(['maxWears', 'name', 'seasons']);
    expect(validateGarmentForm({ ...emptyFormValues(), name: 'Camisa' })).toEqual({});
  });

  it('convierte el formulario en campos de prenda, limpiando y acotando', () => {
    const f = garmentFieldsFromForm({
      ...emptyFormValues('bottom'),
      name: '  Jeans ',
      subcategory: ' ',
      colorsText: 'Azul, , Negro ',
      maxWears: '99',
      formality: 9,
    });
    expect(f.name).toBe('Jeans');
    expect(f.subcategory).toBe('Pantalón');
    expect(f.colors).toEqual(['Azul', 'Negro']);
    expect(f.max_wears_before_wash).toBe(20);
    expect(f.formality).toBe(5);
  });
});

describe('storagePath', () => {
  it('extrae la ruta de una URL pública de Storage', () => {
    const url =
      'https://x.supabase.co/storage/v1/object/public/garments/u1/original-a.jpg?t=1';
    expect(storagePathFromPublicUrl(url)).toBe('u1/original-a.jpg');
    expect(storagePathFromPublicUrl('https://otro.com/a.jpg')).toBeNull();
    expect(storagePathFromPublicUrl(undefined)).toBeNull();
  });
  it('detecta imágenes solo locales', () => {
    expect(isLocalImageUri('file:///a.jpg')).toBe(true);
    expect(isLocalImageUri('https://x/a.jpg')).toBe(false);
    expect(isLocalImageUri(undefined)).toBe(false);
  });
});

describe('classifyFailure', () => {
  it('clasifica por estado HTTP', () => {
    expect(classifyFailure(undefined, 'analysis')).toMatchObject({ code: 'network', retryable: true });
    expect(classifyFailure(401, 'cutout')).toMatchObject({ code: 'unauthorized', retryable: false });
    expect(classifyFailure(429, 'analysis')).toMatchObject({ code: 'quota_exceeded', retryable: true });
    expect(classifyFailure(413, 'analysis')).toMatchObject({ code: 'invalid', retryable: false });
    expect(classifyFailure(502, 'cutout')).toMatchObject({ code: 'unavailable', retryable: true });
  });
});
