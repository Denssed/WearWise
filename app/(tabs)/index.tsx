import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { CATEGORY_LABELS, Garment } from '../../src/types/wardrobe';

export default function WeeklyPlannerScreen() {
  const router = useRouter();
  const {
    garments,
    profile,
    weather,
    weeklyPlan,
    isGeneratingPlan,
    isLoadingWeather,
    regenerateWeeklyPlan,
    refreshLocationAndWeather,
    logDayOutfitWear,
  } = useWardrobe();

  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);

  const cleanCount = useMemo(
    () =>
      garments.filter(
        (g) => g.status === 'clean' && g.current_wears < g.max_wears_before_wash
      ).length,
    [garments]
  );

  const dirtyCount = useMemo(
    () =>
      garments.filter(
        (g) => g.status === 'needs_wash' || g.current_wears >= g.max_wears_before_wash
      ).length,
    [garments]
  );

  const activeDayPlan = weeklyPlan?.days?.[selectedDayIdx] || weeklyPlan?.days?.[0];
  const activeWeather = weather[selectedDayIdx] || weather[0];

  const outfitGarments = useMemo(() => {
    if (!activeDayPlan) return [];
    const map = new Map<string, Garment>(garments.map((g) => [g.id, g]));
    return activeDayPlan.garmentIds
      .map((id) => map.get(id))
      .filter((g): g is Garment => Boolean(g));
  }, [activeDayPlan, garments]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER SOFT TACTILE */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.brandRow}>
              <Text style={styles.appTitle}>WearWise</Text>
              <View
                style={[
                  styles.modeBadge,
                  profile.profileMode === 'custom'
                    ? styles.modeBadgeCustom
                    : styles.modeBadgeDefault,
                ]}
              >
                <Ionicons
                  name={profile.profileMode === 'custom' ? 'options-outline' : 'leaf-outline'}
                  size={12}
                  color={
                    profile.profileMode === 'custom'
                      ? SOFT_TACTILE.colors.sage
                      : SOFT_TACTILE.colors.terracotta
                  }
                />
                <Text
                  style={[
                    styles.modeBadgeText,
                    {
                      color:
                        profile.profileMode === 'custom'
                          ? SOFT_TACTILE.colors.sage
                          : SOFT_TACTILE.colors.terracotta,
                    },
                  ]}
                >
                  {profile.profileMode === 'custom'
                    ? 'Cápsula Personalizada'
                    : 'Cápsula Default'}
                </Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              Hola, {profile.displayName} · Curaduría por Claude Haiku 5.5
            </Text>
          </View>

          <TouchableOpacity
            style={styles.weatherChip}
            onPress={refreshLocationAndWeather}
            disabled={isLoadingWeather}
          >
            <Ionicons
              name="location-outline"
              size={14}
              color={SOFT_TACTILE.colors.waterBlue}
            />
            <Text style={styles.weatherChipText} numberOfLines={1}>
              {isLoadingWeather ? 'Clima...' : profile.cityName}
            </Text>
          </TouchableOpacity>
        </View>

        {/* PÍLDORAS TÁCTILES DE ESTADO DEL ARMARIO */}
        <View style={styles.metricsRow}>
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => router.push('/(tabs)/wardrobe')}
          >
            <View
              style={[
                styles.metricIconWrap,
                { backgroundColor: SOFT_TACTILE.colors.sageSoft },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={SOFT_TACTILE.colors.sage}
              />
            </View>
            <View>
              <Text style={styles.metricValue}>{cleanCount}</Text>
              <Text style={styles.metricLabel}>Prendas frescas</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => router.push('/(tabs)/laundry')}
          >
            <View
              style={[
                styles.metricIconWrap,
                {
                  backgroundColor:
                    dirtyCount > 0
                      ? SOFT_TACTILE.colors.clayRedSoft
                      : SOFT_TACTILE.colors.waterBlueSoft,
                },
              ]}
            >
              <Ionicons
                name="water"
                size={20}
                color={
                  dirtyCount > 0
                    ? SOFT_TACTILE.colors.clayRed
                    : SOFT_TACTILE.colors.waterBlue
                }
              />
            </View>
            <View>
              <Text
                style={[
                  styles.metricValue,
                  dirtyCount > 0 && { color: SOFT_TACTILE.colors.clayRed },
                ]}
              >
                {dirtyCount}
              </Text>
              <Text style={styles.metricLabel}>En cesto</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.generateButton, isGeneratingPlan && { opacity: 0.7 }]}
            onPress={regenerateWeeklyPlan}
            disabled={isGeneratingPlan}
          >
            {isGeneratingPlan ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                <Text style={styles.generateButtonText}>Armar Semana</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* RESUMEN EDITORIAL DE CLAUDE */}
        {weeklyPlan?.claudeSummary ? (
          <View style={styles.aiSummaryBox}>
            <View style={styles.aiSummaryHeader}>
              <Ionicons
                name="sparkles"
                size={14}
                color={SOFT_TACTILE.colors.terracotta}
              />
              <Text style={styles.aiSummaryTitle}>
                Nota del Estilista ({weeklyPlan.generatedBy === 'claude_haiku' ? 'Claude Haiku 5.5' : 'Curaduría Local'})
              </Text>
            </View>
            <Text style={styles.aiSummaryText}>{weeklyPlan.claudeSummary}</Text>
          </View>
        ) : null}

        {/* SELECTOR DE DÍAS TÁCTIL + CLIMA */}
        <Text style={styles.sectionTitle}>Tu Semana de Outfits</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysScroll}
        >
          {(weeklyPlan?.days || []).map((day, idx) => {
            const w = weather[idx];
            const isSelected = idx === selectedDayIdx;
            return (
              <TouchableOpacity
                key={day.dayName + idx}
                style={[styles.dayPill, isSelected && styles.dayPillActive]}
                onPress={() => setSelectedDayIdx(idx)}
              >
                <View style={styles.dayPillHeader}>
                  <Text
                    style={[
                      styles.dayPillName,
                      isSelected && styles.dayPillNameActive,
                    ]}
                  >
                    {day.dayName.slice(0, 3)}
                  </Text>
                  {day.wornConfirmed ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={isSelected ? '#FFFFFF' : SOFT_TACTILE.colors.sage}
                    />
                  ) : null}
                </View>

                <Ionicons
                  name={w?.icon || 'partly-sunny'}
                  size={20}
                  color={isSelected ? '#FFFFFF' : SOFT_TACTILE.colors.textSecondary}
                  style={{ marginVertical: 6 }}
                />

                <Text
                  style={[
                    styles.dayTempText,
                    isSelected && { color: '#FFFDF9' },
                  ]}
                >
                  {w ? `${w.tempMin}° / ${w.tempMax}°` : '15° / 24°'}
                </Text>
                {w && w.rainProbability >= 35 ? (
                  <Text
                    style={[
                      styles.rainBadge,
                      isSelected && { color: '#FDE68A' },
                    ]}
                  >
                    {w.rainProbability}% lluvia
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* TARJETA FLAT-LAY DEL OUTFIT DEL DÍA */}
        {activeDayPlan ? (
          <View style={styles.outfitCard}>
            <View style={styles.outfitHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.occasionRow}>
                  <Text style={styles.dayFullLabel}>{activeDayPlan.dayName}</Text>
                  <View style={styles.occasionTag}>
                    <Text style={styles.occasionTagText}>{activeDayPlan.occasion}</Text>
                  </View>
                </View>
                <Text style={styles.outfitTitle}>{activeDayPlan.outfitTitle}</Text>
              </View>

              {activeWeather ? (
                <View style={styles.weatherDetailBox}>
                  <Ionicons
                    name={activeWeather.icon}
                    size={22}
                    color={SOFT_TACTILE.colors.ochre}
                  />
                  <Text style={styles.weatherDetailTemp}>
                    {activeWeather.tempMax}°C
                  </Text>
                </View>
              ) : null}
            </View>

            {/* COLLAGE FLAT-LAY DE PRENDAS RECORTADAS */}
            <View style={styles.garmentGrid}>
              {outfitGarments.map((item) => {
                const remaining = Math.max(
                  0,
                  item.max_wears_before_wash - item.current_wears
                );
                const isDirty = item.status === 'needs_wash' || remaining === 0;

                return (
                  <View key={item.id} style={styles.outfitGarmentCard}>
                    <View style={styles.cutoutImageBox}>
                      <Image
                        source={{ uri: item.cutout_image_url }}
                        style={styles.cutoutImage}
                        resizeMode="cover"
                      />
                      <View
                        style={[
                          styles.wearPillOverlay,
                          isDirty ? styles.wearPillDirty : styles.wearPillClean,
                        ]}
                      >
                        <Text style={styles.wearPillText}>
                          {isDirty
                            ? 'Lavar ya'
                            : `${remaining} ${remaining === 1 ? 'puesta libre' : 'puestas libres'}`}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.garmentItemCategory}>
                      {CATEGORY_LABELS[item.category]}
                    </Text>
                    <Text style={styles.garmentItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.garmentWearCounter}>
                      Usos: {item.current_wears}/{item.max_wears_before_wash} antes de lavar
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* NOTAS DE ESTILO Y CLIMA */}
            <View style={styles.tipsContainer}>
              <View style={styles.tipRow}>
                <Ionicons
                  name="sparkles-outline"
                  size={16}
                  color={SOFT_TACTILE.colors.terracotta}
                />
                <Text style={styles.tipText}>{activeDayPlan.stylingTip}</Text>
              </View>
              <View style={styles.tipRow}>
                <Ionicons
                  name="thermometer-outline"
                  size={16}
                  color={SOFT_TACTILE.colors.waterBlue}
                />
                <Text style={styles.tipText}>{activeDayPlan.weatherNote}</Text>
              </View>
            </View>

            {/* BOTONES TÁCTILES DE USO Y LAVANDERÍA */}
            {activeDayPlan.wornConfirmed ? (
              <View style={styles.wornConfirmedBanner}>
                <Ionicons
                  name="checkmark-done-circle"
                  size={20}
                  color={SOFT_TACTILE.colors.sage}
                />
                <Text style={styles.wornConfirmedText}>
                  Look registrado hoy · Frescura del armario actualizada
                </Text>
              </View>
            ) : (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.wearTodayBtn}
                  onPress={() => logDayOutfitWear(activeDayPlan.dayIndex, false)}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.wearTodayBtnText}>¡Me puse este outfit!</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.forceWashBtn}
                  onPress={() => logDayOutfitWear(activeDayPlan.dayIndex, true)}
                >
                  <Ionicons
                    name="water-outline"
                    size={18}
                    color={SOFT_TACTILE.colors.clayRed}
                  />
                  <Text style={styles.forceWashBtnText}>A lavar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}
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
  contentContainer: {
    padding: 18,
    paddingBottom: 38,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: SOFT_TACTILE.colors.textPrimary,
    letterSpacing: -0.6,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  modeBadgeDefault: {
    backgroundColor: SOFT_TACTILE.colors.terracottaSoft,
  },
  modeBadgeCustom: {
    backgroundColor: SOFT_TACTILE.colors.sageSoft,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SOFT_TACTILE.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    maxWidth: 145,
  },
  weatherChipText: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SOFT_TACTILE.colors.card,
    padding: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    ...SOFT_TACTILE.shadow,
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 11,
  },
  generateButton: {
    backgroundColor: SOFT_TACTILE.colors.terracotta,
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...SOFT_TACTILE.shadow,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  aiSummaryBox: {
    backgroundColor: SOFT_TACTILE.colors.terracottaSoft,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8C5B8',
    marginBottom: 18,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  aiSummaryTitle: {
    color: SOFT_TACTILE.colors.terracotta,
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  aiSummaryText: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  daysScroll: {
    gap: 10,
    paddingBottom: 14,
  },
  dayPill: {
    width: 80,
    backgroundColor: SOFT_TACTILE.colors.card,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
  },
  dayPillActive: {
    backgroundColor: SOFT_TACTILE.colors.terracotta,
    borderColor: SOFT_TACTILE.colors.terracotta,
  },
  dayPillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayPillName: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  dayPillNameActive: {
    color: '#FFFFFF',
  },
  dayTempText: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  rainBadge: {
    marginTop: 3,
    fontSize: 9.5,
    color: SOFT_TACTILE.colors.waterBlue,
    fontWeight: '700',
  },
  outfitCard: {
    backgroundColor: SOFT_TACTILE.colors.card,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
    ...SOFT_TACTILE.shadow,
  },
  outfitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  occasionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  dayFullLabel: {
    color: SOFT_TACTILE.colors.terracotta,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  occasionTag: {
    backgroundColor: SOFT_TACTILE.colors.recessed,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  occasionTagText: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  outfitTitle: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  weatherDetailBox: {
    alignItems: 'center',
    backgroundColor: SOFT_TACTILE.colors.ochreSoft,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
  },
  weatherDetailTemp: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  garmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  outfitGarmentCard: {
    width: '48%',
    backgroundColor: SOFT_TACTILE.colors.canvas,
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
  },
  cutoutImageBox: {
    width: '100%',
    height: 132,
    borderRadius: 16,
    backgroundColor: SOFT_TACTILE.colors.recessed,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  cutoutImage: {
    width: '100%',
    height: '100%',
  },
  wearPillOverlay: {
    position: 'absolute',
    bottom: 7,
    right: 7,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 999,
  },
  wearPillClean: {
    backgroundColor: SOFT_TACTILE.colors.sage,
  },
  wearPillDirty: {
    backgroundColor: SOFT_TACTILE.colors.clayRed,
  },
  wearPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  garmentItemCategory: {
    color: SOFT_TACTILE.colors.terracotta,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  garmentItemName: {
    color: SOFT_TACTILE.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  garmentWearCounter: {
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  tipsContainer: {
    backgroundColor: SOFT_TACTILE.colors.canvas,
    borderRadius: 18,
    padding: 13,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: SOFT_TACTILE.colors.border,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    flex: 1,
    color: SOFT_TACTILE.colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  wearTodayBtn: {
    flex: 2,
    backgroundColor: SOFT_TACTILE.colors.sage,
    paddingVertical: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  wearTodayBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  forceWashBtn: {
    flex: 1,
    backgroundColor: SOFT_TACTILE.colors.clayRedSoft,
    paddingVertical: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#EABCB7',
  },
  forceWashBtnText: {
    color: SOFT_TACTILE.colors.clayRed,
    fontSize: 12.5,
    fontWeight: '800',
  },
  wornConfirmedBanner: {
    backgroundColor: SOFT_TACTILE.colors.sageSoft,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  wornConfirmedText: {
    color: SOFT_TACTILE.colors.sage,
    fontSize: 13,
    fontWeight: '800',
  },
});
