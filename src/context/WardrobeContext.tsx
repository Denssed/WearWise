import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_USER_PROFILE, INITIAL_GARMENTS } from '../data/initialWardrobe';
import {
  buildSmartLocalWeeklyPlan,
  generateWeeklyOutfitsWithAI,
} from '../services/aiPipeline';
import {
  getSupabaseClient,
  saveWeeklyPlanToSupabase,
  syncGarmentsFromSupabase,
  upsertGarmentToSupabase,
  upsertProfileToSupabase,
} from '../services/supabase';
import { fetchSevenDayWeather, requestUserCoordinates } from '../services/weather';
import {
  ApiSettings,
  Garment,
  UserProfile,
  WashCareGroup,
  WeatherDay,
  WeeklyPlan,
} from '../types/wardrobe';

const STORAGE_KEYS = {
  GARMENTS: '@wearwise/garments_v1',
  PROFILE: '@wearwise/profile_v1',
  WEEKLY_PLAN: '@wearwise/weekly_plan_v1',
  API_SETTINGS: '@wearwise/api_settings_v1',
};

interface WardrobeContextValue {
  garments: Garment[];
  profile: UserProfile;
  weather: WeatherDay[];
  weeklyPlan: WeeklyPlan | null;
  apiSettings: ApiSettings;
  isGeneratingPlan: boolean;
  isLoadingWeather: boolean;
  addGarment: (newGarment: Omit<Garment, 'id' | 'created_at'>) => Promise<Garment>;
  deleteGarment: (id: string) => Promise<void>;
  updateGarmentMaxWears: (id: string, maxWears: number) => Promise<void>;
  logGarmentWear: (id: string, forceDirty?: boolean) => Promise<void>;
  logDayOutfitWear: (dayIndex: number, forceDirty?: boolean) => Promise<void>;
  washGarmentsByIds: (ids: string[]) => Promise<void>;
  washBatchByGroup: (group: WashCareGroup) => Promise<void>;
  updateProfile: (updated: Partial<UserProfile>) => Promise<void>;
  updateApiSettings: (updated: Partial<ApiSettings>) => Promise<void>;
  regenerateWeeklyPlan: () => Promise<void>;
  refreshLocationAndWeather: () => Promise<void>;
}

const WardrobeContext = createContext<WardrobeContextValue | undefined>(undefined);

const DEFAULT_API_SETTINGS: ApiSettings = {
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    'https://gnhsmapjozmxpmhtudgx.supabase.co',
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduaHNtYXBqb3pteHBtaHR1ZGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzMzU5ODMsImV4cCI6MjEwOTkxMTk4M30.mS7472u9Tk_ScgBc1xhEDAxyENcEsA32LMJ30PEi7j0',
  replicateApiToken: '',
  replicateBgVersion:
    'a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc',
  claudeApiKey: '',
  claudeModel: 'claude-haiku-4-5-20251001',
};

