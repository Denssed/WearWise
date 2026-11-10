/** Traduce errores comunes de Supabase Auth a mensajes claros en español. */
export function friendlyAuthError(message: string | undefined | null): string {
  const msg = (message ?? '').toLowerCase();
  if (!msg) return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  if (msg.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (msg.includes('email not confirmed')) return 'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.';
  if (msg.includes('user already registered') || msg.includes('already been registered'))
    return 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.';
  if (msg.includes('password should be at least')) return 'La contraseña es demasiado corta (mínimo 8 caracteres).';
  if (msg.includes('unable to validate email') || msg.includes('invalid email'))
    return 'El correo no es válido.';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  if (msg.includes('network') || msg.includes('failed to fetch'))
    return 'No hay conexión con el servidor. Revisa tu internet.';
  if (msg.includes('same password')) return 'La nueva contraseña debe ser distinta a la anterior.';
  if (msg.includes('provider is not enabled') || msg.includes('unsupported provider'))
    return 'Este método de acceso aún no está habilitado.';
  return message ?? 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

export const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH)
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  return null;
}
