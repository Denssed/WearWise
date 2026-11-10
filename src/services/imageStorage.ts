import { File } from 'expo-file-system';
import { getSupabaseClient } from './supabase';
import { newId } from '../utils/id';

export interface UploadedImage {
  path: string;
  publicUrl: string;
}

/**
 * Sube una imagen local (file://) a `garments/{userId}/original-<uuid>.jpg`.
 * Lanza si no hay conexión o la subida falla: quien llama decide cómo reaccionar.
 */
export async function uploadGarmentImage(userId: string, localUri: string): Promise<UploadedImage> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase no está configurado');

  const bytes = await new File(localUri).arrayBuffer();
  const path = `${userId}/original-${newId()}.jpg`;
  const { error } = await supabase.storage
    .from('garments')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from('garments').getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}
