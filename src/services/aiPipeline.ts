import { newId } from '../utils/id';
import {
  Garment,
  PlannedDayOutfit,
  UserProfile,
  WeatherDay,
  WeeklyPlan,
} from '../types/wardrobe';
import { getSupabaseClient } from './supabase';

/**
 * Envía el catálogo de prendas limpias, perfil y clima a la Edge Function
 * `generate-weekly-plan` en Supabase, donde Claude Haiku 5.5 genera los 7 días.
 */
export async function generateWeeklyOutfitsWithAI(
  garments: Garment[],
  profile: UserProfile,
  weather: WeatherDay[]
): Promise<WeeklyPlan> {
  const cleanGarments = garments.filter(
    (g) => g.status === 'clean' && g.current_wears < g.max_wears_before_wash
  );

  const supabase = getSupabaseClient();

  if (supabase && cleanGarments.length >= 2) {
    try {
      const { data, error } = await supabase.functions.invoke('generate-weekly-plan', {
        body: {
          garments: cleanGarments,
          profile,
          weatherForecast: weather,
        },
      });

      if (!error && Array.isArray(data?.days) && data.days.length > 0) {
        return {
          id: newId(),
          weekStartDate: weather[0]?.date || new Date().toISOString().split('T')[0],
          profileModeUsed: profile.profileMode,
          claudeSummary:
            data.claudeSummary ||
            'Plan semanal optimizado según el pronóstico del clima y las puestas disponibles.',
          days: data.days,
          generatedBy: 'claude_haiku',
          createdAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('Error invocando Edge Function generate-weekly-plan en Supabase:', err);
    }
  }

  return buildSmartLocalWeeklyPlan(cleanGarments, profile, weather);
}

export function buildSmartLocalWeeklyPlan(
  cleanGarments: Garment[],
  profile: UserProfile,
  weather: WeatherDay[]
): WeeklyPlan {
  const tops = cleanGarments.filter((g) => g.category === 'top');
  const bottoms = cleanGarments.filter((g) => g.category === 'bottom');
  const outerwears = cleanGarments.filter((g) => g.category === 'outerwear');
  const footwears = cleanGarments.filter((g) => g.category === 'footwear');

  const scheduleEntries = [
    { key: 'monday', label: 'Lunes', occasion: profile.weeklySchedule.monday },
    { key: 'tuesday', label: 'Martes', occasion: profile.weeklySchedule.tuesday },
    { key: 'wednesday', label: 'Miércoles', occasion: profile.weeklySchedule.wednesday },
    { key: 'thursday', label: 'Jueves', occasion: profile.weeklySchedule.thursday },
    { key: 'friday', label: 'Viernes', occasion: profile.weeklySchedule.friday },
    { key: 'saturday', label: 'Sábado', occasion: profile.weeklySchedule.saturday },
    { key: 'sunday', label: 'Domingo', occasion: profile.weeklySchedule.sunday },
  ];

  const days: PlannedDayOutfit[] = scheduleEntries.map((sched, idx) => {
    const w = weather[idx] || {
      date: new Date().toISOString().split('T')[0],
      dayName: sched.label,
      tempMin: 14,
      tempMax: 23,
      rainProbability: 15,
      conditionLabel: 'Templado',
      icon: 'partly-sunny' as const,
    };

    const top = tops[idx % Math.max(1, tops.length)];
    const bottom = bottoms[idx % Math.max(1, bottoms.length)];
    const shoe = footwears[idx % Math.max(1, footwears.length)];
    const needsJacket =
      w.tempMin <= 13 ||
      w.rainProbability >= 40 ||
      profile.climateSensitivity === 'cold_sensitive';
    const outer = needsJacket && outerwears.length > 0 ? outerwears[0] : undefined;

    const chosenIds = [top?.id, bottom?.id, outer?.id, shoe?.id].filter(Boolean) as string[];

    const occasionText =
      profile.profileMode === 'default'
        ? idx < 4
          ? 'Smart Casual Diario'
          : idx === 4
          ? 'Viernes Relajado'
          : 'Fin de Semana Cómodo'
        : sched.occasion;

    return {
      dayIndex: idx,
      dayName: sched.label,
      date: w.date,
      occasion: occasionText,
      outfitTitle:
        top && bottom
          ? `${top.subcategory} + ${bottom.subcategory}`
          : 'Conjunto Esencial WearWise',
      garmentIds: chosenIds,
      stylingTip:
        profile.profileMode === 'custom'
          ? `Alineado con tu perfil personalizado (${profile.styleArchetypes.slice(0, 2).join(' · ')}) optimizando los usos antes de lavar.`
          : `Combinación equilibrada en tonos ${[...(top?.colors || []), ...(bottom?.colors || [])].slice(0, 2).join(' y ')} que maximiza la frescura de tu armario.`,
      weatherNote: `${w.conditionLabel} (${w.tempMin}°C – ${w.tempMax}°C, lluvia ${w.rainProbability}%). ${
        outer ? 'Incluye capa exterior para cambios de temperatura.' : 'Prendas transpirables para el día.'
      }`,
      wornConfirmed: false,
    };
  });

  return {
    id: newId(),
    weekStartDate: weather[0]?.date || new Date().toISOString().split('T')[0],
    profileModeUsed: profile.profileMode,
    claudeSummary:
      profile.profileMode === 'custom'
        ? `Plan personalizado adaptado a tu agenda de 7 días (${profile.styleArchetypes.join(', ')}) excluyendo prendas en el cesto de ropa sucia.`
        : 'Plan semanal por defecto optimizado según el clima local y las puestas disponibles de tus prendas limpias.',
    days,
    generatedBy: 'smart_local',
    createdAt: new Date().toISOString(),
  };
}
