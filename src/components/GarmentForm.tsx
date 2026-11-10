import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SOFT_TACTILE } from '../theme/softTactile';
import {
  CATEGORY_LABELS,
  GarmentCategory,
  Season,
  WASH_GROUP_INFO,
  WashCareGroup,
} from '../types/wardrobe';
import {
  ALL_SEASONS,
  defaultsForCategory,
  FORMALITY_LABELS,
  GarmentFormErrors,
  GarmentFormValues,
} from '../utils/garmentForm';

interface Props {
  values: GarmentFormValues;
  onChange: (next: GarmentFormValues) => void;
  errors?: GarmentFormErrors;
  /**
   * Al cambiar de categoría en una prenda NUEVA se sugieren subcategoría, lavado y puestas típicos.
   * En edición se respetan los valores que el usuario ya eligió.
   */
  applyCategoryDefaults?: boolean;
}

const SEASON_LABELS: Record<Season, string> = {
  primavera: 'Primavera',
  verano: 'Verano',
  otoño: 'Otoño',
  invierno: 'Invierno',
};

export function GarmentForm({ values, onChange, errors = {}, applyCategoryDefaults = false }: Props) {
  const set = <K extends keyof GarmentFormValues>(key: K, value: GarmentFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const pickCategory = (category: GarmentCategory) => {
    if (!applyCategoryDefaults) return set('category', category);
    const d = defaultsForCategory(category);
    onChange({
      ...values,
      category,
      subcategory: d.subcategory,
      washGroup: d.washGroup,
      maxWears: String(d.maxWears),
      careInstructions: d.careInstructions,
    });
  };

  const toggleSeason = (season: Season) => {
    const has = values.seasons.includes(season);
    set('seasons', has ? values.seasons.filter((s) => s !== season) : [...values.seasons, season]);
  };

  return (
    <View>
      <Text style={styles.fieldLabel}>Nombre de la prenda</Text>
      <TextInput
        style={[styles.input, errors.name && styles.inputError]}
        value={values.name}
        onChangeText={(t) => set('name', t)}
        placeholder="Ej. Camisa Oxford Azul"
        placeholderTextColor={SOFT_TACTILE.colors.textMuted}
      />
      {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

      <Text style={styles.fieldLabel}>Categoría</Text>
      <View style={styles.pillsWrap}>
        {(Object.keys(CATEGORY_LABELS) as GarmentCategory[]).map((cat) => (
          <Pill
            key={cat}
            label={CATEGORY_LABELS[cat].trim()}
            active={values.category === cat}
            onPress={() => pickCategory(cat)}
          />
        ))}
      </View>

      <View style={styles.twoColRow}>
        <View style={styles.col}>
          <Text style={styles.fieldLabel} numberOfLines={1}>
            Tipo de prenda
          </Text>
          <TextInput
            style={styles.input}
            value={values.subcategory}
            onChangeText={(t) => set('subcategory', t)}
            placeholder="Camisa, Jeans..."
            placeholderTextColor={SOFT_TACTILE.colors.textMuted}
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.fieldLabel} numberOfLines={1}>
            Tela / Material
          </Text>
          <TextInput
            style={styles.input}
            value={values.fabric}
            onChangeText={(t) => set('fabric', t)}
            placeholder="Algodón"
            placeholderTextColor={SOFT_TACTILE.colors.textMuted}
          />
        </View>
      </View>

      <Text style={styles.fieldLabel}>Colores (separados por coma)</Text>
      <TextInput
        style={styles.input}
        value={values.colorsText}
        onChangeText={(t) => set('colorsText', t)}
        placeholder="Azul, Blanco"
        placeholderTextColor={SOFT_TACTILE.colors.textMuted}
      />

      <Text style={styles.fieldLabel}>Temporadas en las que la usas</Text>
      <View style={styles.pillsWrap}>
        {ALL_SEASONS.map((s) => (
          <Pill
            key={s}
            label={SEASON_LABELS[s]}
            active={values.seasons.includes(s)}
            onPress={() => toggleSeason(s)}
          />
        ))}
      </View>
      {errors.seasons ? <Text style={styles.errorText}>{errors.seasons}</Text> : null}

      <Text style={styles.fieldLabel}>Formalidad</Text>
      <View style={styles.pillsWrap}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pill
            key={n}
            label={`${n} · ${FORMALITY_LABELS[n]}`}
            active={values.formality === n}
            onPress={() => set('formality', n)}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Tanda de lavandería</Text>
      <View style={styles.pillsWrap}>
        {(Object.keys(WASH_GROUP_INFO) as WashCareGroup[]).map((grp) => (
          <Pill
            key={grp}
            label={WASH_GROUP_INFO[grp].label}
            active={values.washGroup === grp}
            onPress={() => set('washGroup', grp)}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Puestas antes de necesitar lavado</Text>
      <TextInput
        style={[styles.input, errors.maxWears && styles.inputError]}
        value={values.maxWears}
        onChangeText={(t) => set('maxWears', t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder="Ej. 3"
        placeholderTextColor={SOFT_TACTILE.colors.textMuted}
      />
      {errors.maxWears ? <Text style={styles.errorText}>{errors.maxWears}</Text> : null}

      <Text style={styles.fieldLabel}>Instrucción de cuidado</Text>
      <TextInput
        style={styles.input}
        value={values.careInstructions}
        onChangeText={(t) => set('careInstructions', t)}
        placeholder="Lavar en frío..."
        placeholderTextColor={SOFT_TACTILE.colors.textMuted}
      />
    </View>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.choicePill, active && styles.choicePillActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.choicePillText, active && styles.choicePillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 12,
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
  inputError: { borderColor: SOFT_TACTILE.colors.clayRed },
  errorText: { color: SOFT_TACTILE.colors.clayRed, fontSize: 12, fontWeight: '700', marginTop: 5 },
  twoColRow: { flexDirection: 'row', gap: 10 },
  col: { flex: 1, minWidth: 0 },
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
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
  choicePillText: { color: SOFT_TACTILE.colors.textSecondary, fontSize: 12, fontWeight: '700' },
  choicePillTextActive: { color: '#FFFFFF', fontWeight: '800' },
});
