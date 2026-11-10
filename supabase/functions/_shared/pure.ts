// Lógica pura (sin Deno ni red) compartida por las Edge Functions.
// Vive aparte para poder probarla con Vitest.

export const GARMENT_CATEGORIES = [
  'top',
  'bottom',
  'outerwear',
  'footwear',
  'one_piece',
  'accessory',
] as const;
export const WASH_GROUPS = ['whites', 'darks', 'colors', 'delicates'] as const;
export const SEASONS = ['primavera', 'verano', 'otoño', 'invierno'] as const;

export type Category = (typeof GARMENT_CATEGORIES)[number];
export type WashGroup = (typeof WASH_GROUPS)[number];
export type Season = (typeof SEASONS)[number];

/** Extrae el primer objeto JSON de la respuesta de un LLM (tolera ```json ... ``` y texto extra). */
export function extractJson(raw: string): unknown | null {
  if (!raw) return null;
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? match[0] : raw);
  } catch {
    return null;
  }
}

/** Bytes aproximados que ocupa un base64 una vez decodificado. */
export function base64ByteLength(base64: string): number {
  const clean = base64.replace(/^data:[\w/+.-]+;base64,/, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Una ruta de Storage es válida si está dentro de la carpeta del usuario y no intenta salir de ella. */
export function isOwnStoragePath(path: unknown, userId: string): path is string {
  if (typeof path !== 'string' || path.length > 300) return false;
  if (!path.startsWith(`${userId}/`)) return false;
  const rest = path.slice(userId.length + 1);
  if (!rest || rest.includes('..') || rest.includes('//') || rest.startsWith('/')) return false;
  return /^[\w./-]+$/.test(rest);
}

function str(v: unknown, fallback: string, max = 200): string {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

export interface GarmentAnalysis {
  name: string;
  category: Category;
  subcategory: string;
  colors: string[];
  pattern: string;
  fabric: string;
  seasons: Season[];
  formality: number;
  wash_care_group: WashGroup;
  care_instructions: string;
  max_wears_before_wash: number;
  ai_styling_notes: string;
}

/** Fuerza que la respuesta de Claude cumpla las restricciones de la base de datos. */
export function sanitizeAnalysis(input: unknown): GarmentAnalysis | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  if (typeof o.name !== 'string' || !o.name.trim()) return null;

  const colors = Array.isArray(o.colors)
    ? o.colors.filter((c): c is string => typeof c === 'string' && c.trim() !== '').slice(0, 4)
    : [];
  const seasons = Array.isArray(o.seasons)
    ? (o.seasons.filter((s) => (SEASONS as readonly string[]).includes(s as string)) as Season[])
    : [];

  return {
    name: str(o.name, 'Prenda', 80),
    category: pick(o.category, GARMENT_CATEGORIES, 'top'),
    subcategory: str(o.subcategory, 'Prenda', 60),
    colors,
    pattern: str(o.pattern, 'liso', 40),
    fabric: str(o.fabric, 'Algodón', 60),
    seasons: seasons.length > 0 ? seasons : [...SEASONS],
    formality: clampInt(o.formality, 1, 5, 3),
    wash_care_group: pick(o.wash_care_group, WASH_GROUPS, 'colors'),
    care_instructions: str(o.care_instructions, 'Lavado normal en frío', 240),
    max_wears_before_wash: clampInt(o.max_wears_before_wash, 1, 20, 2),
    ai_styling_notes: str(o.ai_styling_notes, '', 200),
  };
}

export interface PlanDay {
  dayIndex: number;
  dayName: string;
  date: string;
  occasion: string;
  outfitTitle: string;
  garmentIds: string[];
  stylingTip: string;
  weatherNote: string;
}

/**
 * Limpia el plan devuelto por Claude: solo IDs que existen en el catálogo, sin duplicados por día,
 * y sin pasar el límite de usos restantes de cada prenda en la semana.
 * Devuelve null si el plan no es utilizable.
 */
export function sanitizePlan(
  input: unknown,
  remainingWears: Record<string, number>
): { claudeSummary: string; days: PlanDay[] } | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  if (!Array.isArray(o.days) || o.days.length === 0) return null;

  const budget = { ...remainingWears };
  const days: PlanDay[] = [];

  for (const [i, raw] of o.days.slice(0, 7).entries()) {
    if (!raw || typeof raw !== 'object') continue;
    const d = raw as Record<string, unknown>;
    const ids: string[] = [];
    if (Array.isArray(d.garmentIds)) {
      for (const id of d.garmentIds) {
        if (typeof id !== 'string' || ids.includes(id)) continue;
        if ((budget[id] ?? 0) <= 0) continue;
        budget[id] -= 1;
        ids.push(id);
      }
    }
    if (ids.length === 0) continue;
    days.push({
      dayIndex: clampInt(d.dayIndex, 0, 6, i),
      dayName: str(d.dayName, `Día ${i + 1}`, 30),
      date: str(d.date, '', 10),
      occasion: str(d.occasion, '', 120),
      outfitTitle: str(d.outfitTitle, 'Look del día', 100),
      garmentIds: ids,
      stylingTip: str(d.stylingTip, '', 300),
      weatherNote: str(d.weatherNote, '', 300),
    });
  }

  if (days.length === 0) return null;
  return { claudeSummary: str(o.claudeSummary, '', 400), days };
}
