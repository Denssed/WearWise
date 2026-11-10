import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useWardrobe } from '../../src/context/WardrobeContext';
import { SOFT_TACTILE } from '../../src/theme/softTactile';
import { ProfileMode, WeeklySchedule } from '../../src/types/wardrobe';

const STYLE_OPTIONS = [
  'Minimalista',
  'Smart Casual',
  'Cápsula Orgánica',
  'Casual Urbano',
  'Formal Ejecutivo',
  'Old Money / Clásico',
  'Deportivo / Athleisure',
];

const SCHEDULE_LABELS: { key: keyof WeeklySchedule; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

export default function ProfileScreen() {
  const {
    profile,
    updateProfile,
    regenerateWeeklyPlan,
  } = useWardrobe();

  const { user, signOut, deleteAccount } = useAuth();
  const [savedBanner, setSavedBanner] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Quieres cerrar la sesión en este dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', onPress: () => void signOut() },
    ]);
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Eliminar cuenta',
      'Se borrarán de forma permanente tu cuenta, tus prendas, tus fotos y tus planes. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar definitivamente',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
            } catch (e) {
              Alert.alert(
                'No se pudo eliminar',
                e instanceof Error ? e.message : 'Inténtalo de nuevo más tarde.'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const toggleArchetype = (styleName: string) => {
    const exists = profile.styleArchetypes.includes(styleName);
    const next = exists
      ? profile.styleArchetypes.filter((s) => s !== styleName)
      : [...profile.styleArchetypes, styleName];
    updateProfile({ styleArchetypes: next.length > 0 ? next : [styleName] });
  };

  const handleModeSwitch = async (mode: ProfileMode) => {
    await updateProfile({ profileMode: mode });
  };

  const handleSaveAndRegenerate = async () => {
    setSavedBanner(true);
    await regenerateWeeklyPlan();
    setTimeout(() => setSavedBanner(false), 3000);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Mi Perfil de Estilo</Text>
          <Text style={styles.subtitle}>
            Elige entre el Perfil Default equilibrado o personaliza tus reglas de estilo,
            clima y agenda para tus sugerencias semanales.
          </Text>

          {/* SELECTOR DE MODO DE PERFIL SOFT TACTILE */}
          <View style={styles.modeSelectorCard}>
            <TouchableOpacity
              style={[
                styles.modeOption,
                profile.profileMode === 'default' && styles.modeOptionActive,
              ]}
              onPress={() => handleModeSwitch('default')}
            >
              <Ionicons
                name="leaf"
                size={18}
                color={
                  profile.profileMode === 'default'
                    ? '#FFFFFF'
                    : SOFT_TACTILE.colors.terracotta
                }
              />
              <View style={styles.modeOptionTextWrap}>
                <Text
                  style={[
                    styles.modeOptionTitle,
                    profile.profileMode === 'default' && { color: '#FFFFFF' },
                  ]}
                  numberOfLines={1}
                >
                  Perfil Default (Cápsula Equilibrada)
                </Text>
                <Text
                  style={[
                    styles.modeOptionDesc,
                    profile.profileMode === 'default' && { color: '#FFFDF9' },
                  ]}
                  numberOfLines={2}
                >
                  Balance Smart Casual automático según el clima y ropa fresca
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeOption,
                profile.profileMode === 'custom' && styles.modeOptionActiveCustom,
              ]}
              onPress={() => handleModeSwitch('custom')}
            >
              <Ionicons
                name="options"
                size={18}
                color={
                  profile.profileMode === 'custom'
                    ? '#FFFFFF'
                    : SOFT_TACTILE.colors.sage
                }
              />
              <View style={styles.modeOptionTextWrap}>
                <Text
                  style={[
                    styles.modeOptionTitle,
                    profile.profileMode === 'custom' && { color: '#FFFFFF' },
                  ]}
                  numberOfLines={1}
                >
                  Perfil Personalizado
                </Text>
                <Text
                  style={[
                    styles.modeOptionDesc,
                    profile.profileMode === 'custom' && { color: '#FFFDF9' },
                  ]}
                  numberOfLines={2}
                >
                  Tus estilos, sensibilidad térmica y rutina de Lunes a Domingo
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* DATOS BÁSICOS DEL USUARIO */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Datos Personales y Ubicación</Text>

            <View style={styles.twoColRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fieldLabel} numberOfLines={1}>
                  Tu Nombre
                </Text>
                <TextInput
                  style={styles.input}
                  value={profile.displayName}
                  onChangeText={(txt) => updateProfile({ displayName: txt })}
                  placeholder="Tu nombre"
                  placeholderTextColor={SOFT_TACTILE.colors.textMuted}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fieldLabel} numberOfLines={1}>
                  Ciudad para el Clima
                </Text>
                <TextInput
                  style={styles.input}
                  value={profile.cityName}
                  onChangeText={(txt) => updateProfile({ cityName: txt })}
                  placeholder="Ej. Ciudad de México"
                  placeholderTextColor={SOFT_TACTILE.colors.textMuted}
                />
              </View>
            </View>
          </View>

          {profile.profileMode === 'custom' ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>
                Preferencias de tu Perfil Personalizado
              </Text>

              <Text style={styles.fieldLabel}>Arquetipos de Estilo</Text>
              <View style={styles.chipsWrap}>
                {STYLE_OPTIONS.map((st) => {
                  const selected = profile.styleArchetypes.includes(st);
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => toggleArchetype(st)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {st}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Sensibilidad al Clima</Text>
              <View style={styles.chipsWrap}>
                {[
                  { key: 'cold_sensitive' as const, label: 'Friolento (Más capas)' },
                  { key: 'normal' as const, label: 'Estándar' },
                  { key: 'heat_sensitive' as const, label: 'Caluroso (Telas frescas)' },
                ].map((item) => {
                  const active = profile.climateSensitivity === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.chip, active && styles.chipSelected]}
                      onPress={() => updateProfile({ climateSensitivity: item.key })}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextSelected]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>
                Agenda Semanal por Día
              </Text>
              {SCHEDULE_LABELS.map((day) => (
                <View key={day.key} style={styles.scheduleRow}>
                  <Text style={styles.scheduleDayLabel} numberOfLines={1}>
                    {day.label}
                  </Text>
                  <TextInput
                    style={styles.scheduleInput}
                    value={profile.weeklySchedule[day.key]}
                    onChangeText={(txt) =>
                      updateProfile({
                        weeklySchedule: {
                          ...profile.weeklySchedule,
                          [day.key]: txt,
                        },
                      })
                    }
                    placeholder="Actividad del día"
                    placeholderTextColor={SOFT_TACTILE.colors.textMuted}
                  />
                </View>
              ))}

              <Text style={styles.fieldLabel}>
                Notas extra para tu Estilista Personal
              </Text>
              <TextInput
                style={[styles.input, { minHeight: 68 }]}
                multiline
                value={profile.customPromptNotes}
                onChangeText={(txt) => updateProfile({ customPromptNotes: txt })}
                placeholder="Ej. Los miércoles tengo junta directiva, los viernes prefiero usar tenis blancos..."
                placeholderTextColor={SOFT_TACTILE.colors.textMuted}
              />
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.saveApplyBtn}
            onPress={handleSaveAndRegenerate}
          >
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            <Text style={styles.saveApplyBtnText} numberOfLines={2}>
              Guardar y Actualizar Sugerencias de la Semana
            </Text>
          </TouchableOpacity>

          {savedBanner ? (
            <View style={styles.savedToast}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={SOFT_TACTILE.colors.sage}
              />
              <Text style={styles.savedToastText} numberOfLines={2}>
                Configuración aplicada y semana recalculada con éxito.
              </Text>
            </View>
          ) : null}

          {/* CUENTA */}
          <View style={[styles.sectionCard, { marginTop: 22 }]}>
            <Text style={styles.sectionHeader}>Cuenta</Text>
            <Text style={styles.accountEmail} numberOfLines={1}>
              {user?.email ?? 'Sesión iniciada'}
            </Text>

            <TouchableOpacity style={styles.accountBtn} onPress={confirmSignOut}>
              <Ionicons name="log-out-outline" size={18} color={SOFT_TACTILE.colors.textPrimary} />
              <Text style={styles.accountBtnText}>Cerrar sesión</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.accountBtn, styles.dangerBtn]}
              onPress={confirmDeleteAccount}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color={SOFT_TACTILE.colors.clayRed} />
              ) : (
                <Ionicons name="trash-outline" size={18} color={SOFT_TACTILE.colors.clayRed} />
              )}
              <Text style={[styles.accountBtnText, { color: SOFT_TACTILE.colors.clayRed }]}>
                Eliminar mi cuenta
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: SOFT_TACTILE.colors.canvas,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 42,
  },
  title: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 25,
    fontWeight: '800',
  },
  subtitle: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 16,
  },
  modeSelectorCard: {
    gap: 10,
    marginBottom: 16,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SOFT_TACTILE.colors.card,
    padding: 15,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    ...SOFT_TACTILE.shadow,
  },
  modeOptionActive: {
    backgroundColor: SOFT_TACTILE.colors.terracotta,
    borderColor: SOFT_TACTILE.colors.terracotta,
  },
  modeOptionActiveCustom: {
    backgroundColor: SOFT_TACTILE.colors.sage,
    borderColor: SOFT_TACTILE.colors.sage,
  },
  modeOptionTextWrap: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  modeOptionTitle: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 14.5,
    fontWeight: '800',
  },
  modeOptionDesc: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: SOFT_TACTILE.colors.card,
    borderRadius: 26,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    ...SOFT_TACTILE.shadow,
  },
  sectionHeader: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 15.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldLabel: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    backgroundColor: SOFT_TACTILE.colors.canvas,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    maxWidth: '100%',
  },
  chipSelected: {
    backgroundColor: SOFT_TACTILE.colors.terracotta,
    borderColor: SOFT_TACTILE.colors.terracotta,
  },
  chipText: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  scheduleDayLabel: {
    width: 78,
    flexShrink: 0,
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 12.5,
    fontWeight: '800',
  },
  scheduleInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: SOFT_TACTILE.colors.canvas,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 12.5,
  },
  input: {
    backgroundColor: SOFT_TACTILE.colors.canvas,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 13,
  },
  saveApplyBtn: {
    backgroundColor: SOFT_TACTILE.colors.terracotta,
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SOFT_TACTILE.shadow,
  },
  saveApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },
  savedToast: {
    marginTop: 12,
    backgroundColor: SOFT_TACTILE.colors.sageSoft,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  accountEmail: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 6,
  },
  accountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: 18,
    backgroundColor: SOFT_TACTILE.colors.canvas,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
  },
  dangerBtn: {
    backgroundColor: SOFT_TACTILE.colors.clayRedSoft,
    borderColor: SOFT_TACTILE.colors.clayRedSoft,
  },
  accountBtnText: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 13.5,
    fontWeight: '800',
  },
  savedToastText: {
    color: SOFT_TACTILE.colors.sage,
    fontSize: 12.5,
    fontWeight: '800',
    flexShrink: 1,
  },
});
