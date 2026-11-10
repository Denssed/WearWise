import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWardrobe } from '../../src/context/WardrobeContext';
import { SOFT_TACTILE } from '../../src/theme/softTactile';
import {
  CATEGORY_LABELS,
  GarmentCategory,
  WASH_GROUP_INFO,
} from '../../src/types/wardrobe';

const CATEGORIES_FILTER: { key: 'all' | GarmentCategory; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'top', label: 'Superiores' },
  { key: 'bottom', label: 'Inferiores' },
  { key: 'outerwear', label: 'Abrigos' },
  { key: 'footwear', label: 'Calzado' },
];

export default function WardrobeScreen() {
  const {
    garments,
    logGarmentWear,
    washGarmentsByIds,
    updateGarmentMaxWears,
  } = useWardrobe();

  const [selectedCategory, setSelectedCategory] = useState<'all' | GarmentCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'clean' | 'needs_wash'>('all');

  const filteredGarments = useMemo(() => {
    return garments.filter((g) => {
      const catOk = selectedCategory === 'all' || g.category === selectedCategory;
      const isDirty = g.status === 'needs_wash' || g.current_wears >= g.max_wears_before_wash;
      const statusOk =
        statusFilter === 'all' ||
        (statusFilter === 'clean' && !isDirty) ||
        (statusFilter === 'needs_wash' && isDirty);
      return catOk && statusOk;
    });
  }, [garments, selectedCategory, statusFilter]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Mi Cápsula Digital</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {garments.length} prendas recortadas · Control táctil de frescura y lavadas
          </Text>
        </View>

        {/* PÍLDORAS TÁCTILES DE CATEGORÍA */}
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {CATEGORIES_FILTER.map((cat) => {
              const active = selectedCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setSelectedCategory(cat.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* SELECTOR TÁCTIL DE ESTADO DE LIMPIEZA */}
        <View style={styles.statusTabsRow}>
          {[
            { key: 'all' as const, label: 'Todas' },
            { key: 'clean' as const, label: 'Frescas' },
            { key: 'needs_wash' as const, label: 'En Cesto' },
          ].map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.statusTab, active && styles.statusTabActive]}
                onPress={() => setStatusFilter(tab.key)}
              >
                <Text
                  style={[
                    styles.statusTabText,
                    active && styles.statusTabTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* GRILLA DE PRENDAS SOFT TACTILE */}
        <ScrollView
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          {filteredGarments.map((item) => {
            const isDirty =
              item.status === 'needs_wash' ||
              item.current_wears >= item.max_wears_before_wash;
            const wearRatio = Math.min(
              1,
              item.current_wears / Math.max(1, item.max_wears_before_wash)
            );
            const washGroup = WASH_GROUP_INFO[item.wash_care_group];

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.imageBackdrop}>
                  <Image
                    source={{ uri: item.cutout_image_url }}
                    style={styles.garmentImage}
                    resizeMode="cover"
                  />
                  <View
                    style={[
                      styles.statusBadge,
                      isDirty ? styles.statusBadgeDirty : styles.statusBadgeClean,
                    ]}
                  >
                    <Ionicons
                      name={isDirty ? 'water' : 'checkmark-circle'}
                      size={11}
                      color="#FFFFFF"
                    />
                    <Text style={styles.statusBadgeText} numberOfLines={1}>
                      {isDirty ? 'Por lavar' : 'Fresca'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.categoryLabel} numberOfLines={1}>
                  {CATEGORY_LABELS[item.category]} · {item.fabric}
                </Text>
                <Text style={styles.garmentName} numberOfLines={2}>
                  {item.name}
                </Text>

                <View style={styles.tagsRow}>
                  <View style={styles.washGroupPill}>
                    <Text style={styles.washGroupText} numberOfLines={1}>
                      {washGroup.label}
                    </Text>
                  </View>
                </View>

                {/* MEDIDOR TÁCTIL DE USOS ANTES DE LAVAR */}
                <View style={styles.wearTrackerBox}>
                  <View style={styles.wearHeaderRow}>
                    <Text style={styles.wearCounterLabel} numberOfLines={1}>
                      Usos:
                    </Text>
                    <Text
                      style={[
                        styles.wearCounterNumbers,
                        isDirty && { color: SOFT_TACTILE.colors.clayRed },
                      ]}
                      numberOfLines={1}
                    >
                      {item.current_wears} / {item.max_wears_before_wash}
                    </Text>
                  </View>

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.round(wearRatio * 100)}%`,
                          backgroundColor: isDirty
                            ? SOFT_TACTILE.colors.clayRed
                            : wearRatio >= 0.65
                            ? SOFT_TACTILE.colors.ochre
                            : SOFT_TACTILE.colors.sage,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.thresholdAdjustRow}>
                    <Text style={styles.thresholdLabel} numberOfLines={1}>
                      Límite:
                    </Text>
                    <View style={styles.stepperBtns}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() =>
                          updateGarmentMaxWears(
                            item.id,
                            item.max_wears_before_wash - 1
                          )
                        }
                      >
                        <Text style={styles.stepBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepValueText}>
                        {item.max_wears_before_wash}
                      </Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() =>
                          updateGarmentMaxWears(
                            item.id,
                            item.max_wears_before_wash + 1
                          )
                        }
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  {!isDirty ? (
                    <TouchableOpacity
                      style={styles.useOnceBtn}
                      onPress={() => logGarmentWear(item.id, false)}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={14}
                        color={SOFT_TACTILE.colors.terracotta}
                      />
                      <Text style={styles.useOnceBtnText} numberOfLines={1}>
                        +1 Uso
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.washNowBtn,
                      isDirty && styles.washNowBtnHighlighted,
                    ]}
                    onPress={() =>
                      isDirty
                        ? washGarmentsByIds([item.id])
                        : logGarmentWear(item.id, true)
                    }
                  >
                    <Ionicons
                      name={isDirty ? 'sparkles-outline' : 'water-outline'}
                      size={13}
                      color={isDirty ? '#FFFFFF' : SOFT_TACTILE.colors.textPrimary}
                    />
                    <Text
                      style={[
                        styles.washNowBtnText,
                        isDirty && { color: '#FFFFFF' },
                      ]}
                      numberOfLines={1}
                    >
                      {isDirty ? 'Marcar Lavada' : 'Lavar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
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
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 12.5,
    marginTop: 2,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 10,
  },
  filterChip: {
    backgroundColor: SOFT_TACTILE.colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
  },
  filterChipActive: {
    backgroundColor: SOFT_TACTILE.colors.terracotta,
    borderColor: SOFT_TACTILE.colors.terracotta,
  },
  filterChipText: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  statusTabsRow: {
    flexDirection: 'row',
    backgroundColor: SOFT_TACTILE.colors.recessed,
    borderRadius: 16,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
  },
  statusTab: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderRadius: 12,
  },
  statusTabActive: {
    backgroundColor: SOFT_TACTILE.colors.card,
  },
  statusTabText: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  statusTabTextActive: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontWeight: '800',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 32,
    rowGap: 12,
  },
  card: {
    width: '48.2%',
    backgroundColor: SOFT_TACTILE.colors.card,
    borderRadius: 22,
    padding: 10,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    ...SOFT_TACTILE.shadow,
  },
  imageBackdrop: {
    width: '100%',
    height: 132,
    borderRadius: 16,
    backgroundColor: SOFT_TACTILE.colors.recessed,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  garmentImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeClean: {
    backgroundColor: SOFT_TACTILE.colors.sage,
  },
  statusBadgeDirty: {
    backgroundColor: SOFT_TACTILE.colors.clayRed,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
  categoryLabel: {
    color: SOFT_TACTILE.colors.terracotta,
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  garmentName: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginVertical: 3,
    minHeight: 34,
    lineHeight: 16.5,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  washGroupPill: {
    maxWidth: '100%',
    backgroundColor: SOFT_TACTILE.colors.recessed,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  washGroupText: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  wearTrackerBox: {
    backgroundColor: SOFT_TACTILE.colors.canvas,
    borderRadius: 14,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
  },
  wearHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
    marginBottom: 5,
  },
  wearCounterLabel: {
    flex: 1,
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 10,
  },
  wearCounterNumbers: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 0,
  },
  progressTrack: {
    height: 6,
    backgroundColor: SOFT_TACTILE.colors.pillBg,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 7,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  thresholdAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  thresholdLabel: {
    flex: 1,
    color: SOFT_TACTILE.colors.textMuted,
    fontSize: 10,
  },
  stepperBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  stepBtn: {
    width: 21,
    height: 21,
    borderRadius: 7,
    backgroundColor: SOFT_TACTILE.colors.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  stepValueText: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    minWidth: 14,
    textAlign: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  useOnceBtn: {
    flex: 1,
    minWidth: 0,
    backgroundColor: SOFT_TACTILE.colors.terracottaSoft,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  useOnceBtnText: {
    color: SOFT_TACTILE.colors.terracotta,
    fontSize: 10.5,
    fontWeight: '800',
    flexShrink: 1,
  },
  washNowBtn: {
    flex: 1,
    minWidth: 0,
    backgroundColor: SOFT_TACTILE.colors.recessed,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  washNowBtnHighlighted: {
    backgroundColor: SOFT_TACTILE.colors.sage,
  },
  washNowBtnText: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 10.5,
    fontWeight: '800',
    flexShrink: 1,
  },
});
