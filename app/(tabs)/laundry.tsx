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
import { SOFT_TACTILE } from '../../src/theme/softTactile';
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
        <Text style={styles.title}>Cesto de Lavandería Orgánico</Text>
        <Text style={styles.subtitle}>
          Tandas clasificadas automáticamente por cuidado textil para prolongar la vida de
          tus prendas y ahorrar lavadas.
        </Text>

        {/* RESUMEN DE ESTADO */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, { color: SOFT_TACTILE.colors.clayRed }]}>
              {dirtyGarments.length}
            </Text>
            <Text style={styles.summaryLabel} numberOfLines={2}>
              Para lavar hoy
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, { color: SOFT_TACTILE.colors.ochre }]}>
              {almostDirtyGarments.length}
            </Text>
            <Text style={styles.summaryLabel} numberOfLines={2}>
              Con 1 puesta libre
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, { color: SOFT_TACTILE.colors.sage }]}>
              {garments.length - dirtyGarments.length}
            </Text>
            <Text style={styles.summaryLabel} numberOfLines={2}>
              Frescas en armario
            </Text>
          </View>
        </View>

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
                      { backgroundColor: SOFT_TACTILE.colors.terracotta },
                    ]}
                  />
                  <View style={styles.batchTitleWrap}>
                    <Text style={styles.batchTitle} numberOfLines={1}>
                      {info.label}
                    </Text>
                    <Text style={styles.batchTemp} numberOfLines={2}>
                      {info.tempRecommendation}
                    </Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText} numberOfLines={1}>
                      {urgentInGroup.length} listas
                    </Text>
                  </View>
                </View>
              </View>

              {urgentInGroup.length === 0 && optionalInGroup.length === 0 ? (
                <Text style={styles.emptyBatchText}>
                  Todas las prendas de esta tanda están limpias y frescas.
                </Text>
              ) : (
                <>
                  {urgentInGroup.map((item) => (
                    <View key={item.id} style={styles.laundryItemRow}>
                      <Image
                        source={{ uri: item.cutout_image_url }}
                        style={styles.itemThumb}
                      />
                      <View style={styles.itemInfoWrap}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.itemReason} numberOfLines={2}>
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
                          <View style={styles.itemInfoWrap}>
                            <Text style={styles.itemName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={styles.itemOptionalMeta} numberOfLines={1}>
                              Usos: {item.current_wears}/{item.max_wears_before_wash}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.optionalWashBtn}
                            onPress={() => washGarmentsByIds([item.id])}
                          >
                            <Text style={styles.optionalWashBtnText} numberOfLines={1}>
                              Incluir y lavar
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.washBatchBtn}
                    onPress={() => washBatchByGroup(groupKey)}
                  >
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                    <Text style={styles.washBatchBtnText} numberOfLines={2}>
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
    backgroundColor: SOFT_TACTILE.colors.canvas,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 36,
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
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: SOFT_TACTILE.colors.card,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    ...SOFT_TACTILE.shadow,
  },
  summaryNumber: {
    fontSize: 21,
    fontWeight: '800',
  },
  summaryLabel: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 3,
    textAlign: 'center',
    fontWeight: '600',
  },
  batchCard: {
    backgroundColor: SOFT_TACTILE.colors.card,
    borderRadius: 26,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    ...SOFT_TACTILE.shadow,
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
    flexShrink: 0,
  },
  batchTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  batchTitle: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 15.5,
    fontWeight: '800',
  },
  batchTemp: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: SOFT_TACTILE.colors.recessed,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 0,
  },
  countBadgeText: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  emptyBatchText: {
    color: SOFT_TACTILE.colors.textMuted,
    fontSize: 12.5,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  laundryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SOFT_TACTILE.colors.canvas,
    padding: 10,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
  },
  itemThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: SOFT_TACTILE.colors.recessed,
    flexShrink: 0,
  },
  itemInfoWrap: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  itemName: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 13.5,
    fontWeight: '800',
  },
  itemReason: {
    color: SOFT_TACTILE.colors.clayRed,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    fontWeight: '600',
  },
  singleWashBtn: {
    backgroundColor: SOFT_TACTILE.colors.sage,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  singleWashBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  optionalSection: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SOFT_TACTILE.colors.border,
  },
  optionalTitle: {
    color: SOFT_TACTILE.colors.ochre,
    fontSize: 11.5,
    fontWeight: '800',
    marginBottom: 8,
  },
  itemOptionalMeta: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  optionalWashBtn: {
    backgroundColor: SOFT_TACTILE.colors.recessed,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    flexShrink: 0,
  },
  optionalWashBtnText: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  washBatchBtn: {
    marginTop: 8,
    backgroundColor: SOFT_TACTILE.colors.terracotta,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  washBatchBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },
});
