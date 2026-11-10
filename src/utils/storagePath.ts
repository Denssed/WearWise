const PUBLIC_MARKER = '/storage/v1/object/public/garments/';

/** Ruta del archivo dentro del bucket `garments` a partir de su URL pública, o null si no es de Storage. */
export function storagePathFromPublicUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const idx = url.indexOf(PUBLIC_MARKER);
  if (idx === -1) return null;
  const path = url.slice(idx + PUBLIC_MARKER.length).split('?')[0];
  try {
    return decodeURIComponent(path) || null;
  } catch {
    return null;
  }
}

/** La imagen aún vive solo en el dispositivo (no se pudo subir a Storage). */
export function isLocalImageUri(uri: string | undefined | null): boolean {
  return Boolean(uri && (uri.startsWith('file:') || uri.startsWith('content:') || uri.startsWith('data:')));
}
