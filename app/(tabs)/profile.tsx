import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
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
import { useWardrobe } from '../../src/context/WardrobeContext';
import { ProfileMode, WeeklySchedule } from '../../src/types/wardrobe';

const STYLE_OPTIONS = [
  'Minimalista',
  'Smart Casual',
  'Casual Urbano',
  'Formal Ejecutivo',
  'Streetwear',
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

export default function ProfileAndApiScreen() {
  const {
    profile,
    apiSettings,
    updateProfile,
    updateApiSettings,
    regenerateWeeklyPlan,
  } = useWardrobe();

  const [savedBanner, setSavedBanner] = useState(false);

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
        <Text style={styles.title}>Perfil de Estilo & APIs</Text>
        <Text style={styles.subtitle}>
          Elige entre el Perfil Default inteligente o personaliza las reglas de estilo y
          agenda que Claude Haiku 5.5 usará cada semana.
        </Text>

        {/* SELECTOR DE MODO DE PERFIL: DEFAULT vs PERSONALIZADO */}
        <View style={styles.modeSelectorCard}>
          <TouchableOpacity
            style={[
              styles.modeOption,
              profile.profileMode === 'default' && styles.modeOptionActive,
            ]}
            onPress={() => handleModeSwitch('default')}
          >
            <Ionicons
              name="flash"
              size={18}
              color={profile.profileMode === 'default' ? '#FFFFFF' : '#94A3B8'}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.modeOptionTitle,
                  profile.profileMode === 'default' && { color: '#FFFFFF' },
                ]}
              >
                Perfil Default
              </Text>
              <Text style={styles.modeOptionDesc}>
                Balance Smart Casual automático según el clima y ropa limpia
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
              color={profile.profileMode === 'custom' ? '#FFFFFF' : '#94A3B8'}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.modeOptionTitle,
                  profile.profileMode === 'custom' && { color: '#FFFFFF' },
                ]}
              >
                Perfil Personalizado
              </Text>
              <Text style={styles.modeOptionDesc}>
                Tus estilos, sensibilidad térmica y rutina de Lunes a Domingo
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* CONFIGURACIÓN DEL PERFIL PERSONALIZADO */}
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
              Agenda Semanal por Día (guía para Claude)
            </Text>
            {SCHEDULE_LABELS.map((day) => (
              <View key={day.key} style={styles.scheduleRow}>
                <Text style={styles.scheduleDayLabel}>{day.label}</Text>
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
                  placeholderTextColor="#64748B"
                />
              </View>
            ))}

            <Text style={styles.fieldLabel}>
              Instrucciones extra para tu Estilista Claude Haiku
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 68 }]}
              multiline
              value={profile.customPromptNotes}
              onChangeText={(txt) => updateProfile({ customPromptNotes: txt })}
              placeholder="Ej. Los miércoles tengo junta directiva, los viernes prefiero usar tenis blancos..."
              placeholderTextColor="#64748B"
            />
          </View>
        ) : null}

        {/* CONFIGURACIÓN DE LLAVES API: REPLICATE (851-LABS) + CLAUDE HAIKU 5.5 + SUPABASE */}
        <View style={styles.sectionCard}>
          <View style={styles.apiHeaderRow}>
            <Ionicons name="key-outline" size={18} color="#818CF8" />
            <Text style={styles.sectionHeader}>
              Conexión de APIs (Replicate 851-labs + Claude Haiku 5.5)
            </Text>
          </View>
          <Text style={styles.apiHelperText}>
            Pega aquí tu token de Replicate (para 851-labs/background-remover) y tu API
            Key de Claude Haiku (o configúralos en .env / Supabase Edge Functions).
          </Text>

          <Text style={styles.fieldLabel}>
            Replicate API Token (851-labs/background-remover)
          </Text>
          <TextInput
            style={styles.input}
            value={apiSettings.replicateApiToken}
            onChangeText={(v) => updateApiSettings({ replicateApiToken: v.trim() })}
            placeholder="r8_..."
            placeholderTextColor="#64748B"
            secureTextEntry
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>
            Versión del Modelo Replicate (851-labs/background-remover)
          </Text>
          <TextInput
            style={styles.input}
            value={apiSettings.replicateBgVersion}
            onChangeText={(v) => updateApiSettings({ replicateBgVersion: v.trim() })}
            placeholder="a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>
            Claude API Key (Anthropic — Haiku 5.5)
          </Text>
          <TextInput
            style={styles.input}
            value={apiSettings.claudeApiKey}
            onChangeText={(v) => updateApiSettings({ claudeApiKey: v.trim() })}
            placeholder="sk-ant-api03-..."
            placeholderTextColor="#64748B"
            secureTextEntry
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Modelo de Claude</Text>
          <TextInput
            style={styles.input}
            value={apiSettings.claudeModel}
            onChangeText={(v) => updateApiSettings({ claudeModel: v.trim() })}
            placeholder="claude-haiku-4-5-20251001"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Supabase Project URL (Opcional)</Text>
          <TextInput
            style={styles.input}
            value={apiSettings.supabaseUrl}
            onChangeText={(v) => updateApiSettings({ supabaseUrl: v.trim() })}
            placeholder="https://xyz.supabase.co"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Supabase Anon Key (Opcional)</Text>
          <TextInput
            style={styles.input}
            value={apiSettings.supabaseAnonKey}
            onChangeText={(v) => updateApiSettings({ supabaseAnonKey: v.trim() })}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
            placeholderTextColor="#64748B"
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={styles.saveApplyBtn}
          onPress={handleSaveAndRegenerate}
        >
          <Ionicons name="sparkles" size={18} color="#FFFFFF" />
          <Text style={styles.saveApplyBtnText}>
            Guardar y Actualizar Sugerencias de la Semana
          </Text>
        </TouchableOpacity>

        {savedBanner ? (
          <View style={styles.savedToast}>
            <Ionicons name="checkmark-circle" size={18} color="#34D399" />
            <Text style={styles.savedToastText}>
              Configuración aplicada y semana recalculada con éxito.
            </Text>
          </View>
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 42,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
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
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modeOptionActive: {
    backgroundColor: '#312E81',
    borderColor: '#818CF8',
  },
  modeOptionActiveCustom: {
    backgroundColor: '#064E3B',
    borderColor: '#34D399',
  },
  modeOptionTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '800',
  },
  modeOptionDesc: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sectionHeader: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  apiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  apiHelperText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  chipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#818CF8',
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  scheduleDayLabel: {
    width: 78,
    color: '#E2E8F0',
    fontSize: 12.5,
    fontWeight: '700',
  },
  scheduleInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 12.5,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
  },
  saveApplyBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 15,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  savedToast: {
    marginTop: 12,
    backgroundColor: '#064E3B',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  savedToastText: {
    color: '#A7F3D0',
    fontSize: 13,
    fontWeight: '700',
  },
});
