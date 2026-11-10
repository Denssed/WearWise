// Utilidades compartidas por las Edge Functions de WearWise (Deno).
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';
import { extractJson } from './pure.ts';

export type ErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'image_too_large'
  | 'quota_exceeded'
  | 'ai_unavailable'
  | 'server_error';

// ---------------------------------------------------------------------------
// Respuestas y CORS
// La app móvil no necesita CORS. Solo se habilitan los orígenes listados en el
// secret ALLOWED_ORIGINS (p. ej. "https://wearwise.app,http://localhost:8081").
// ---------------------------------------------------------------------------
function corsHeaders(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.get('Origin');
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response(null, { status: 204, headers: corsHeaders(req) }) : null;
}

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

export function errorResponse(
  req: Request,
  status: number,
  code: ErrorCode,
  message: string,
  extra: Record<string, unknown> = {}
): Response {
  return jsonResponse(req, { error: message, code, ...extra }, status);
}

// ---------------------------------------------------------------------------
// Autenticación: el usuario SIEMPRE sale del JWT, nunca del body.
// ---------------------------------------------------------------------------
export type AuthResult =
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; response: Response };

export async function authenticate(req: Request): Promise<AuthResult> {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return { ok: false, response: errorResponse(req, 500, 'server_error', 'Servidor mal configurado') };
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { ok: false, response: errorResponse(req, 401, 'unauthorized', 'No autenticado') };
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, response: errorResponse(req, 401, 'unauthorized', 'Sesión inválida o expirada') };
  }
  return { ok: true, userId: data.user.id, admin };
}

// ---------------------------------------------------------------------------
// Cuotas diarias por usuario (tabla ai_usage + RPC consume_ai_quota)
// ---------------------------------------------------------------------------
export type QuotaKind = 'analyze' | 'plan' | 'cutout';

export function envInt(name: string, fallback: number): number {
  const n = parseInt(Deno.env.get(name) ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function consumeQuota(
  admin: SupabaseClient,
  userId: string,
  kind: QuotaKind,
  limit: number
): Promise<{ allowed: boolean; used: number }> {
  const { data, error } = await admin.rpc('consume_ai_quota', {
    p_user_id: userId,
    p_kind: kind,
    p_limit: limit,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: Boolean(row?.allowed), used: Number(row?.used ?? 0) };
}

/** Devuelve el uso consumido cuando el servicio falló por nuestra parte (no se cobra al usuario). */
export async function refundQuota(admin: SupabaseClient, userId: string, kind: QuotaKind) {
  try {
    await admin.rpc('refund_ai_quota', { p_user_id: userId, p_kind: kind });
  } catch (e) {
    console.warn('No se pudo devolver la cuota', e);
  }
}

// ---------------------------------------------------------------------------
// Claude
// ---------------------------------------------------------------------------
const DEFAULT_MODEL = 'claude-haiku-5-5';
const FALLBACK_MODEL = 'claude-haiku-4-5-20251001';

export interface ClaudeRequest {
  system: string;
  messages: unknown[];
  maxTokens: number;
  temperature?: number;
}

/** Llama a Claude probando el modelo configurado y un respaldo. Devuelve el JSON de la respuesta o null. */
export async function callClaudeJson(req: ClaudeRequest): Promise<unknown | null> {
  const apiKey = Deno.env.get('CLAUDE_API_KEY') ?? '';
  if (!apiKey) {
    console.error('Falta el secret CLAUDE_API_KEY');
    return null;
  }
  const configured = Deno.env.get('CLAUDE_MODEL') || DEFAULT_MODEL;
  const models = [...new Set([configured, FALLBACK_MODEL])];

  for (const model of models) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens,
          temperature: req.temperature ?? 0.2,
          system: req.system,
          messages: req.messages,
        }),
      });
      if (!res.ok) {
        console.warn(`Claude ${model} respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
        continue;
      }
      const data = await res.json();
      const parsed = extractJson(data?.content?.[0]?.text ?? '');
      if (parsed) return parsed;
      console.warn(`Claude ${model} devolvió una respuesta sin JSON válido`);
    } catch (e) {
      console.warn(`Claude ${model} falló:`, e);
    }
  }
  return null;
}
