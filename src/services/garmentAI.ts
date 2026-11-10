import { AiServiceError, classifyFailure } from './aiErrors';
import { getSupabaseClient } from './supabase';
import type { AnalysisLike } from '../utils/garmentForm';

export interface GarmentAnalysis extends AnalysisLike {
  pattern: string;
}

/** Estado HTTP de un error de `functions.invoke`; undefined si ni siquiera hubo respuesta (sin conexión). */
function statusOf(error: unknown): number | undefined {
  const status = (error as { context?: { status?: unknown } })?.context?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Pide a la Edge Function `analyze-garment` (Claude Vision) que etiquete la prenda.
 * Lanza AiServiceError si no se puede: la pantalla muestra el aviso y deja capturar los datos a mano.
 */
export async function analyzeGarmentImage(
  imageBase64: string,
  mimeType = 'image/jpeg'
): Promise<GarmentAnalysis> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new AiServiceError('unavailable', true, 'La app no está conectada al servidor.');

  try {
    const { data, error } = await supabase.functions.invoke('analyze-garment', {
      body: { imageBase64, mimeType },
    });
    if (error) throw classifyFailure(statusOf(error), 'analysis');
    if (!data?.analysis) throw classifyFailure(502, 'analysis');
    return data.analysis as GarmentAnalysis;
  } catch (e) {
    if (e instanceof AiServiceError) throw e;
    throw classifyFailure(undefined, 'analysis');
  }
}

/**
 * Pide a `remove-background` el recorte de una foto ya subida a Storage (ruta dentro del bucket).
 * Devuelve la URL pública del PNG sin fondo. Lanza AiServiceError (con `retryable`) si falla.
 */
export async function requestCutout(storagePath: string): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new AiServiceError('unavailable', true, 'La app no está conectada al servidor.');

  try {
    const { data, error } = await supabase.functions.invoke('remove-background', {
      body: { path: storagePath },
    });
    if (error) throw classifyFailure(statusOf(error), 'cutout');
    if (typeof data?.cutoutImageUrl !== 'string') throw classifyFailure(502, 'cutout');
    return data.cutoutImageUrl;
  } catch (e) {
    if (e instanceof AiServiceError) throw e;
    throw classifyFailure(undefined, 'cutout');
  }
}
