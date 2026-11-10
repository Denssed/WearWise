import { describe, expect, it } from 'vitest';
import { friendlyAuthError, validateEmail, validatePassword } from './authErrors';
import { parseAuthUrl } from './authUrl';

describe('parseAuthUrl', () => {
  it('lee tokens del fragmento (recuperación de contraseña)', () => {
    const r = parseAuthUrl(
      'wearwise://auth-callback#access_token=abc.def&refresh_token=xyz&type=recovery&expires_in=3600'
    );
    expect(r).toMatchObject({ accessToken: 'abc.def', refreshToken: 'xyz', type: 'recovery' });
  });

  it('lee el código PKCE de la query', () => {
    expect(parseAuthUrl('wearwise://auth-callback?code=123').code).toBe('123');
  });

  it('reporta errores del proveedor', () => {
    const r = parseAuthUrl('wearwise://auth-callback#error=access_denied&error_description=Link+expired');
    expect(r.error).toBe('Link expired');
    expect(r.accessToken).toBeUndefined();
  });

  it('tolera URLs sin parámetros y valores mal codificados', () => {
    expect(parseAuthUrl('wearwise://auth-callback')).toEqual({
      accessToken: undefined,
      refreshToken: undefined,
      type: undefined,
      code: undefined,
      error: undefined,
    });
    expect(() => parseAuthUrl('wearwise://x#a=%E0%A4%A')).not.toThrow();
  });
});

describe('validaciones y mensajes de auth', () => {
  it('valida correo y contraseña', () => {
    expect(validateEmail('ana@correo.com')).toBe(true);
    expect(validateEmail('ana@correo')).toBe(false);
    expect(validatePassword('1234567')).not.toBeNull();
    expect(validatePassword('12345678')).toBeNull();
  });

  it('traduce errores de Supabase', () => {
    expect(friendlyAuthError('Invalid login credentials')).toBe('Correo o contraseña incorrectos.');
    expect(friendlyAuthError('User already registered')).toContain('Ya existe una cuenta');
    expect(friendlyAuthError(undefined)).toContain('error inesperado');
  });
});
