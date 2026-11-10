// ============================================================================
// SUPABASE EDGE FUNCTION: delete-account
// Elimina de forma permanente la cuenta del usuario que hace la llamada
// (requisito de Apple App Store 5.1.1(v) y Google Play).
//
// - Requiere JWT válido: el usuario se toma SIEMPRE del token, nunca del body.
// - Borra los archivos del usuario en Storage (bucket 'garments', carpeta {uid}/).
// - Borra el usuario de auth.users; las tablas (profiles, garments, weekly_plans,
//   wear_logs, ai_usage) se eliminan en cascada por sus llaves foráneas.
// ============================================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';
import { authenticate, errorResponse, jsonResponse, preflight } from '../_shared/common.ts';

const BUCKET = 'garments';

async function removeUserFiles(admin: SupabaseClient, userId: string) {
  // Lista y borra por páginas hasta vaciar la carpeta del usuario.
  for (let i = 0; i < 50; i++) {
    const { data, error } = await admin.storage.from(BUCKET).list(userId, { limit: 100 });
    if (error) throw error;
    if (!data || data.length === 0) return;
    const paths = data.map((f) => `${userId}/${f.name}`);
    const { error: rmError } = await admin.storage.from(BUCKET).remove(paths);
    if (rmError) throw rmError;
  }
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return errorResponse(req, 405, 'invalid_request', 'Método no permitido');

  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;

  try {
    await removeUserFiles(auth.admin, auth.userId);
    const { error } = await auth.admin.auth.admin.deleteUser(auth.userId);
    if (error) throw error;
    return jsonResponse(req, { ok: true });
  } catch (e) {
    console.error('delete-account failed', e);
    return errorResponse(req, 500, 'server_error', 'No se pudo eliminar la cuenta');
  }
});
