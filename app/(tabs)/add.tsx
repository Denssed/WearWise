import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { processGarmentWithAI } from '../../src/services/aiPipeline';
import { SOFT_TACTILE } from '../../src/theme/softTactile';
import {
  CATEGORY_LABELS,
  GarmentCategory,
  WASH_GROUP_INFO,
  WashCareGroup,
} from '../../src/types/wardrobe';

const DEMO_SAMPLES = [
  {
    label: 'Chamarra Denim',
    uri: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=600&q=80',
    preset: {
      name: 'Chamarra Trucker Mezclilla Azul',
      category: 'outerwear' as GarmentCategory,
      subcategory: 'Chamarra Mezclilla',
      colors: ['Azul Medio'],
      fabric: 'Mezclilla 100% Algodón',
      wash_care_group: 'darks' as WashCareGroup,
      max_wears_before_wash: 8,
      care_instructions: 'Lavar en frío al revés cada 8 puestas.',
      ai_styling_notes: 'Ideal sobre camiseta blanca con chinos beige o pantalón negro.',
    },
  },
  {
    label: 'Camisa Lino Blanca',
    uri: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=600&q=80',
    preset: {
      name: 'Camisa Lino Blanca Relaxed',
      category: 'top' as GarmentCategory,
      subcategory: 'Camisa de Lino',
      colors: ['Blanco'],
      fabric: 'Lino Europeo',
      wash_care_group: 'whites' as WashCareGroup,
      max_wears_before_wash: 2,
      care_instructions: 'Ciclo delicado con blancos, secar a la sombra en gancho.',
      ai_styling_notes: 'Perfecta para días cálidos con chinos arena o jeans.',
    },
  },
];

