import type { Garment, GarmentCategory, Season, WashCareGroup } from '../types/wardrobe';

export const ALL_SEASONS: Season[] = ['primavera', 'verano', 'otoño', 'invierno'];

export const FORMALITY_LABELS: Record<number, string> = {
  1: 'Deportivo',
  2: 'Casual',
  3: 'Smart casual',
  4: 'Formal',
  5: 'Etiqueta',
};

/** Valores del formulario (todo texto/booleanos para poder editarlos en inputs). */
export interface GarmentFormValues {
  name: string;
  category: GarmentCategory;
  subcategory: string;
  colorsText: string;
  fabric: string;
  seasons: Season[];
  formality: number;
  washGroup: WashCareGroup;
  maxWears: string;
  careInstructions: string;
  stylingNotes: string;
}

interface CategoryDefaults {
  subcategory: string;
  washGroup: WashCareGroup;
  maxWears: number;
  careInstructions: string;
}

const CATEGORY_DEFAULTS: Record<GarmentCategory, CategoryDefaults> = {
  top: { subcategory: 'Camiseta', washGroup: 'colors', maxWears: 2, careInstructions: 'Lavar en frío, ciclo normal.' },
  bottom: { subcategory: 'Pantalón', washGroup: 'darks', maxWears: 4, careInstructions: 'Lavar en frío, al revés.' },
  outerwear: { subcategory: 'Chamarra', washGroup: 'delicates', maxWears: 10, careInstructions: 'Lavar con poca frecuencia, ciclo delicado.' },
  footwear: { subcategory: 'Calzado', washGroup: 'colors', maxWears: 15, careInstructions: 'Limpiar con paño húmedo.' },
  one_piece: { subcategory: 'Vestido', washGroup: 'delicates', maxWears: 2, careInstructions: 'Ciclo delicado en agua fría.' },
  accessory: { subcategory: 'Accesorio', washGroup: 'delicates', maxWears: 5, careInstructions: 'Limpiar según el material.' },
};

export function defaultsForCategory(category: GarmentCategory): CategoryDefaults {
  return CATEGORY_DEFAULTS[category];
}

/** Valores iniciales para una prenda nueva (también la base de la captura manual). */
export function emptyFormValues(category: GarmentCategory = 'top'): GarmentFormValues {
  const d = CATEGORY_DEFAULTS[category];
  return {
    name: '',
    category,
    subcategory: d.subcategory,
    colorsText: '',
    fabric: '',
    seasons: [...ALL_SEASONS],
    formality: 3,
    washGroup: d.washGroup,
    maxWears: String(d.maxWears),
    careInstructions: d.careInstructions,
    stylingNotes: '',
  };
}

/** Forma mínima del resultado del análisis con IA (el servidor ya lo sanea). */
export interface AnalysisLike {
  name: string;
  category: GarmentCategory;
  subcategory: string;
  colors: string[];
  fabric: string;
  seasons: Season[];
  formality: number;
  wash_care_group: WashCareGroup;
  care_instructions: string;
  max_wears_before_wash: number;
  ai_styling_notes: string;
}

export function formValuesFromAnalysis(a: AnalysisLike): GarmentFormValues {
  return {
    name: a.name,
    category: a.category,
    subcategory: a.subcategory,
    colorsText: a.colors.join(', '),
    fabric: a.fabric,
    seasons: a.seasons.length > 0 ? a.seasons : [...ALL_SEASONS],
    formality: a.formality,
    washGroup: a.wash_care_group,
    maxWears: String(a.max_wears_before_wash),
    careInstructions: a.care_instructions,
    stylingNotes: a.ai_styling_notes,
  };
}

export function formValuesFromGarment(g: Garment): GarmentFormValues {
  return {
    name: g.name,
    category: g.category,
    subcategory: g.subcategory,
    colorsText: g.colors.join(', '),
    fabric: g.fabric,
    seasons: g.seasons.length > 0 ? g.seasons : [...ALL_SEASONS],
    formality: g.formality,
    washGroup: g.wash_care_group,
    maxWears: String(g.max_wears_before_wash),
    careInstructions: g.care_instructions,
    stylingNotes: g.ai_styling_notes,
  };
}

export type GarmentFormErrors = Partial<Record<'name' | 'maxWears' | 'seasons', string>>;

export function validateGarmentForm(v: GarmentFormValues): GarmentFormErrors {
  const errors: GarmentFormErrors = {};
  if (!v.name.trim()) errors.name = 'Ponle un nombre a la prenda.';
  const wears = parseInt(v.maxWears, 10);
  if (!Number.isFinite(wears) || wears < 1 || wears > 20) {
    errors.maxWears = 'Indica entre 1 y 20 puestas.';
  }
  if (v.seasons.length === 0) errors.seasons = 'Elige al menos una temporada.';
  return errors;
}

/** Campos editables de Garment a partir del formulario (asume que ya pasó la validación). */
export function garmentFieldsFromForm(v: GarmentFormValues) {
  return {
    name: v.name.trim(),
    category: v.category,
    subcategory: v.subcategory.trim() || CATEGORY_DEFAULTS[v.category].subcategory,
    colors: v.colorsText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
    fabric: v.fabric.trim() || 'Algodón',
    seasons: v.seasons,
    formality: Math.min(5, Math.max(1, Math.round(v.formality))),
    wash_care_group: v.washGroup,
    max_wears_before_wash: Math.min(20, Math.max(1, parseInt(v.maxWears, 10) || 2)),
    care_instructions: v.careInstructions.trim(),
    ai_styling_notes: v.stylingNotes.trim(),
  };
}
