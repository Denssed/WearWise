// ============================================================================
// SUPABASE EDGE FUNCTION: delete-account
// Elimina de forma permanente la cuenta del usuario que hace la llamada
// (requisito de Apple App Store 5.1.1(v) y Google Play).
//
// - Requiere JWT válido: el usuario se toma SIEMPRE del token, nunca del body.
// - Borra los archivos del usuario en Storage (bucket 'garments', carpeta {uid}/).
// - Borra el usuario de auth.users; las tablas (profiles, garments, weekly_plans,
//   wear_logs) se eliminan en cascada por sus llaves foráneas.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const BUCKET = 'garments';

function json(body: unknown, status = 200, origin = '*') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'application/json',
    },
  });
}

async function removeUserFiles(admin: ReturnType<typeof createClient>, userId: string) {
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
  if (req.method === 'OPTIONS') return json('ok');
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Servidor mal configurado' }, 500);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'No autenticado' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: 'Sesión inválida' }, 401);
  const userId = userData.user.id;

  try {
    await removeUserFiles(admin, userId);
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;
    return json({ ok: true });
  } catch (e) {
    console.error('delete-account failed', e);
    return json({ error: 'No se pudo eliminar la cuenta' }, 500);
  }
});