export const WardrobeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [garments, setGarments] = useState<Garment[]>(INITIAL_GARMENTS);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [apiSettings, setApiSettings] = useState<ApiSettings>(DEFAULT_API_SETTINGS);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Carga inicial desde AsyncStorage + Clima + Supabase si está activo
  useEffect(() => {
    (async () => {
      try {
        const [storedGarments, storedProfile, storedPlan, storedSettings] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.GARMENTS),
            AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
            AsyncStorage.getItem(STORAGE_KEYS.WEEKLY_PLAN),
            AsyncStorage.getItem(STORAGE_KEYS.API_SETTINGS),
          ]);

        let activeGarments = INITIAL_GARMENTS;
        let activeProfile = DEFAULT_USER_PROFILE;
        let activeSettings = DEFAULT_API_SETTINGS;

        if (storedGarments) {
          activeGarments = JSON.parse(storedGarments);
          setGarments(activeGarments);
        }
        if (storedProfile) {
          activeProfile = { ...DEFAULT_USER_PROFILE, ...JSON.parse(storedProfile) };
          setProfile(activeProfile);
        }
        if (storedSettings) {
          activeSettings = { ...DEFAULT_API_SETTINGS, ...JSON.parse(storedSettings) };
          setApiSettings(activeSettings);
        }

        // Sincronizar con Supabase si está configurado
        const supabase = getSupabaseClient(activeSettings);
        if (supabase) {
          const remoteGarments = await syncGarmentsFromSupabase(supabase);
          if (remoteGarments && remoteGarments.length > 0) {
            activeGarments = remoteGarments;
            setGarments(remoteGarments);
            await AsyncStorage.setItem(
              STORAGE_KEYS.GARMENTS,
              JSON.stringify(remoteGarments)
            );
          }
        }

        setIsLoadingWeather(true);
        const forecast = await fetchSevenDayWeather(
          activeProfile.latitude,
          activeProfile.longitude
        );
        setWeather(forecast);
        setIsLoadingWeather(false);

        if (storedPlan) {
          setWeeklyPlan(JSON.parse(storedPlan));
        } else {
          const clean = activeGarments.filter(
            (g) => g.status === 'clean' && g.current_wears < g.max_wears_before_wash
          );
          const initialPlan = buildSmartLocalWeeklyPlan(clean, activeProfile, forecast);
          setWeeklyPlan(initialPlan);
          await AsyncStorage.setItem(
            STORAGE_KEYS.WEEKLY_PLAN,
            JSON.stringify(initialPlan)
          );
        }
      } catch (e) {
        console.warn('Error cargando estado inicial de WearWise:', e);
      }
    })();
  }, []);

  const persistGarments = useCallback(
    async (updated: Garment[]) => {
      setGarments(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.GARMENTS, JSON.stringify(updated));
    },
    []
  );

  const addGarment = useCallback(
    async (newGarmentData: Omit<Garment, 'id' | 'created_at'>): Promise<Garment> => {
      const created: Garment = {
        ...newGarmentData,
        id: `garment-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      const next = [created, ...garments];
      await persistGarments(next);

      const supabase = getSupabaseClient(apiSettings);
      if (supabase) {
        await upsertGarmentToSupabase(supabase, created);
      }
      return created;
    },
    [garments, apiSettings, persistGarments]
  );

  const deleteGarment = useCallback(
    async (id: string) => {
      const next = garments.filter((g) => g.id !== id);
      await persistGarments(next);
    },
    [garments, persistGarments]
  );

  const updateGarmentMaxWears = useCallback(
    async (id: string, maxWears: number) => {
      const safeMax = Math.max(1, Math.min(20, maxWears));
      const next = garments.map((g) => {
        if (g.id !== id) return g;
        const needsWash = g.current_wears >= safeMax;
        return {
          ...g,
          max_wears_before_wash: safeMax,
          status: needsWash ? ('needs_wash' as const) : ('clean' as const),
        };
      });
      await persistGarments(next);
    },
    [garments, persistGarments]
  );

  const logGarmentWear = useCallback(
    async (id: string, forceDirty = false) => {
      const now = new Date().toISOString();
      const next = garments.map((g) => {
        if (g.id !== id) return g;
        const newWears = g.current_wears + 1;
        const shouldWash = forceDirty || newWears >= g.max_wears_before_wash;
        return {
          ...g,
          current_wears: newWears,
          total_lifetime_wears: g.total_lifetime_wears + 1,
          last_worn_at: now,
          status: shouldWash ? ('needs_wash' as const) : ('clean' as const),
        };
      });
      await persistGarments(next);
    },
    [garments, persistGarments]
  );

  const logDayOutfitWear = useCallback(
    async (dayIndex: number, forceDirty = false) => {
      if (!weeklyPlan) return;
      const dayItem = weeklyPlan.days.find((d) => d.dayIndex === dayIndex);
      if (!dayItem || dayItem.wornConfirmed) return;

      const targetSet = new Set(dayItem.garmentIds);
      const now = new Date().toISOString();

      const nextGarments = garments.map((g) => {
        if (!targetSet.has(g.id)) return g;
        const newWears = g.current_wears + 1;
        const shouldWash = forceDirty || newWears >= g.max_wears_before_wash;
        return {
          ...g,
          current_wears: newWears,
          total_lifetime_wears: g.total_lifetime_wears + 1,
          last_worn_at: now,
          status: shouldWash ? ('needs_wash' as const) : ('clean' as const),
        };
      });

      const nextPlan: WeeklyPlan = {
        ...weeklyPlan,
        days: weeklyPlan.days.map((d) =>
          d.dayIndex === dayIndex ? { ...d, wornConfirmed: true } : d
        ),
      };

      await persistGarments(nextGarments);
      setWeeklyPlan(nextPlan);
      await AsyncStorage.setItem(STORAGE_KEYS.WEEKLY_PLAN, JSON.stringify(nextPlan));
    },
    [weeklyPlan, garments, persistGarments]
  );

  const washGarmentsByIds = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      const next = garments.map((g) =>
        idSet.has(g.id)
          ? {
              ...g,
              current_wears: 0,
              status: 'clean' as const,
              last_washed_at: now,
            }
          : g
      );
      await persistGarments(next);
    },
    [garments, persistGarments]
  );

  const washBatchByGroup = useCallback(
    async (group: WashCareGroup) => {
      const now = new Date().toISOString();
      const next = garments.map((g) =>
        g.wash_care_group === group && (g.status === 'needs_wash' || g.current_wears > 0)
          ? {
              ...g,
              current_wears: 0,
              status: 'clean' as const,
              last_washed_at: now,
            }
          : g
      );
      await persistGarments(next);
    },
    [garments, persistGarments]
  );

  const updateProfile = useCallback(
    async (updated: Partial<UserProfile>) => {
      const nextProfile: UserProfile = { ...profile, ...updated };
      setProfile(nextProfile);
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(nextProfile));

      const supabase = getSupabaseClient(apiSettings);
      if (supabase) {
        await upsertProfileToSupabase(supabase, nextProfile);
      }
    },
    [profile, apiSettings]
  );

  const updateApiSettings = useCallback(
    async (updated: Partial<ApiSettings>) => {
      const nextSettings: ApiSettings = { ...apiSettings, ...updated };
      setApiSettings(nextSettings);
      await AsyncStorage.setItem(STORAGE_KEYS.API_SETTINGS, JSON.stringify(nextSettings));
    },
    [apiSettings]
  );

  const regenerateWeeklyPlan = useCallback(async () => {
    setIsGeneratingPlan(true);
    try {
      const activeWeather =
        weather.length > 0
          ? weather
          : await fetchSevenDayWeather(profile.latitude, profile.longitude);
      if (weather.length === 0) setWeather(activeWeather);

      const newPlan = await generateWeeklyOutfitsWithAI(
        garments,
        profile,
        activeWeather,
        apiSettings
      );
      setWeeklyPlan(newPlan);
      await AsyncStorage.setItem(STORAGE_KEYS.WEEKLY_PLAN, JSON.stringify(newPlan));

      const supabase = getSupabaseClient(apiSettings);
      if (supabase) {
        await saveWeeklyPlanToSupabase(supabase, newPlan);
      }
    } finally {
      setIsGeneratingPlan(false);
    }
  }, [garments, profile, weather, apiSettings]);

  const refreshLocationAndWeather = useCallback(async () => {
    setIsLoadingWeather(true);
    try {
      const coords = await requestUserCoordinates();
      const lat = coords?.latitude ?? profile.latitude;
      const lon = coords?.longitude ?? profile.longitude;
      if (coords) {
        await updateProfile({
          latitude: lat,
          longitude: lon,
          cityName: coords.cityName || profile.cityName,
        });
      }
      const forecast = await fetchSevenDayWeather(lat, lon);
      setWeather(forecast);
    } finally {
      setIsLoadingWeather(false);
    }
  }, [profile, updateProfile]);

  return (
    <WardrobeContext.Provider
      value={{
        garments,
        profile,
        weather,
        weeklyPlan,
        apiSettings,
        isGeneratingPlan,
        isLoadingWeather,
        addGarment,
        deleteGarment,
        updateGarmentMaxWears,
        logGarmentWear,
        logDayOutfitWear,
        washGarmentsByIds,
        washBatchByGroup,
        updateProfile,
        updateApiSettings,
        regenerateWeeklyPlan,
        refreshLocationAndWeather,
      }}
    >
      {children}
    </WardrobeContext.Provider>
  );
};

export function useWardrobe() {
  const ctx = useContext(WardrobeContext);
  if (!ctx) {
    throw new Error('useWardrobe debe usarse dentro de un WardrobeProvider');
  }
  return ctx;
}