export default function AddGarmentScreen() {
  const router = useRouter();
  const { addGarment, apiSettings } = useWardrobe();

  const [sourceImageUri, setSourceImageUri] = useState<string | null>(null);
  const [cutoutImageUri, setCutoutImageUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string>('');
  const [bgEngineUsed, setBgEngineUsed] = useState<string>('');
  const [aiEngineUsed, setAiEngineUsed] = useState<string>('');

  const [name, setName] = useState('');
  const [category, setCategory] = useState<GarmentCategory>('top');
  const [subcategory, setSubcategory] = useState('Camisa');
  const [colorsText, setColorsText] = useState('Azul, Blanco');
  const [fabric, setFabric] = useState('Algodón');
  const [washGroup, setWashGroup] = useState<WashCareGroup>('colors');
  const [maxWears, setMaxWears] = useState('3');
  const [careInstructions, setCareInstructions] = useState(
    'Lavar en agua fría (30°C) ciclo suave.'
  );
  const [stylingNotes, setStylingNotes] = useState('');

  const handleCaptureOrPick = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
            base64: true,
          });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setSourceImageUri(asset.uri);
      setIsProcessing(true);
      setPipelineStage(
        '1/2 Quitando fondo con Replicate (851-labs) · 2/2 Auto-etiquetando con Claude Haiku 5.5...'
      );

      const aiResult = await processGarmentWithAI(
        asset.uri,
        asset.base64,
        asset.mimeType || 'image/jpeg',
        apiSettings
      );

      setCutoutImageUri(aiResult.cutoutImageUrl);
      setBgEngineUsed(
        aiResult.bgRemovalProvider === 'replicate_851labs'
          ? 'Replicate 851-labs Cutout'
          : 'Recorte Inteligente'
      );
      setAiEngineUsed(
        aiResult.aiProvider === 'claude_haiku'
          ? 'Claude Haiku 5.5 Vision'
          : 'Auto-Tag Inteligente'
      );

      setName(aiResult.name);
      setCategory(aiResult.category);
      setSubcategory(aiResult.subcategory);
      setColorsText(aiResult.colors.join(', '));
      setFabric(aiResult.fabric);
      setWashGroup(aiResult.wash_care_group);
      setMaxWears(String(aiResult.max_wears_before_wash));
      setCareInstructions(aiResult.care_instructions);
      setStylingNotes(aiResult.ai_styling_notes);
    } finally {
      setIsProcessing(false);
      setPipelineStage('');
    }
  };

  const handleLoadSample = (sample: (typeof DEMO_SAMPLES)[0]) => {
    setSourceImageUri(sample.uri);
    setCutoutImageUri(sample.uri);
    setBgEngineUsed('Replicate 851-labs (Demo)');
    setAiEngineUsed('Claude Haiku 5.5 Vision');
    setName(sample.preset.name);
    setCategory(sample.preset.category);
    setSubcategory(sample.preset.subcategory);
    setColorsText(sample.preset.colors.join(', '));
    setFabric(sample.preset.fabric);
    setWashGroup(sample.preset.wash_care_group);
    setMaxWears(String(sample.preset.max_wears_before_wash));
    setCareInstructions(sample.preset.care_instructions);
    setStylingNotes(sample.preset.ai_styling_notes);
  };

  const handleSaveToWardrobe = async () => {
    if (!cutoutImageUri || !name.trim()) return;

    await addGarment({
      name: name.trim(),
      category,
      subcategory: subcategory.trim() || 'Prenda',
      cutout_image_url: cutoutImageUri,
      original_image_url: sourceImageUri || cutoutImageUri,
      colors: colorsText
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      pattern: 'liso',
      fabric: fabric.trim() || 'Algodón',
      seasons: ['primavera', 'verano', 'otoño', 'invierno'],
      formality: 3,
      wash_care_group: washGroup,
      care_instructions: careInstructions,
      current_wears: 0,
      max_wears_before_wash: Math.max(1, parseInt(maxWears, 10) || 2),
      total_lifetime_wears: 0,
      status: 'clean',
      ai_styling_notes: stylingNotes,
      is_favorite: false,
    });

    setSourceImageUri(null);
    setCutoutImageUri(null);
    setName('');
    router.push('/(tabs)/wardrobe');
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
          <Text style={styles.title}>Digitalizar Nueva Prenda</Text>
          <Text style={styles.subtitle}>
            Replicate (851-labs/background-remover) quita el fondo en ~1 segundo y Claude
            Haiku 5.5 clasifica la tela, el grupo de lavado y cuántos usos aguanta.
          </Text>

          {/* BOTONES TÁCTILES DE CÁMARA Y GALERÍA */}
          <View style={styles.captureButtonsRow}>
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={() => handleCaptureOrPick(true)}
              disabled={isProcessing}
            >
              <Ionicons name="camera" size={20} color="#FFFFFF" />
              <Text style={styles.captureButtonText} numberOfLines={1}>
                Tomar Foto
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.galleryButton}
              onPress={() => handleCaptureOrPick(false)}
              disabled={isProcessing}
            >
              <Ionicons
                name="images"
                size={20}
                color={SOFT_TACTILE.colors.textPrimary}
              />
              <Text
                style={[
                  styles.captureButtonText,
                  { color: SOFT_TACTILE.colors.textPrimary },
                ]}
                numberOfLines={1}
              >
                Subir de Galería
              </Text>
            </TouchableOpacity>
          </View>

          {/* PRUEBA RÁPIDA EN SIMULADOR */}
          <View style={styles.demoStrip}>
            <Text style={styles.demoStripLabel}>
              Prueba rápida en simulador (Soft Tactile):
            </Text>
            <View style={styles.demoBtnsRow}>
              {DEMO_SAMPLES.map((s) => (
                <TouchableOpacity
                  key={s.label}
                  style={styles.demoBtn}
                  onPress={() => handleLoadSample(s)}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={13}
                    color={SOFT_TACTILE.colors.terracotta}
                  />
                  <Text style={styles.demoBtnText} numberOfLines={1}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {isProcessing ? (
            <View style={styles.processingCard}>
              <ActivityIndicator
                size="large"
                color={SOFT_TACTILE.colors.terracotta}
              />
              <Text style={styles.processingText}>{pipelineStage}</Text>
            </View>
          ) : null}

          {cutoutImageUri && !isProcessing ? (
            <View style={styles.formCard}>
              <View style={styles.previewSection}>
                <View style={styles.checkerboardBox}>
                  <Image
                    source={{ uri: cutoutImageUri }}
                    style={styles.cutoutPreview}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.engineBadgesRow}>
                  <View style={styles.engineBadge}>
                    <Ionicons
                      name="cut-outline"
                      size={12}
                      color={SOFT_TACTILE.colors.sage}
                    />
                    <Text style={styles.engineBadgeText} numberOfLines={1}>
                      {bgEngineUsed}
                    </Text>
                  </View>
                  <View style={styles.engineBadge}>
                    <Ionicons
                      name="sparkles-outline"
                      size={12}
                      color={SOFT_TACTILE.colors.terracotta}
                    />
                    <Text style={styles.engineBadgeText} numberOfLines={1}>
                      {aiEngineUsed}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Nombre de la prenda</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej. Camisa Oxford Azul"
                placeholderTextColor={SOFT_TACTILE.colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Categoría</Text>
              <View style={styles.pillsWrap}>
                {(Object.keys(CATEGORY_LABELS) as GarmentCategory[]).map((cat) => {
                  const active = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.choicePill,
                        active && styles.choicePillActive,
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.choicePillText,
                          active && styles.choicePillTextActive,
                        ]}
                      >
                        {CATEGORY_LABELS[cat]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.twoColRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.fieldLabel} numberOfLines={1}>
                    Colores detectados
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={colorsText}
                    onChangeText={setColorsText}
                    placeholder="Azul, Blanco"
                    placeholderTextColor={SOFT_TACTILE.colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.fieldLabel} numberOfLines={1}>
                    Tela / Material
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={fabric}
                    onChangeText={setFabric}
                    placeholder="Algodón"
                    placeholderTextColor={SOFT_TACTILE.colors.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>
                Tanda de Lavandería (Sugerida por Claude)
              </Text>
              <View style={styles.pillsWrap}>
                {(Object.keys(WASH_GROUP_INFO) as WashCareGroup[]).map((grp) => {
                  const info = WASH_GROUP_INFO[grp];
                  const active = washGroup === grp;
                  return (
                    <TouchableOpacity
                      key={grp}
                      style={[
                        styles.choicePill,
                        active && styles.choicePillActive,
                      ]}
                      onPress={() => setWashGroup(grp)}
                    >
                      <Text
                        style={[
                          styles.choicePillText,
                          active && styles.choicePillTextActive,
                        ]}
                      >
                        {info.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>
                Máximo de puestas antes de necesitar lavado
              </Text>
              <TextInput
                style={styles.input}
                value={maxWears}
                onChangeText={setMaxWears}
                keyboardType="number-pad"
                placeholder="Ej. 3"
                placeholderTextColor={SOFT_TACTILE.colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Instrucción de cuidado textil</Text>
              <TextInput
                style={styles.input}
                value={careInstructions}
                onChangeText={setCareInstructions}
              />

              <TouchableOpacity
                style={styles.saveGarmentBtn}
                onPress={handleSaveToWardrobe}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.saveGarmentBtnText} numberOfLines={1}>
                  Guardar Prenda en Mi Cápsula
                </Text>
              </TouchableOpacity>
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
    backgroundColor: SOFT_TACTILE.colors.canvas,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
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
    marginBottom: 18,
  },
  captureButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
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
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    flexShrink: 1,
  },
  demoStrip: {
    backgroundColor: SOFT_TACTILE.colors.card,
    borderRadius: 20,
    padding: 13,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    marginBottom: 16,
  },
  demoStripLabel: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 8,
  },
  demoBtnsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SOFT_TACTILE.colors.terracottaSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: '100%',
  },
  demoBtnText: {
    color: SOFT_TACTILE.colors.terracotta,
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },
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
  previewSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  checkerboardBox: {
    width: 190,
    height: 190,
    borderRadius: 24,
    backgroundColor: SOFT_TACTILE.colors.recessed,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    marginBottom: 10,
  },
  cutoutPreview: {
    width: '100%',
    height: '100%',
  },
  engineBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  engineBadge: {
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
  engineBadgeText: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  fieldLabel: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: SOFT_TACTILE.colors.canvas,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 13.5,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  choicePill: {
    backgroundColor: SOFT_TACTILE.colors.canvas,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
  },
  choicePillActive: {
    backgroundColor: SOFT_TACTILE.colors.terracotta,
    borderColor: SOFT_TACTILE.colors.terracotta,
  },
  choicePillText: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  choicePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  saveGarmentBtn: {
    marginTop: 20,
    backgroundColor: SOFT_TACTILE.colors.sage,
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveGarmentBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
});
