// ============================================================================
// SUPABASE EDGE FUNCTION: generate-weekly-plan  (mejora OPCIONAL con IA)
// El plan base se calcula en el dispositivo sin gastar tokens; esta función solo
// se usa cuando el usuario pide "Mejorar con IA".
//
// Seguridad y costo:
//  - Requiere JWT válido. Cuota diaria QUOTA_PLAN_PER_DAY (por defecto 3).
//  - Catálogo compacto: máx. 120 prendas y solo los campos necesarios.
//  - La respuesta se sanea: solo IDs reales y sin exceder los usos restantes.
// ============================================================================

import {
  authenticate,
  callClaudeJson,
  consumeQuota,
  envInt,
  errorResponse,
  jsonResponse,
  preflight,
  refundQuota,
} from '../_shared/common.ts';
import { sanitizePlan } from '../_shared/pure.ts';

const MAX_GARMENTS = 120;
const MAX_WEATHER_DAYS = 7;

const SYSTEM_PROMPT = `Eres el estilista personal de IA de WearWise.
Arma un plan de vestimenta de 7 días usando EXCLUSIVAMENTE los IDs del catálogo.

REGLAS:
1. No asignes una prenda más veces que su remaining (usos restantes) en la semana.
2. Ajusta cada outfit a la temperatura y lluvia del día.
3. Modo "default": Smart Casual / Casual moderno equilibrado. Modo "custom": respeta estilos, colores preferidos, sensibilidad al clima y la actividad de cada día.
4. Cada día: 1 top y 1 bottom (o 1 one_piece), calzado si hay, y outerwear si hace frío o llueve.
5. Responde SOLO con JSON:
{"claudeSummary":"2 oraciones","days":[{"dayIndex":0,"dayName":"Lunes","date":"YYYY-MM-DD","occasion":"","outfitTitle":"","garmentIds":["id"],"stylingTip":"","weatherNote":""}]}`;

function s(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return errorResponse(req, 405, 'invalid_request', 'Método no permitido');

  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;
  const { userId, admin } = auth;

  let body: { garments?: unknown; profile?: unknown; weatherForecast?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse(req, 400, 'invalid_request', 'JSON inválido');
  }

  if (!Array.isArray(body.garments) || !Array.isArray(body.weatherForecast)) {
    return errorResponse(req, 400, 'invalid_request', 'Faltan garments o weatherForecast');
  }

  // Catálogo mínimo (menos tokens) y presupuesto de usos por prenda.
  const remaining: Record<string, number> = {};
  const catalog = body.garments
    .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
    .filter(
      (g) =>
        typeof g.id === 'string' &&
        g.status === 'clean' &&
        Number(g.current_wears) < Number(g.max_wears_before_wash)
    )
    .slice(0, MAX_GARMENTS)
    .map((g) => {
      const left = Number(g.max_wears_before_wash) - Number(g.current_wears);
      remaining[g.id as string] = left;
      return {
        id: g.id,
        n: s(g.name, 60),
        c: g.category,
        col: Array.isArray(g.colors) ? g.colors.slice(0, 2) : [],
        f: g.formality,
        s: g.seasons,
        remaining: left,
      };
    });

  if (catalog.length < 2) {
    return errorResponse(req, 400, 'invalid_request', 'Se necesitan al menos 2 prendas limpias');
  }

  const profile = (body.profile && typeof body.profile === 'object' ? body.profile : {}) as Record<
    string,
    unknown
  >;
  const compactProfile = {
    mode: profile.profileMode === 'custom' ? 'custom' : 'default',
    styles: Array.isArray(profile.styleArchetypes) ? profile.styleArchetypes.slice(0, 6) : [],
    prefer: Array.isArray(profile.preferredColors) ? profile.preferredColors.slice(0, 8) : [],
    avoid: Array.isArray(profile.avoidColors) ? profile.avoidColors.slice(0, 8) : [],
    work: s(profile.workEnvironment, 30),
    climate: s(profile.climateSensitivity, 20),
    schedule: profile.weeklySchedule,
    notes: s(profile.customPromptNotes, 300),
  };
  const weather = (body.weatherForecast as Record<string, unknown>[])
    .slice(0, MAX_WEATHER_DAYS)
    .map((w) => ({
      date: w?.date,
      day: w?.dayName,
      min: w?.tempMin,
      max: w?.tempMax,
      rain: w?.rainProbability,
    }));

  const limit = envInt('QUOTA_PLAN_PER_DAY', 3);
  try {
    const quota = await consumeQuota(admin, userId, 'plan', limit);
    if (!quota.allowed) {
      return errorResponse(req, 429, 'quota_exceeded', 'Alcanzaste el límite diario de mejoras con IA', {
        limit,
      });
    }
  } catch (e) {
    console.error('Error consultando la cuota', e);
    return errorResponse(req, 500, 'server_error', 'No se pudo verificar tu uso diario');
  }

  const raw = await callClaudeJson({
    system: SYSTEM_PROMPT,
    maxTokens: 1800,
    temperature: 0.4,
    messages: [
      {
        role: 'user',
        content: `Genera el plan.\n${JSON.stringify({ profile: compactProfile, weather, catalog })}`,
      },
    ],
  });

  const plan = sanitizePlan(raw, remaining);
  if (!plan) {
    await refundQuota(admin, userId, 'plan');
    return errorResponse(req, 502, 'ai_unavailable', 'La IA no pudo generar un plan válido ahora');
  }

  return jsonResponse(req, plan);
});
