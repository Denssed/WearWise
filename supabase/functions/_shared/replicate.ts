// Quitar fondo con Replicate (851-labs/background-remover) y guardar el PNG en Storage.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const DEFAULT_851LABS_VERSION =
  'a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc';

export class CutoutError extends Error {
  constructor(
    message: string,
    /** `unavailable`: el servicio no responde ahora (reintentable). */
    readonly kind: 'unavailable' | 'not_configured'
  ) {
    super(message);
  }
}

/**
 * Recibe la URL pública de la foto original, genera el recorte y lo sube a `{userId}/cutout-<uuid>.png`.
 * Devuelve la URL pública del PNG. Lanza CutoutError si el servicio falla.
 */
export async function removeBackgroundToStorage(
  admin: SupabaseClient,
  userId: string,
  imageUrl: string
): Promise<string> {
  const token = Deno.env.get('REPLICATE_API_TOKEN') ?? '';
  if (!token) throw new CutoutError('REPLICATE_API_TOKEN no configurado', 'not_configured');

  const rawVersion = Deno.env.get('REPLICATE_BG_VERSION') || DEFAULT_851LABS_VERSION;
  const version = rawVersion.includes(':') ? rawVersion.split(':')[1] : rawVersion;

  try {
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      signal: AbortSignal.timeout(35_000),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=30',
      },
      body: JSON.stringify({
        version,
        input: { image: imageUrl, format: 'png', reverse: false, threshold: 0, background_type: 'rgba' },
      }),
    });
    if (!createRes.ok) {
      throw new CutoutError(`Replicate respondió ${createRes.status}`, 'unavailable');
    }

    let prediction = await createRes.json();
    for (let i = 0; i < 10 && prediction?.urls?.get; i++) {
      if (['succeeded', 'failed', 'canceled'].includes(prediction.status)) break;
      await new Promise((r) => setTimeout(r, 1000));
      const poll = await fetch(prediction.urls.get, {
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${token}` },
      });
      if (poll.ok) prediction = await poll.json();
    }
    if (prediction?.status !== 'succeeded' || !prediction.output) {
      throw new CutoutError('Replicate no terminó el recorte', 'unavailable');
    }

    const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (typeof outputUrl !== 'string' || !outputUrl) {
      throw new CutoutError('Replicate no devolvió imagen', 'unavailable');
    }

    const png = await fetch(outputUrl, { signal: AbortSignal.timeout(20_000) });
    if (!png.ok) throw new CutoutError('No se pudo descargar el recorte', 'unavailable');

    const path = `${userId}/cutout-${crypto.randomUUID()}.png`;
    const { error } = await admin.storage
      .from('garments')
      .upload(path, await png.arrayBuffer(), { contentType: 'image/png', upsert: false });
    if (error) throw new CutoutError(`Storage: ${error.message}`, 'unavailable');

    const { data } = admin.storage.from('garments').getPublicUrl(path);
    if (!data?.publicUrl) throw new CutoutError('Sin URL pública', 'unavailable');
    return data.publicUrl;
  } catch (e) {
    if (e instanceof CutoutError) throw e;
    throw new CutoutError(e instanceof Error ? e.message : 'Error desconocido', 'unavailable');
  }
}
