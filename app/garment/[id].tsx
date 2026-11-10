import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GarmentForm } from '../../src/components/GarmentForm';
import { useWardrobe } from '../../src/context/WardrobeContext';
import { SOFT_TACTILE } from '../../src/theme/softTactile';
import {
  formValuesFromGarment,
  garmentFieldsFromForm,
  GarmentFormValues,
  validateGarmentForm,
} from '../../src/utils/garmentForm';

export default function EditGarmentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { garments, updateGarment, deleteGarment, requestCutoutFor } = useWardrobe();

  const garment = garments.find((g) => g.id === id);
  const [values, setValues] = useState<GarmentFormValues | null>(
    garment ? formValuesFromGarment(garment) : null
  );
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cutoutBusy, setCutoutBusy] = useState(false);

  if (!garment || !values) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.muted}>No encontramos esta prenda.</Text>
          <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
            <Text style={styles.linkText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const errors = submitted ? validateGarmentForm(values) : {};

  const handleSave = async () => {
    setSubmitted(true);
    if (Object.keys(validateGarmentForm(values)).length > 0) return;
    setSaving(true);
    try {
      await updateGarment(garment.id, garmentFieldsFromForm(values));
      router.back();
    } catch {
      Alert.alert('No se pudo guardar', 'Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Eliminar prenda', `¿Quieres eliminar "${garment.name}" de tu armario?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteGarment(garment.id);
          router.back();
        },
      },
    ]);
  };

  const handleCutout = async () => {
    setCutoutBusy(true);
    try {
      const result = await requestCutoutFor(garment.id);
      if (result.status !== 'done' && result.message) {
        Alert.alert('Quitar fondo', result.message);
      }
    } finally {
      setCutoutBusy(false);
    }
  };

  const cutoutLabel: Record<typeof garment.cutout_status, string> = {
    none: 'La foto conserva su fondo original.',
    pending: 'Quitando el fondo: en cola, se reintenta automáticamente.',
    done: 'Fondo eliminado.',
    failed: 'No se pudo quitar el fondo de esta foto.',
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Volver" style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={SOFT_TACTILE.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Editar prenda
        </Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.previewBox}>
              <Image source={{ uri: garment.cutout_image_url }} style={styles.preview} resizeMode="cover" />
            </View>
            <Text style={styles.cutoutText}>{cutoutLabel[garment.cutout_status]}</Text>

            {garment.cutout_status !== 'done' ? (
              <TouchableOpacity
                style={[styles.secondaryBtn, cutoutBusy && { opacity: 0.6 }]}
                onPress={handleCutout}
                disabled={cutoutBusy}
              >
                {cutoutBusy ? (
                  <ActivityIndicator color={SOFT_TACTILE.colors.terracotta} />
                ) : (
                  <Ionicons name="cut-outline" size={16} color={SOFT_TACTILE.colors.terracotta} />
                )}
                <Text style={styles.secondaryBtnText}>
                  {garment.cutout_status === 'none' ? 'Quitar el fondo' : 'Reintentar quitar el fondo'}
                </Text>
              </TouchableOpacity>
            ) : null}

            <GarmentForm values={values} onChange={setValues} errors={errors} />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              )}
              <Text style={styles.saveBtnText}>Guardar cambios</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={17} color={SOFT_TACTILE.colors.clayRed} />
              <Text style={styles.deleteText}>Eliminar prenda</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: SOFT_TACTILE.colors.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: SOFT_TACTILE.colors.textSecondary, fontSize: 14 },
  linkBtn: { padding: 8 },
  linkText: { color: SOFT_TACTILE.colors.terracotta, fontWeight: '800', fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: SOFT_TACTILE.colors.textPrimary, fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
  content: { padding: 18, paddingBottom: 40 },
  card: {
    backgroundColor: SOFT_TACTILE.colors.card,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    ...SOFT_TACTILE.shadow,
  },
  previewBox: {
    alignSelf: 'center',
    width: 190,
    height: 190,
    borderRadius: 24,
    backgroundColor: SOFT_TACTILE.colors.recessed,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    marginBottom: 10,
  },
  preview: { width: '100%', height: '100%' },
  cutoutText: { color: SOFT_TACTILE.colors.textSecondary, fontSize: 12.5, textAlign: 'center', marginBottom: 8 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: SOFT_TACTILE.colors.terracottaSoft,
    paddingVertical: 11,
    borderRadius: 16,
    marginBottom: 6,
  },
  secondaryBtnText: { color: SOFT_TACTILE.colors.terracotta, fontSize: 13, fontWeight: '800' },
  saveBtn: {
    marginTop: 20,
    backgroundColor: SOFT_TACTILE.colors.sage,
    paddingVertical: 15,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  deleteBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
  },
  deleteText: { color: SOFT_TACTILE.colors.clayRed, fontSize: 13.5, fontWeight: '800' },
});
