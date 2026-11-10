/**
 * Configuración pública de la app. Solo variables EXPO_PUBLIC_* (se incluyen en el bundle).
 * La anon key de Supabase es pública por diseño; la seguridad real la dan las políticas RLS.
 * Nunca pongas aquí llaves de Replicate o Claude: viven en los secrets de las Edge Functions.
 */
export const ENV = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

export function isSupabaseConfigured(): boolean {
  return Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);
}
