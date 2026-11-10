import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { validatePassword } from '../src/services/authErrors';
import { SOFT_TACTILE } from '../src/theme/softTactile';

export default function ResetPasswordScreen() {
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    const invalid = validatePassword(password);
    if (invalid) return setError(invalid);
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      await updatePassword(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.title}>Nueva contraseña</Text>
        <Text style={styles.subtitle}>Elige una contraseña nueva para tu cuenta.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Nueva contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor={SOFT_TACTILE.colors.textMuted}
            textContentType="newPassword"
          />
          <Text style={styles.label}>Repite la contraseña</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Repite la contraseña"
            placeholderTextColor={SOFT_TACTILE.colors.textMuted}
            onSubmitEditing={handleSave}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Guardar contraseña</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={signOut}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: SOFT_TACTILE.colors.canvas },
  content: { flex: 1, padding: 22, justifyContent: 'center' },
  title: { color: SOFT_TACTILE.colors.textPrimary, fontSize: 26, fontWeight: '800' },
  subtitle: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 14,
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
  error: { color: SOFT_TACTILE.colors.clayRed, fontSize: 12.5, fontWeight: '700', marginTop: 12 },
  primaryBtn: {
    backgroundColor: SOFT_TACTILE.colors.terracotta,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', marginTop: 14 },
  cancelText: { color: SOFT_TACTILE.colors.textSecondary, fontSize: 13, fontWeight: '700' },
});
