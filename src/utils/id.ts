import * as Crypto from 'expo-crypto';

/** UUID v4. Las columnas `id` de Supabase son uuid, así que los IDs locales deben serlo también. */
export function newId(): string {
  return Crypto.randomUUID();
}
