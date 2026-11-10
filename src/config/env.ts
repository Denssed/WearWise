/**
 * Configuración pública de la app. Solo variables EXPO_PUBLIC_* (se incluyen en el bundle).
 * La anon key de Supabase es pública por diseño; la seguridad real la dan las políticas RLS.
 * Nunca pongas aquí llaves de Replicate o Claude: viven en los secrets de las Edge Functions.
 */
export const ENV = {
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    'https://gnhsmapjozmxpmhtudgx.supabase.co',
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduaHNtYXBqb3pteHBtaHR1ZGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzMzU5ODMsImV4cCI6MjEwOTkxMTk4M30.mS7472u9Tk_ScgBc1xhEDAxyENcEsA32LMJ30PEi7j0',
};

export function isSupabaseConfigured(): boolean {
  return Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);
}
