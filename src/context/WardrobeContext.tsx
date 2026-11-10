import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_USER_PROFILE } from '../data/initialWardrobe';
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
import { storageKeys } from '../storage/keys';
import { migrateLegacyData } from '../storage/legacyMigration';
import {
  parseStoredGarments,
  parseStoredPlan,
  parseStoredProfile,
} from '../storage/schemas';
import {
  Garment,
  UserProfile,
  WashCareGroup,
  WeatherDay,
  WeeklyPlan,
} from '../types/wardrobe';
import { newId } from '../utils/id';

interface WardrobeContextValue {
  garments: Garment[];
  profile: UserProfile;
  weather: WeatherDay[];
  weeklyPlan: WeeklyPlan | null;
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
  regenerateWeeklyPlan: () => Promise<void>;
  refreshLocationAndWeather: () => Promise<void>;
}

const WardrobeContext = createContext<WardrobeContextValue | undefined>(undefined);

interface WardrobeProviderProps {
  children: React.ReactNode;
  /** Usuario autenticado. `null` = sin sesión: no se carga ni se guarda nada. */
  userId: string | null;
  /** Nombre inicial sugerido para el perfil de una cuenta nueva (nombre de Google/Apple o parte del email). */
  suggestedDisplayName?: string;
}

export const WardrobeProvider: React.FC<WardrobeProviderProps> = ({
  children,
  userId,
  suggestedDisplayName = '',
}) => {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    ...DEFAULT_USER_PROFILE,
    displayName: suggestedDisplayName,
  });
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Al cambiar de usuario se parte siempre de un estado limpio (nunca se mezclan datos de dos cuentas).
  const [stateOwner, setStateOwner] = useState<string | null>(userId);
  if (stateOwner !== userId) {
    setStateOwner(userId);
    setGarments([]);
    setProfile({ ...DEFAULT_USER_PROFILE, displayName: suggestedDisplayName });
    setWeather([]);
    setWeeklyPlan(null);
  }

  const keys = useMemo(() => (userId ? storageKeys(userId) : null), [userId]);

  // Carga inicial por usuario: AsyncStorage (+ migración legacy) → Supabase → clima.
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    const keys = storageKeys(userId);

    (async () => {
      try {
        await migrateLegacyData(AsyncStorage, userId, newId);

        const [storedGarments, storedProfile, storedPlan] = await Promise.all([
          AsyncStorage.getItem(keys.garments),
          AsyncStorage.getItem(keys.profile),
          AsyncStorage.getItem(keys.weeklyPlan),
        ]);
        if (cancelled) return;

        let activeGarments: Garment[] = parseStoredGarments(storedGarments) ?? [];
        const parsedProfile = parseStoredProfile(storedProfile);
        const activeProfile: UserProfile = {
          ...DEFAULT_USER_PROFILE,
          displayName: suggestedDisplayName,
          ...(parsedProfile ?? {}),
        };
        setGarments(activeGarments);
        setProfile(activeProfile);

        const supabase = getSupabaseClient();
        if (supabase) {
          const remoteGarments = await syncGarmentsFromSupabase(supabase);
          if (cancelled) return;
          if (remoteGarments && remoteGarments.length > 0) {
            activeGarments = remoteGarments;
            setGarments(remoteGarments);
            await AsyncStorage.setItem(keys.garments, JSON.stringify(remoteGarments));
          }
          // Garantiza que exista la fila de perfil de la cuenta.
          if (!parsedProfile) {
            await upsertProfileToSupabase(supabase, activeProfile);
          }
        }

        setIsLoadingWeather(true);
        const forecast = await fetchSevenDayWeather(
          activeProfile.latitude,
          activeProfile.longitude
        );
        if (cancelled) return;
        setWeather(forecast);
        setIsLoadingWeather(false);

        const cachedPlan = parseStoredPlan(storedPlan);
        if (cachedPlan) {
          setWeeklyPlan(cachedPlan);
        } else {
          const clean = activeGarments.filter(
            (g) => g.status === 'clean' && g.current_wears < g.max_wears_before_wash
          );
          const initialPlan = buildSmartLocalWeeklyPlan(clean, activeProfile, forecast);
          setWeeklyPlan(initialPlan);
          await AsyncStorage.setItem(keys.weeklyPlan, JSON.stringify(initialPlan));
        }
      } catch (e) {
        console.warn('Error cargando estado inicial de WearWise:', e);
        if (!cancelled) setIsLoadingWeather(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // suggestedDisplayName solo se usa al crear el estado inicial de una cuenta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const persistGarments = useCallback(
    async (updated: Garment[]) => {
      setGarments(updated);
      if (keys) await AsyncStorage.setItem(keys.garments, JSON.stringify(updated));
    },
    [keys]
  );

  const persistPlan = useCallback(
    async (plan: WeeklyPlan) => {
      setWeeklyPlan(plan);
      if (keys) await AsyncStorage.setItem(keys.weeklyPlan, JSON.stringify(plan));
    },
    [keys]
  );

  const addGarment = useCallback(
    async (newGarmentData: Omit<Garment, 'id' | 'created_at'>): Promise<Garment> => {
      const created: Garment = {
        ...newGarmentData,
        id: newId(),
        created_at: new Date().toISOString(),
      };
      const next = [created, ...garments];
      await persistGarments(next);

      const supabase = getSupabaseClient();
      if (supabase) {
        await upsertGarmentToSupabase(supabase, created);
      }
      return created;
    },
    [garments, persistGarments]
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
      await persistPlan(nextPlan);
    },
    [weeklyPlan, garments, persistGarments, persistPlan]
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
      if (keys) await AsyncStorage.setItem(keys.profile, JSON.stringify(nextProfile));

      const supabase = getSupabaseClient();
      if (supabase) {
        await upsertProfileToSupabase(supabase, nextProfile);
      }
    },
    [profile, keys]
  );

  const regenerateWeeklyPlan = useCallback(async () => {
    setIsGeneratingPlan(true);
    try {
      const activeWeather =
        weather.length > 0
          ? weather
          : await fetchSevenDayWeather(profile.latitude, profile.longitude);
      if (weather.length === 0) setWeather(activeWeather);

      const newPlan = await generateWeeklyOutfitsWithAI(garments, profile, activeWeather);
      await persistPlan(newPlan);

      const supabase = getSupabaseClient();
      if (supabase) {
        await saveWeeklyPlanToSupabase(supabase, newPlan);
      }
    } finally {
      setIsGeneratingPlan(false);
    }
  }, [garments, profile, weather, persistPlan]);

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
