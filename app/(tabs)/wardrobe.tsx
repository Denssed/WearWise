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
          <Text style={styles.title}>Mi Colección Digital</Text>
          <Text style={styles.subtitle}>
            {garments.length} prendas recortadas · Control de usos y lavado
          </Text>
        </View>

        {/* FILTROS DE CATEGORÍA */}
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
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* SUB-FILTRO DE ESTADO DE LIMPIEZA */}
        <View style={styles.statusTabsRow}>
          {[
            { key: 'all' as const, label: 'Todas' },
            { key: 'clean' as const, label: 'Limpias para vestir' },
            { key: 'needs_wash' as const, label: 'En cesto para lavar' },
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
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* GRILLA DE PRENDAS */}
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
                {/* IMAGEN SIN FONDO SOBRE ESTUDIO TRANSPARENTE */}
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
                      name={isDirty ? 'water' : 'Sparkles' in Ionicons.glyphMap ? 'checkmark-circle' : 'checkmark-circle'}
                      size={11}
                      color="#FFFFFF"
                    />
                    <Text style={styles.statusBadgeText}>
                      {isDirty ? 'Por lavar' : 'Limpia'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.categoryLabel}>
                  {CATEGORY_LABELS[item.category]} · {item.fabric}
                </Text>
                <Text style={styles.garmentName} numberOfLines={1}>
                  {item.name}
                </Text>

                {/* COLORES Y TANDA DE LAVADO */}
                <View style={styles.tagsRow}>
                  <View
                    style={[
                      styles.washGroupPill,
                      { borderColor: washGroup.color },
                    ]}
                  >
                    <Text style={[styles.washGroupText, { color: washGroup.color }]}>
                      {washGroup.label}
                    </Text>
                  </View>
                </View>

                {/* BARRA DE USOS ANTES DE LAVAR */}
                <View style={styles.wearTrackerBox}>
                  <View style={styles.wearHeaderRow}>
                    <Text style={styles.wearCounterLabel}>
                      Usos desde último lavado:
                    </Text>
                    <Text
                      style={[
                        styles.wearCounterNumbers,
                        isDirty && { color: '#F87171' },
                      ]}
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
                            ? '#EF4444'
                            : wearRatio >= 0.65
                            ? '#F59E0B'
                            : '#10B981',
                        },
                      ]}
                    />
                  </View>

                  {/* AJUSTE DE UMBRAL DE LAVADO */}
                  <View style={styles.thresholdAdjustRow}>
                    <Text style={styles.thresholdLabel}>Límite de puestas:</Text>
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
                        <Text style={styles.stepBtnText}>-</Text>
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

                {/* BOTONES RÁPIDOS: +1 USO O LAVAR */}
                <View style={styles.cardActions}>
                  {!isDirty ? (
                    <TouchableOpacity
                      style={styles.useOnceBtn}
                      onPress={() => logGarmentWear(item.id, false)}
                    >
                      <Ionicons name="add-circle-outline" size={15} color="#E0E7FF" />
                      <Text style={styles.useOnceBtnText}>+1 Uso</Text>
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
                      size={14}
                      color="#FFFFFF"
                    />
                    <Text style={styles.washNowBtnText}>
                      {isDirty ? 'Marcar Lavada' : 'A lavar'}
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
    backgroundColor: '#0B0F19',
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
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 10,
  },
  filterChip: {
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  filterChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#818CF8',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  statusTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  statusTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  statusTabActive: {
    backgroundColor: '#1E293B',
  },
  statusTabText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  statusTabTextActive: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    width: '48%',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  imageBackdrop: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: '#1E293B',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeClean: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
  },
  statusBadgeDirty: {
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  categoryLabel: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  garmentName: {
    color: '#F8FAFC',
    fontSize: 13.5,
    fontWeight: '700',
    marginVertical: 3,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  washGroupPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  washGroupText: {
    fontSize: 10,
    fontWeight: '700',
  },
  wearTrackerBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  wearHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  wearCounterLabel: {
    color: '#94A3B8',
    fontSize: 10,
  },
  wearCounterNumbers: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '800',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#1E293B',
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
  },
  thresholdLabel: {
    color: '#64748B',
    fontSize: 10,
  },
  stepperBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '800',
  },
  stepValueText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  useOnceBtn: {
    flex: 1,
    backgroundColor: '#312E81',
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  useOnceBtnText: {
    color: '#E0E7FF',
    fontSize: 11,
    fontWeight: '700',
  },
  washNowBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  washNowBtnHighlighted: {
    backgroundColor: '#059669',
  },
  washNowBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
