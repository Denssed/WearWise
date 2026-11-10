import { z } from 'zod';
import type { Garment, UserProfile, WeeklyPlan } from '../types/wardrobe';

const seasonSchema = z.enum(['primavera', 'verano', 'otoño', 'invierno']);

export const garmentSchema = z
  .object({
  id: z.string().min(1),
  name: z.string(),
  category: z.enum(['top', 'bottom', 'outerwear', 'footwear', 'one_piece', 'accessory']),
  subcategory: z.string().default('Prenda'),
  cutout_image_url: z.string(),
  original_image_url: z.string().nullish().transform((v) => v ?? undefined),
  cutout_status: z.enum(['none', 'pending', 'done', 'failed']).optional(),
  analysis_source: z.enum(['ai', 'manual']).default('manual'),
  colors: z.array(z.string()).default([]),
  pattern: z.string().default('liso'),
  fabric: z.string().default('Algodón'),
  seasons: z.array(seasonSchema).default(['primavera', 'verano', 'otoño', 'invierno']),
  formality: z.number().int().min(1).max(5).default(3),
  wash_care_group: z.enum(['whites', 'darks', 'colors', 'delicates']).default('colors'),
  care_instructions: z.string().nullish().transform((v) => v ?? ''),
  current_wears: z.number().int().min(0).default(0),
  max_wears_before_wash: z.number().int().min(1).default(2),
  total_lifetime_wears: z.number().int().min(0).default(0),
  status: z.enum(['clean', 'needs_wash']).default('clean'),
  ai_styling_notes: z.string().nullish().transform((v) => v ?? ''),
  is_favorite: z.boolean().default(false),
  last_worn_at: z.string().nullish().transform((v) => v ?? undefined),
  last_washed_at: z.string().nullish().transform((v) => v ?? undefined),
  created_at: z.string().default(() => new Date().toISOString()),
  })
  // Prendas guardadas antes de existir `cutout_status`: si la imagen ya es un recorte, está lista.
  .transform((g) => ({
    ...g,
    cutout_status:
      g.cutout_status ?? (g.cutout_image_url.includes('/cutout-') ? ('done' as const) : ('none' as const)),
  }));

const weeklyScheduleSchema = z.object({
  monday: z.string(),
  tuesday: z.string(),
  wednesday: z.string(),
  thursday: z.string(),
  friday: z.string(),
  saturday: z.string(),
  sunday: z.string(),
});

// Parcial: se mezcla siempre con el perfil por defecto, así que los campos ausentes no rompen.
export const profileSchema = z.object({
  displayName: z.string(),
  profileMode: z.enum(['default', 'custom']),
  styleArchetypes: z.array(z.string()),
  preferredColors: z.array(z.string()),
  avoidColors: z.array(z.string()),
  workEnvironment: z.enum([
    'remote',
    'office_casual',
    'business_formal',
    'hybrid',
    'student',
    'active',
  ]),
  climateSensitivity: z.enum(['cold_sensitive', 'normal', 'heat_sensitive']),
  cityName: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  weeklySchedule: weeklyScheduleSchema,
  customPromptNotes: z.string(),
}).partial();

export const weeklyPlanSchema = z.object({
  id: z.string(),
  weekStartDate: z.string(),
  profileModeUsed: z.enum(['default', 'custom']),
  claudeSummary: z.string(),
  days: z.array(
    z.object({
      dayIndex: z.number(),
      dayName: z.string(),
      date: z.string(),
      occasion: z.string(),
      outfitTitle: z.string(),
      garmentIds: z.array(z.string()),
      stylingTip: z.string(),
      weatherNote: z.string(),
      wornConfirmed: z.boolean().optional(),
    })
  ),
  generatedBy: z.enum(['claude_haiku', 'smart_local']),
  createdAt: z.string(),
});

function parseJson(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Lee prendas guardadas descartando las entradas corruptas. `null` = no hay datos válidos guardados. */
export function parseStoredGarments(raw: string | null): Garment[] | null {
  const json = parseJson(raw);
  if (!Array.isArray(json)) return null;
  const valid: Garment[] = [];
  for (const item of json) {
    const res = garmentSchema.safeParse(item);
    if (res.success) valid.push(res.data as Garment);
  }
  return valid;
}

export function parseStoredProfile(raw: string | null): Partial<UserProfile> | null {
  const res = profileSchema.safeParse(parseJson(raw));
  return res.success ? (res.data as Partial<UserProfile>) : null;
}

export function parseStoredPlan(raw: string | null): WeeklyPlan | null {
  const res = weeklyPlanSchema.safeParse(parseJson(raw));
  return res.success ? (res.data as WeeklyPlan) : null;
}

/** Normaliza una fila remota de Supabase a Garment, o null si no es válida. */
export function parseRemoteGarments(rows: unknown): Garment[] | null {
  if (!Array.isArray(rows)) return null;
  const valid: Garment[] = [];
  for (const row of rows) {
    const res = garmentSchema.safeParse(row);
    if (res.success) valid.push(res.data as Garment);
  }
  return valid;
}
