import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/** Lado máximo de la imagen enviada a la IA. Suficiente para reconocer la prenda y mantiene el costo bajo. */
export const MAX_UPLOAD_WIDTH = 1024;
const JPEG_QUALITY = 0.7;

export interface PreparedImage {
  uri: string;
  base64: string;
  mimeType: 'image/jpeg';
}

/** Reduce y comprime la foto antes de subirla (el servidor rechaza imágenes > ~2.5 MB). */
export async function prepareImageForUpload(
  uri: string,
  width?: number
): Promise<PreparedImage> {
  const actions = width && width > MAX_UPLOAD_WIDTH ? [{ resize: { width: MAX_UPLOAD_WIDTH } }] : [];
  const result = await manipulateAsync(uri, actions, {
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return { uri: result.uri, base64: result.base64 ?? '', mimeType: 'image/jpeg' };
}
