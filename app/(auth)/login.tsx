import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { validateEmail, validatePassword } from '../../src/services/authErrors';
import { SOFT_TACTILE } from '../../src/theme/softTactile';

type Mode = 'login' | 'register' | 'forgot';

const TITLES: Record<Mode, { title: string; subtitle: string; cta: string }> = {
  login: {
    title: 'Bienvenido de vuelta',
    subtitle: 'Inicia sesión para ver tu armario en cualquier dispositivo.',
    cta: 'Iniciar sesión',
  },
  register: {
    title: 'Crea tu cuenta',
    subtitle: 'Guarda tu armario y tus outfits de forma segura.',
    cta: 'Crear cuenta',
  },
  forgot: {
    title: 'Recupera tu contraseña',
    subtitle: 'Te enviaremos un enlace para elegir una nueva.',
    cta: 'Enviar enlace',
  },
};

export default function LoginScreen() {
  const {
    configured,
    appleAvailable,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    sendPasswordReset,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = () =>
    run(async () => {
      if (!validateEmail(email)) throw new Error('Escribe un correo válido.');
      if (mode === 'forgot') {
        await sendPasswordReset(email);
        setInfo('Si el correo existe, recibirás un enlace para restablecer tu contraseña.');
        return;
      }
      const passwordError = validatePassword(password);
      if (mode === 'register') {
        if (passwordError) throw new Error(passwordError);
        const needsConfirmation = await signUpWithEmail(email, password, displayName);
        if (needsConfirmation) {
          setInfo('Te enviamos un correo de confirmación. Ábrelo para activar tu cuenta.');
          setMode('login');
        }
        return;
      }
      if (!password) throw new Error('Escribe tu contraseña.');
      await signInWithEmail(email, password);
    });

  const texts = TITLES[mode];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Ionicons name="shirt" size={26} color="#FFFFFF" />
            </View>
            <Text style={styles.brand}>WearWise</Text>
          </View>

          <Text style={styles.title}>{texts.title}</Text>
          <Text style={styles.subtitle}>{texts.subtitle}</Text>

          {!configured ? (
            <View style={[styles.banner, styles.bannerError]}>
              <Text style={styles.bannerErrorText}>
                La app no está conectada al servidor. Define EXPO_PUBLIC_SUPABASE_URL y
                EXPO_PUBLIC_SUPABASE_ANON_KEY.
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            {mode === 'register' ? (
              <>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="¿Cómo te llamamos?"
                  placeholderTextColor={SOFT_TACTILE.colors.textMuted}
                  autoCapitalize="words"
                  textContentType="name"
                />
              </>
            ) : null}

            <Text style={styles.label}>Correo</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@correo.com"
              placeholderTextColor={SOFT_TACTILE.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
            />

            {mode !== 'forgot' ? (
              <>
                <Text style={styles.label}>Contraseña</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : 'Tu contraseña'}
                  placeholderTextColor={SOFT_TACTILE.colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType={mode === 'register' ? 'newPassword' : 'password'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  onSubmitEditing={handleSubmit}
                />
              </>
            ) : null}

            {error ? (
              <View style={[styles.banner, styles.bannerError]}>
                <Text style={styles.bannerErrorText}>{error}</Text>
              </View>
            ) : null}
            {info ? (
              <View style={[styles.banner, styles.bannerInfo]}>
                <Text style={styles.bannerInfoText}>{info}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, (busy || !configured) && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={busy || !configured}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>{texts.cta}</Text>
              )}
            </TouchableOpacity>

            {mode === 'login' ? (
              <TouchableOpacity onPress={() => switchMode('forgot')} style={styles.linkBtn}>
                <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {mode !== 'forgot' ? (
            <View style={styles.socialBlock}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>o continúa con</Text>
                <View style={styles.dividerLine} />
              </View>

              {appleAvailable ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={18}
                  style={styles.appleBtn}
                  onPress={() => run(signInWithApple)}
                />
              ) : null}

              <TouchableOpacity
                style={[styles.googleBtn, (busy || !configured) && { opacity: 0.6 }]}
                onPress={() => run(signInWithGoogle)}
                disabled={busy || !configured}
                accessibilityRole="button"
              >
                <Ionicons name="logo-google" size={18} color={SOFT_TACTILE.colors.textPrimary} />
                <Text style={styles.googleBtnText}>Continuar con Google</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.footerRow}>
            {mode === 'login' ? (
              <>
                <Text style={styles.footerText}>¿No tienes cuenta?</Text>
                <TouchableOpacity onPress={() => switchMode('register')}>
                  <Text style={styles.linkText}> Regístrate</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.footerText}>
                  {mode === 'register' ? '¿Ya tienes cuenta?' : '¿Ya la recordaste?'}
                </Text>
                <TouchableOpacity onPress={() => switchMode('login')}>
                  <Text style={styles.linkText}> Inicia sesión</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: SOFT_TACTILE.colors.canvas },
  content: { padding: 22, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: SOFT_TACTILE.colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { color: SOFT_TACTILE.colors.textPrimary, fontSize: 24, fontWeight: '800' },
  title: { color: SOFT_TACTILE.colors.textPrimary, fontSize: 26, fontWeight: '800' },
  subtitle: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 18,
  },
  card: {
    backgroundColor: SOFT_TACTILE.colors.card,
    borderRadius: SOFT_TACTILE.radii.card,
    padding: 18,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    ...SOFT_TACTILE.shadow,
  },
  label: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: SOFT_TACTILE.colors.canvas,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 14,
  },
  banner: { borderRadius: 14, padding: 12, marginTop: 14 },
  bannerError: { backgroundColor: SOFT_TACTILE.colors.clayRedSoft },
  bannerErrorText: { color: SOFT_TACTILE.colors.clayRed, fontSize: 12.5, fontWeight: '700' },
  bannerInfo: { backgroundColor: SOFT_TACTILE.colors.sageSoft },
  bannerInfoText: { color: SOFT_TACTILE.colors.sage, fontSize: 12.5, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: SOFT_TACTILE.colors.terracotta,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  linkBtn: { alignItems: 'center', marginTop: 14 },
  linkText: { color: SOFT_TACTILE.colors.terracotta, fontSize: 13, fontWeight: '800' },
  socialBlock: { marginTop: 20, gap: 12 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: SOFT_TACTILE.colors.border },
  dividerText: { color: SOFT_TACTILE.colors.textMuted, fontSize: 12, fontWeight: '700' },
  appleBtn: { height: 50, width: '100%' },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    borderRadius: 18,
    backgroundColor: SOFT_TACTILE.colors.card,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.borderStrong,
  },
  googleBtnText: { color: SOFT_TACTILE.colors.textPrimary, fontSize: 14.5, fontWeight: '800' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  footerText: { color: SOFT_TACTILE.colors.textSecondary, fontSize: 13 },
});
