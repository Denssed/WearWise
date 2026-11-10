// ============================================================================
// SUPABASE EDGE FUNCTION: remove-background
// Quita el fondo de una foto YA SUBIDA a Storage. Está separada del análisis con
// IA para que un fallo de una parte no bloquee a la otra, y para poder reintentar
// el recorte más tarde sin volver a enviar la imagen.
//
// Entrada:  { path: "<uid>/original-xxxx.jpg" }  (ruta dentro del bucket 'garments')
// Salida:   { cutoutImageUrl }
//
// Seguridad: JWT obligatorio; la ruta debe estar en la carpeta del propio usuario;
// cuota diaria QUOTA_CUTOUT_PER_DAY (defecto 30).
// ============================================================================

import {
  authenticate,
  consumeQuota,
  envInt,
  errorResponse,
  jsonResponse,
  preflight,
  refundQuota,
} from '../_shared/common.ts';
import { isOwnStoragePath } from '../_shared/pure.ts';
import { CutoutError, removeBackgroundToStorage } from '../_shared/replicate.ts';

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return errorResponse(req, 405, 'invalid_request', 'Método no permitido');

  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;
  const { userId, admin } = auth;

  let body: { path?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse(req, 400, 'invalid_request', 'JSON inválido');
  }
  if (!isOwnStoragePath(body.path, userId)) {
    return errorResponse(req, 400, 'invalid_request', 'Ruta de imagen inválida');
  }
  const path = body.path;

  // La foto debe existir en Storage.
  const folder = path.slice(0, path.lastIndexOf('/'));
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  const { data: listed, error: listError } = await admin.storage
    .from('garments')
    .list(folder, { search: fileName, limit: 1 });
  if (listError || !listed?.some((f) => f.name === fileName)) {
    return errorResponse(req, 404, 'invalid_request', 'No se encontró la imagen original');
  }

  const limit = envInt('QUOTA_CUTOUT_PER_DAY', 30);
  try {
    const quota = await consumeQuota(admin, userId, 'cutout', limit);
    if (!quota.allowed) {
      return errorResponse(req, 429, 'quota_exceeded', 'Alcanzaste el límite diario de recortes', {
        limit,
      });
    }
  } catch (e) {
    console.error('Error consultando la cuota', e);
    return errorResponse(req, 500, 'server_error', 'No se pudo verificar tu uso diario');
  }

  try {
    const { data } = admin.storage.from('garments').getPublicUrl(path);
    const cutoutImageUrl = await removeBackgroundToStorage(admin, userId, data.publicUrl);
    return jsonResponse(req, { cutoutImageUrl });
  } catch (e) {
    // Fallo del servicio, no del usuario: se devuelve la cuota.
    await refundQuota(admin, userId, 'cutout');
    console.warn('remove-background falló:', e);
    const notConfigured = e instanceof CutoutError && e.kind === 'not_configured';
    return errorResponse(
      req,
      notConfigured ? 503 : 502,
      'ai_unavailable',
      'El servicio de recorte no está disponible ahora'
    );
  }
});
