import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GarmentForm } from '../../src/components/GarmentForm';
import { useAuth } from '../../src/context/AuthContext';
import { useWardrobe } from '../../src/context/WardrobeContext';
import { AiServiceError } from '../../src/services/aiErrors';
import { analyzeGarmentImage } from '../../src/services/garmentAI';
import { PreparedImage, prepareImageForUpload } from '../../src/services/imagePrep';
import { uploadGarmentImage } from '../../src/services/imageStorage';
import { SOFT_TACTILE } from '../../src/theme/softTactile';
import {
  emptyFormValues,
  formValuesFromAnalysis,
  garmentFieldsFromForm,
  GarmentFormValues,
  validateGarmentForm,
} from '../../src/utils/garmentForm';

type Stage = 'pick' | 'processing' | 'form';

export default function AddGarmentScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addGarment } = useWardrobe();

  const [stage, setStage] = useState<Stage>('pick');
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [values, setValues] = useState<GarmentFormValues>(emptyFormValues());
  const [pattern, setPattern] = useState('liso');
  const [source, setSource] = useState<'ai' | 'manual'>('manual');
  const [notice, setNotice] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [wantCutout, setWantCutout] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const errors = submitted ? validateGarmentForm(values) : {};

  const resetAll = () => {
    setStage('pick');
    setImage(null);
    setValues(emptyFormValues());
    setPattern('liso');
    setSource('manual');
    setNotice(null);
    setSubmitted(false);
  };

  const handlePick = async (useCamera: boolean) => {
    try {
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permiso necesario',
          useCamera
            ? 'Activa el permiso de cámara en los ajustes para fotografiar tus prendas.'
            : 'Activa el permiso de fotos en los ajustes para elegir imágenes de tu galería.'
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      };
      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setStage('processing');
      const prepared = await prepareImageForUpload(asset.uri, asset.width);
      setImage(prepared);
      setNotice(null);
      setSubmitted(false);

      if (manualMode) {
        setValues(emptyFormValues());
        setSource('manual');
        setStage('form');
        return;
      }

      try {
        const analysis = await analyzeGarmentImage(prepared.base64, prepared.mimeType);
        setValues(formValuesFromAnalysis(analysis));
        setPattern(analysis.pattern || 'liso');
        setSource('ai');
      } catch (e) {
        // La IA no está disponible: la prenda se puede agregar igual, rellenando los datos a mano.
        const reason = e instanceof AiServiceError ? e.message : 'No pudimos analizar la prenda.';
        setNotice(`${reason} No se pudo agregar con IA ahora; completa los datos manualmente.`);
        setValues(emptyFormValues());
        setSource('manual');
      }
      setStage('form');
    } catch (e) {
      console.warn('Error preparando la foto:', e);
      Alert.alert('No pudimos usar esa foto', 'Inténtalo con otra imagen.');
      setStage(image ? 'form' : 'pick');
    }
  };

  const handleSave = async () => {
    setSubmitted(true);
    if (!image || Object.keys(validateGarmentForm(values)).length > 0) return;

    setSaving(true);
    try {
      // La foto se sube a Storage; si no hay conexión se guarda local y se sube después automáticamente.
      let imageUrl = image.uri;
      if (user) {
        try {
          imageUrl = (await uploadGarmentImage(user.id, image.uri)).publicUrl;
        } catch (e) {
          console.warn('Foto guardada solo en el dispositivo por ahora:', e);
        }
      }

      await addGarment({
        ...garmentFieldsFromForm(values),
        pattern,
        cutout_image_url: imageUrl,
        original_image_url: imageUrl,
        cutout_status: wantCutout ? 'pending' : 'none',
        analysis_source: source,
        current_wears: 0,
        total_lifetime_wears: 0,
        status: 'clean',
        is_favorite: false,
      });

      resetAll();
      router.push('/(tabs)/wardrobe');
    } catch (e) {
      console.warn('Error guardando la prenda:', e);
      Alert.alert('No se pudo guardar', 'Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
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
          <Text style={styles.title}>Agregar Nueva Prenda</Text>
          <Text style={styles.subtitle}>
            Toma o sube una foto. La IA puede detectar la tela, el lavado y los usos; si no está
            disponible, completas los datos tú mismo y la prenda se guarda igual.
          </Text>

          <View style={styles.captureButtonsRow}>
            <TouchableOpacity
              style={[styles.cameraButton, stage === 'processing' && styles.disabled]}
              onPress={() => handlePick(true)}
              disabled={stage === 'processing'}
            >
              <Ionicons name="camera" size={20} color="#FFFFFF" />
              <Text style={styles.captureButtonText} numberOfLines={1}>
                Tomar Foto
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.galleryButton, stage === 'processing' && styles.disabled]}
              onPress={() => handlePick(false)}
              disabled={stage === 'processing'}
            >
              <Ionicons name="images" size={20} color={SOFT_TACTILE.colors.textPrimary} />
              <Text
                style={[styles.captureButtonText, { color: SOFT_TACTILE.colors.textPrimary }]}
                numberOfLines={1}
              >
                Subir de Galería
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.optionRow}>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Llenar los datos a mano (sin IA)</Text>
              <Text style={styles.optionDesc}>No se usa el análisis automático al elegir la foto.</Text>
            </View>
            <Switch
              value={manualMode}
              onValueChange={setManualMode}
              trackColor={{ true: SOFT_TACTILE.colors.terracotta, false: SOFT_TACTILE.colors.pillBg }}
            />
          </View>

          {stage === 'processing' ? (
            <View style={styles.processingCard}>
              <ActivityIndicator size="large" color={SOFT_TACTILE.colors.terracotta} />
              <Text style={styles.processingText}>
                {manualMode ? 'Preparando la foto...' : 'Analizando tela, lavado y cuidado textil...'}
              </Text>
            </View>
          ) : null}

          {stage === 'form' && image ? (
            <View style={styles.formCard}>
              {notice ? (
                <View style={styles.noticeBox}>
                  <Ionicons name="alert-circle" size={18} color={SOFT_TACTILE.colors.ochre} />
                  <Text style={styles.noticeText}>{notice}</Text>
                </View>
              ) : null}

              <View style={styles.previewSection}>
                <View style={styles.previewBox}>
                  <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="cover" />
                </View>
                <View style={styles.badge}>
                  <Ionicons
                    name={source === 'ai' ? 'sparkles-outline' : 'create-outline'}
                    size={12}
                    color={source === 'ai' ? SOFT_TACTILE.colors.terracotta : SOFT_TACTILE.colors.textSecondary}
                  />
                  <Text style={styles.badgeText}>
                    {source === 'ai' ? 'Datos sugeridos por IA (revísalos)' : 'Datos manuales'}
                  </Text>
                </View>
              </View>

              <GarmentForm
                values={values}
                onChange={setValues}
                errors={errors}
                applyCategoryDefaults={source === 'manual'}
              />

              <View style={[styles.optionRow, { marginTop: 18, marginBottom: 0 }]}>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionTitle}>Quitar el fondo de la foto</Text>
                  <Text style={styles.optionDesc}>
                    Se hace en segundo plano; si el servicio no responde, se reintenta solo.
                  </Text>
                </View>
                <Switch
                  value={wantCutout}
                  onValueChange={setWantCutout}
                  trackColor={{ true: SOFT_TACTILE.colors.sage, false: SOFT_TACTILE.colors.pillBg }}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveGarmentBtn, saving && styles.disabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                )}
                <Text style={styles.saveGarmentBtnText} numberOfLines={1}>
                  Guardar Prenda en Mi Armario
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.discardBtn} onPress={resetAll} disabled={saving}>
                <Text style={styles.discardText}>Descartar</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: SOFT_TACTILE.colors.canvas },
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  title: { color: SOFT_TACTILE.colors.textPrimary, fontSize: 25, fontWeight: '800' },
  subtitle: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 18,
  },
  disabled: { opacity: 0.55 },
  captureButtonsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  cameraButton: {
    flex: 1,
    minWidth: 0,
    backgroundColor: SOFT_TACTILE.colors.terracotta,
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    ...SOFT_TACTILE.shadow,
  },
  galleryButton: {
    flex: 1,
    minWidth: 0,
    backgroundColor: SOFT_TACTILE.colors.card,
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
  },
  captureButtonText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800', flexShrink: 1 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SOFT_TACTILE.colors.card,
    borderRadius: 20,
    padding: 13,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    marginBottom: 16,
  },
  optionTextWrap: { flex: 1, minWidth: 0 },
  optionTitle: { color: SOFT_TACTILE.colors.textPrimary, fontSize: 13, fontWeight: '800' },
  optionDesc: { color: SOFT_TACTILE.colors.textSecondary, fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  processingCard: {
    backgroundColor: SOFT_TACTILE.colors.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
  },
  processingText: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: SOFT_TACTILE.colors.card,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    ...SOFT_TACTILE.shadow,
  },
  noticeBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: SOFT_TACTILE.colors.ochreSoft,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  noticeText: { flex: 1, color: SOFT_TACTILE.colors.textPrimary, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  previewSection: { alignItems: 'center', marginBottom: 6 },
  previewBox: {
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SOFT_TACTILE.colors.canvas,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    maxWidth: '100%',
  },
  badgeText: { color: SOFT_TACTILE.colors.textPrimary, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  saveGarmentBtn: {
    marginTop: 18,
    backgroundColor: SOFT_TACTILE.colors.sage,
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveGarmentBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', flexShrink: 1 },
  discardBtn: { alignItems: 'center', marginTop: 12 },
  discardText: { color: SOFT_TACTILE.colors.textSecondary, fontSize: 13, fontWeight: '700' },
});
