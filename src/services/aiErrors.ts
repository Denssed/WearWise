export type AiErrorCode = 'quota_exceeded' | 'unavailable' | 'unauthorized' | 'invalid' | 'network';

export class AiServiceError extends Error {
  constructor(
    readonly code: AiErrorCode,
    /** Si tiene sentido volver a intentarlo más tarde sin cambiar nada. */
    readonly retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = 'AiServiceError';
  }
}

/** Convierte el estado HTTP de una Edge Function en un error tipado. `status` undefined = sin conexión. */
export function classifyFailure(
  status: number | undefined,
  action: 'analysis' | 'cutout'
): AiServiceError {
  const what = action === 'analysis' ? 'analizar la prenda con IA' : 'quitar el fondo';
  if (status === undefined) {
    return new AiServiceError('network', true, `Sin conexión: no pudimos ${what}. Revisa tu internet.`);
  }
  if (status === 401) {
    return new AiServiceError('unauthorized', false, 'Tu sesión expiró. Inicia sesión de nuevo.');
  }
  if (status === 429) {
    return new AiServiceError(
      'quota_exceeded',
      true,
      `Alcanzaste el límite diario para ${what}. Se restablece mañana.`
    );
  }
  if (status === 400 || status === 404 || status === 413) {
    return new AiServiceError('invalid', false, `No pudimos ${what} con esta imagen.`);
  }
  return new AiServiceError('unavailable', true, `El servicio para ${what} no está disponible ahora.`);
}
