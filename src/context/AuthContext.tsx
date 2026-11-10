import type { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import { friendlyAuthError } from '../services/authErrors';
import { parseAuthUrl } from '../services/authUrl';
import { getSupabaseClient } from '../services/supabase';
import { clearUserData } from '../storage/clearUserData';

WebBrowser.maybeCompleteAuthSession();

/** Ruta que recibe los enlaces de confirmación de correo, recuperación de contraseña y OAuth. */
const AUTH_CALLBACK_PATH = 'auth-callback';

export class AuthError extends Error {}

interface AuthContextValue {
  /** Supabase está configurado (variables EXPO_PUBLIC_* presentes). */
  configured: boolean;
  /** Aún se está restaurando la sesión guardada. */
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** El usuario llegó desde un enlace de recuperación y debe elegir una nueva contraseña. */
  recovering: boolean;
  appleAvailable: boolean;
  suggestedDisplayName: string;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Devuelve `true` si hay que confirmar el correo antes de entrar. */
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function nameFromUser(user: User | null): string {
  if (!user) return '';
  const meta = user.user_metadata ?? {};
  const fromMeta = (meta.full_name || meta.name || meta.display_name) as string | undefined;
  if (fromMeta && fromMeta.trim()) return fromMeta.trim();
  return user.email ? user.email.split('@')[0] : '';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  // Sin cliente Supabase no hay sesión que restaurar.
  const [loading, setLoading] = useState(supabase !== null);
  const [recovering, setRecovering] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // Procesa un deep link de Supabase (tokens en el fragmento o código PKCE).
  const handleAuthUrl = useCallback(
    async (url: string) => {
      if (!supabase) return;
      const parsed = parseAuthUrl(url);
      if (parsed.error) throw new AuthError(friendlyAuthError(parsed.error));
      if (parsed.accessToken && parsed.refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        if (error) throw new AuthError(friendlyAuthError(error.message));
        if (parsed.type === 'recovery') setRecovering(true);
      } else if (parsed.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
        if (error) throw new AuthError(friendlyAuthError(error.message));
      }
    },
    [supabase]
  );

  // Sesión guardada + cambios de sesión.
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // Renovación automática del token solo con la app en primer plano.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.startAutoRefresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      sub.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, [supabase]);

  // Enlaces entrantes (confirmación de correo, recuperación de contraseña).
  useEffect(() => {
    const onUrl = ({ url }: { url: string }) => {
      if (url.includes(AUTH_CALLBACK_PATH)) {
        handleAuthUrl(url).catch((e) => console.warn('Enlace de autenticación inválido:', e));
      }
    };
    const sub = Linking.addEventListener('url', onUrl);
    Linking.getInitialURL().then((url) => url && onUrl({ url }));
    return () => sub.remove();
  }, [handleAuthUrl]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const requireClient = useCallback(() => {
    if (!supabase) throw new AuthError('La app no está conectada al servidor (faltan variables de entorno).');
    return supabase;
  }, [supabase]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const client = requireClient();
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new AuthError(friendlyAuthError(error.message));
    },
    [requireClient]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const client = requireClient();
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: Linking.createURL(AUTH_CALLBACK_PATH),
          data: displayName?.trim() ? { full_name: displayName.trim() } : undefined,
        },
      });
      if (error) throw new AuthError(friendlyAuthError(error.message));
      // Con confirmación de correo activa, Supabase no devuelve sesión hasta confirmar.
      return !data.session;
    },
    [requireClient]
  );

  const signInWithGoogle = useCallback(async () => {
    const client = requireClient();
    const redirectTo = Linking.createURL(AUTH_CALLBACK_PATH);
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) throw new AuthError(friendlyAuthError(error?.message));

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success') {
      await handleAuthUrl(result.url);
    }
    // 'cancel' / 'dismiss': el usuario cerró la ventana, no es un error.
  }, [requireClient, handleAuthUrl]);

  const signInWithApple = useCallback(async () => {
    const client = requireClient();
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new AuthError('Apple no devolvió un token válido.');

      const { error } = await client.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) throw new AuthError(friendlyAuthError(error.message));

      // Apple solo entrega el nombre la primera vez: se guarda en los metadatos.
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (fullName) await client.auth.updateUser({ data: { full_name: fullName } });
    } catch (e) {
      if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return;
      throw e;
    }
  }, [requireClient]);

  const sendPasswordReset = useCallback(
    async (email: string) => {
      const client = requireClient();
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL(AUTH_CALLBACK_PATH),
      });
      if (error) throw new AuthError(friendlyAuthError(error.message));
    },
    [requireClient]
  );

  const updatePassword = useCallback(
    async (newPassword: string) => {
      const client = requireClient();
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw new AuthError(friendlyAuthError(error.message));
      setRecovering(false);
    },
    [requireClient]
  );

  const signOut = useCallback(async () => {
    const client = requireClient();
    setRecovering(false);
    await client.auth.signOut();
  }, [requireClient]);

  const deleteAccount = useCallback(async () => {
    const client = requireClient();
    const userId = session?.user.id;
    const { error } = await client.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      throw new AuthError(
        'No pudimos eliminar tu cuenta en este momento. Inténtalo de nuevo más tarde.'
      );
    }
    if (userId) await clearUserData(userId);
    // La cuenta ya no existe en el servidor: se cierra solo la sesión local.
    await client.auth.signOut({ scope: 'local' });
  }, [requireClient, session]);

  const user = session?.user ?? null;
  const value = useMemo<AuthContextValue>(
    () => ({
      configured: supabase !== null,
      loading,
      session,
      user,
      recovering,
      appleAvailable,
      suggestedDisplayName: nameFromUser(user),
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInWithApple,
      sendPasswordReset,
      updatePassword,
      signOut,
      deleteAccount,
    }),
    [
      supabase,
      loading,
      session,
      user,
      recovering,
      appleAvailable,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInWithApple,
      sendPasswordReset,
      updatePassword,
      signOut,
      deleteAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return ctx;
}
