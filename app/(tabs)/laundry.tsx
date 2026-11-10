import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
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
import { WASH_GROUP_INFO, WashCareGroup } from '../../src/types/wardrobe';

const WASH_GROUPS_ORDER: WashCareGroup[] = ['whites', 'darks', 'colors', 'delicates'];

export default function LaundryScreen() {
  const { garments, washBatchByGroup, washGarmentsByIds } = useWardrobe();

  const dirtyGarments = useMemo(
    () =>
      garments.filter(
        (g) => g.status === 'needs_wash' || g.current_wears >= g.max_wears_before_wash
      ),
    [garments]
  );

  const almostDirtyGarments = useMemo(
    () =>
      garments.filter(
        (g) =>
          g.status === 'clean' &&
          g.current_wears > 0 &&
          g.max_wears_before_wash - g.current_wears === 1
      ),
    [garments]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Cesto de Lavandería Inteligente</Text>
        <Text style={styles.subtitle}>
          Control automático de qué ropa debes lavar hoy agrupada por tipo de cuidado
          textil para no dañar tus prendas.
        </Text>

        {/* RESUMEN DE ESTADO */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, { color: '#F87171' }]}>
              {dirtyGarments.length}
            </Text>
            <Text style={styles.summaryLabel}>Urgentes por lavar</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, { color: '#FBBF24' }]}>
              {almostDirtyGarments.length}
            </Text>
            <Text style={styles.summaryLabel}>Con 1 puesta restante</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, { color: '#34D399' }]}>
              {garments.length - dirtyGarments.length}
            </Text>
            <Text style={styles.summaryLabel}>Disponibles limpias</Text>
          </View>
        </View>

        {/* TANDAS POR GRUPO DE LAVADO */}
        {WASH_GROUPS_ORDER.map((groupKey) => {
          const info = WASH_GROUP_INFO[groupKey];
          const urgentInGroup = dirtyGarments.filter(
            (g) => g.wash_care_group === groupKey
          );
          const optionalInGroup = almostDirtyGarments.filter(
            (g) => g.wash_care_group === groupKey
          );

          return (
            <View key={groupKey} style={styles.batchCard}>
              <View style={styles.batchHeader}>
                <View style={styles.batchTitleRow}>
                  <View
                    style={[
                      styles.batchColorDot,
                      { backgroundColor: info.color },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.batchTitle}>{info.label}</Text>
                    <Text style={styles.batchTemp}>{info.tempRecommendation}</Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {urgentInGroup.length} listas
                    </Text>
                  </View>
                </View>
              </View>

              {urgentInGroup.length === 0 && optionalInGroup.length === 0 ? (
                <Text style={styles.emptyBatchText}>
                  Todas las prendas de esta tanda están limpias y al 100%.
                </Text>
              ) : (
                <>
                  {/* PRENDAS QUE YA ALCANZARON EL LÍMITE DE USOS */}
                  {urgentInGroup.map((item) => (
                    <View key={item.id} style={styles.laundryItemRow}>
                      <Image
                        source={{ uri: item.cutout_image_url }}
                        style={styles.itemThumb}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemReason}>
                          Alcanzó {item.current_wears}/{item.max_wears_before_wash}{' '}
                          puestas · {item.care_instructions}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.singleWashBtn}
                        onPress={() => washGarmentsByIds([item.id])}
                      >
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        <Text style={styles.singleWashBtnText}>Lavada</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* PRENDAS OPCIONALES (LES QUEDA 1 USO) PARA COMPLETAR CARGA */}
                  {optionalInGroup.length > 0 ? (
                    <View style={styles.optionalSection}>
                      <Text style={styles.optionalTitle}>
                        Opcionales para aprovechar la carga (les queda 1 puesta):
                      </Text>
                      {optionalInGroup.map((item) => (
                        <View key={item.id} style={styles.laundryItemRow}>
                          <Image
                            source={{ uri: item.cutout_image_url }}
                            style={styles.itemThumb}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemOptionalMeta}>
                              Usos: {item.current_wears}/{item.max_wears_before_wash}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.optionalWashBtn}
                            onPress={() => washGarmentsByIds([item.id])}
                          >
                            <Text style={styles.optionalWashBtnText}>
                              Reiniciar a 0
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.washBatchBtn,
                      { backgroundColor: info.color },
                    ]}
                    onPress={() => washBatchByGroup(groupKey)}
                  >
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                    <Text style={styles.washBatchBtnText}>
                      Marcar tanda de {info.label} como lavada
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
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
    paddingBottom: 36,
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
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  summaryNumber: {
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 3,
    textAlign: 'center',
  },
  batchCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  batchHeader: {
    marginBottom: 10,
  },
  batchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  batchColorDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  batchTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  batchTemp: {
    color: '#94A3B8',
    fontSize: 11.5,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countBadgeText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyBatchText: {
    color: '#64748B',
    fontSize: 12.5,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  laundryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  itemThumb: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  itemName: {
    color: '#F1F5F9',
    fontSize: 13.5,
    fontWeight: '700',
  },
  itemReason: {
    color: '#FCA5A5',
    fontSize: 11,
    marginTop: 2,
  },
  singleWashBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  singleWashBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  optionalSection: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  optionalTitle: {
    color: '#FBBF24',
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 8,
  },
  itemOptionalMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  optionalWashBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  optionalWashBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  washBatchBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  washBatchBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
