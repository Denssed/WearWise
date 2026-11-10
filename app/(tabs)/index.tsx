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
        {/* HEADER */}
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
                  name={profile.profileMode === 'custom' ? 'options-outline' : 'flash-outline'}
                  size={12}
                  color="#E0E7FF"
                />
                <Text style={styles.modeBadgeText}>
                  {profile.profileMode === 'custom'
                    ? 'Perfil Personalizado'
                    : 'Perfil Default'}
                </Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              Hola, {profile.displayName} · Estilista Claude Haiku 5.5
            </Text>
          </View>

          <TouchableOpacity
            style={styles.weatherChip}
            onPress={refreshLocationAndWeather}
            disabled={isLoadingWeather}
          >
            <Ionicons name="location-outline" size={14} color="#38BDF8" />
            <Text style={styles.weatherChipText} numberOfLines={1}>
              {isLoadingWeather ? 'Clima...' : profile.cityName}
            </Text>
          </TouchableOpacity>
        </View>

        {/* RESUMEN RÁPIDO DE ARMARIO Y LAVANDERÍA */}
        <View style={styles.metricsRow}>
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => router.push('/(tabs)/wardrobe')}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#1E293B' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#34D399" />
            </View>
            <View>
              <Text style={styles.metricValue}>{cleanCount}</Text>
              <Text style={styles.metricLabel}>Prendas limpias</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => router.push('/(tabs)/laundry')}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#1E293B' }]}>
              <Ionicons
                name="water"
                size={20}
                color={dirtyCount > 0 ? '#F87171' : '#60A5FA'}
              />
            </View>
            <View>
              <Text
                style={[
                  styles.metricValue,
                  dirtyCount > 0 && { color: '#F87171' },
                ]}
              >
                {dirtyCount}
              </Text>
              <Text style={styles.metricLabel}>Para lavar</Text>
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
                <Text style={styles.generateButtonText}>Sugerir Semana</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* BANNER DE ESTRATEGIA DE CLAUDE */}
        {weeklyPlan?.claudeSummary ? (
          <View style={styles.aiSummaryBox}>
            <View style={styles.aiSummaryHeader}>
              <Ionicons name="sparkles" size={15} color="#A5B4FC" />
              <Text style={styles.aiSummaryTitle}>
                Estrategia Semanal ({weeklyPlan.generatedBy === 'claude_haiku' ? 'Claude Haiku 5.5' : 'Motor Inteligente'})
              </Text>
            </View>
            <Text style={styles.aiSummaryText}>{weeklyPlan.claudeSummary}</Text>
          </View>
        ) : null}

        {/* SELECTOR DE LOS 7 DÍAS + CLIMA */}
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
                    <Ionicons name="checkmark-circle" size={14} color="#34D399" />
                  ) : null}
                </View>

                <Ionicons
                  name={w?.icon || 'partly-sunny'}
                  size={20}
                  color={isSelected ? '#FFFFFF' : '#94A3B8'}
                  style={{ marginVertical: 6 }}
                />

                <Text
                  style={[
                    styles.dayTempText,
                    isSelected && { color: '#E0E7FF' },
                  ]}
                >
                  {w ? `${w.tempMin}° / ${w.tempMax}°` : '15° / 24°'}
                </Text>
                {w && w.rainProbability >= 35 ? (
                  <Text style={styles.rainBadge}>{w.rainProbability}% lluvia</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* TARJETA DEL OUTFIT DEL DÍA SELECCIONADO */}
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
                  <Ionicons name={activeWeather.icon} size={22} color="#38BDF8" />
                  <Text style={styles.weatherDetailTemp}>
                    {activeWeather.tempMax}°C
                  </Text>
                </View>
              ) : null}
            </View>

            {/* COLLAGE DE PRENDAS DEL OUTFIT (RECORTES) */}
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
                            : `${remaining} ${remaining === 1 ? 'uso libre' : 'usos libres'}`}
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
                <Ionicons name="bulb-outline" size={16} color="#FBBF24" />
                <Text style={styles.tipText}>{activeDayPlan.stylingTip}</Text>
              </View>
              <View style={styles.tipRow}>
                <Ionicons name="thermometer-outline" size={16} color="#38BDF8" />
                <Text style={styles.tipText}>{activeDayPlan.weatherNote}</Text>
              </View>
            </View>

            {/* BOTONES DE CONTROL DE USO Y LAVADO */}
            {activeDayPlan.wornConfirmed ? (
              <View style={styles.wornConfirmedBanner}>
                <Ionicons name="checkmark-done-circle" size={20} color="#34D399" />
                <Text style={styles.wornConfirmedText}>
                  Uso registrado hoy · Contadores de lavado actualizados
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
                  <Ionicons name="water-outline" size={18} color="#FCA5A5" />
                  <Text style={styles.forceWashBtnText}>Ensució / Lavar</Text>
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
    backgroundColor: '#0B0F19',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 18,
    paddingBottom: 36,
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
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  modeBadgeDefault: {
    backgroundColor: '#312E81',
  },
  modeBadgeCustom: {
    backgroundColor: '#065F46',
  },
  modeBadgeText: {
    color: '#E0E7FF',
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 3,
  },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E293B',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    maxWidth: 140,
  },
  weatherChipText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 11,
  },
  generateButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  aiSummaryBox: {
    backgroundColor: '#1E1B4B',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: '#3730A3',
    marginBottom: 18,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  aiSummaryTitle: {
    color: '#C7D2FE',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  aiSummaryText: {
    color: '#E0E7FF',
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  daysScroll: {
    gap: 10,
    paddingBottom: 14,
  },
  dayPill: {
    width: 78,
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  dayPillActive: {
    backgroundColor: '#4338CA',
    borderColor: '#818CF8',
  },
  dayPillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayPillName: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  dayPillNameActive: {
    color: '#FFFFFF',
  },
  dayTempText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  rainBadge: {
    marginTop: 3,
    fontSize: 9,
    color: '#38BDF8',
    fontWeight: '700',
  },
  outfitCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
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
    marginBottom: 4,
  },
  dayFullLabel: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  occasionTag: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  occasionTagText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  outfitTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  weatherDetailBox: {
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  weatherDetailTemp: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
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
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cutoutImageBox: {
    width: '100%',
    height: 130,
    borderRadius: 10,
    backgroundColor: '#1E293B',
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
    bottom: 6,
    right: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  wearPillClean: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
  },
  wearPillDirty: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  wearPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  garmentItemCategory: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  garmentItemName: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  garmentWearCounter: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 3,
  },
  tipsContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 12.5,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  wearTodayBtn: {
    flex: 2,
    backgroundColor: '#10B981',
    paddingVertical: 13,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  wearTodayBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  forceWashBtn: {
    flex: 1,
    backgroundColor: '#3F1D24',
    paddingVertical: 13,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  forceWashBtnText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
  },
  wornConfirmedBanner: {
    backgroundColor: '#064E3B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  wornConfirmedText: {
    color: '#A7F3D0',
    fontSize: 13,
    fontWeight: '700',
  },
});
