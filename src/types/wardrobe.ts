export type GarmentCategory =
  | 'top'
  | 'bottom'
  | 'outerwear'
  | 'footwear'
  | 'one_piece'
  | 'accessory';

export type WashCareGroup = 'whites' | 'darks' | 'colors' | 'delicates';

export type GarmentStatus = 'clean' | 'needs_wash';

export type Season = 'primavera' | 'verano' | 'otoño' | 'invierno';

/**
 * Estado del recorte de fondo:
 * - none: no se pidió (se muestra la foto original)
 * - pending: en cola; se reintenta automáticamente cuando el servicio responde
 * - done: `cutout_image_url` es el PNG sin fondo
 * - failed: error no recuperable (el usuario puede reintentar a mano)
 */
export type CutoutStatus = 'none' | 'pending' | 'done' | 'failed';

/** Cómo se rellenaron los datos de la prenda. */
export type AnalysisSource = 'ai' | 'manual';

export interface Garment {
  id: string;
  name: string;
  category: GarmentCategory;
  subcategory: string;
  /** Imagen que se muestra. Es la foto original hasta que el recorte esté listo. */
  cutout_image_url: string;
  original_image_url?: string;
  cutout_status: CutoutStatus;
  analysis_source: AnalysisSource;
  colors: string[];
  pattern: string;
  fabric: string;
  seasons: Season[];
  formality: number; // 1 (deportivo/casa) a 5 (formal)
  wash_care_group: WashCareGroup;
  care_instructions: string;
  current_wears: number;
  max_wears_before_wash: number;
  total_lifetime_wears: number;
  status: GarmentStatus;
  ai_styling_notes: string;
  is_favorite: boolean;
  last_worn_at?: string;
  last_washed_at?: string;
  created_at: string;
}

export type ProfileMode = 'default' | 'custom';

export interface WeeklySchedule {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

export interface UserProfile {
  displayName: string;
  profileMode: ProfileMode;
  styleArchetypes: string[];
  preferredColors: string[];
  avoidColors: string[];
  workEnvironment: 'remote' | 'office_casual' | 'business_formal' | 'hybrid' | 'student' | 'active';
  climateSensitivity: 'cold_sensitive' | 'normal' | 'heat_sensitive';
  cityName: string;
  latitude: number;
  longitude: number;
  weeklySchedule: WeeklySchedule;
  customPromptNotes: string;
}

export interface WeatherDay {
  date: string;
  dayName: string;
  tempMin: number;
  tempMax: number;
  rainProbability: number;
  conditionLabel: string;
  icon: 'sunny' | 'partly-sunny' | 'cloudy' | 'rainy' | 'thunderstorm';
}

export interface PlannedDayOutfit {
  dayIndex: number;
  dayName: string;
  date: string;
  occasion: string;
  outfitTitle: string;
  garmentIds: string[];
  stylingTip: string;
  weatherNote: string;
  wornConfirmed?: boolean;
}

export interface WeeklyPlan {
  id: string;
  weekStartDate: string;
  profileModeUsed: ProfileMode;
  claudeSummary: string;
  days: PlannedDayOutfit[];
  generatedBy: 'claude_haiku' | 'smart_local';
  createdAt: string;
}

export const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  top: 'Parte Superior',
  bottom: 'Parte Inferior',
  outerwear: 'Abrigo / Chamarra',
  footwear: 'Calzado',
  one_piece: ' Cuerpo Completo',
  accessory: 'Accesorio',
};

export const WASH_GROUP_INFO: Record<
  WashCareGroup,
  { label: string; subtitle: string; tempRecommendation: string; color: string; icon: string }
> = {
  whites: {
    label: 'Ropa Blanca',
    subtitle: 'Camisas, camisetas claras y algodones blancos',
    tempRecommendation: 'Agua tibia (30-40°C) · Ciclo normal',
    color: '#3B82F6',
    icon: 'sunny-outline',
  },
  darks: {
    label: 'Oscuros y Mezclilla',
    subtitle: 'Jeans, pantalones negros, azul marino y grises oscuros',
    tempRecommendation: 'Agua fría (20-30°C) · Al revés para cuidar el color',
    color: '#6366F1',
    icon: 'moon-outline',
  },
  colors: {
    label: 'Ropa de Color',
    subtitle: 'Tonos vivos, pasteles y prendas cotidianas de color',
    tempRecommendation: 'Agua fría (30°C) · Ciclo suave/normal',
    color: '#10B981',
    icon: 'color-palette-outline',
  },
  delicates: {
    label: 'Delicados / Lana / Lino',
    subtitle: 'Tejidos finos, punto, lino o lavado a mano',
    tempRecommendation: 'Agua fría · Ciclo delicado en bolsa de red',
    color: '#F59E0B',
    icon: 'sparkles-outline',
  },
};
