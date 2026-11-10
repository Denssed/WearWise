import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DEFAULT_USER_PROFILE } from '../data/initialWardrobe';
import { AiServiceError } from '../services/aiErrors';
import {
  buildSmartLocalWeeklyPlan,
  generateWeeklyOutfitsWithAI,
} from '../services/aiPipeline';
import { requestCutout } from '../services/garmentAI';
import { uploadGarmentImage } from '../services/imageStorage';
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
  CutoutStatus,
  Garment,
  UserProfile,
  WashCareGroup,
  WeatherDay,
  WeeklyPlan,
} from '../types/wardrobe';
import { newId } from '../utils/id';
import { isLocalImageUri, storagePathFromPublicUrl } from '../utils/storagePath';

/** Campos de una prenda que el usuario puede editar. */
export type GarmentEditableFields = Partial<
  Pick<
    Garment,
    | 'name'
    | 'category'
    | 'subcategory'
    | 'colors'
    | 'fabric'
    | 'seasons'
    | 'formality'
    | 'wash_care_group'
    | 'max_wears_before_wash'
    | 'care_instructions'
    | 'ai_styling_notes'
    | 'is_favorite'
  >
>;

export interface CutoutRequestResult {
  status: CutoutStatus;
  /** Mensaje para el usuario cuando no quedó listo. */
  message?: string;
}

interface WardrobeContextValue {
  garments: Garment[];
  profile: UserProfile;
  weather: WeatherDay[];
  weeklyPlan: WeeklyPlan | null;
  isGeneratingPlan: boolean;
  isLoadingWeather: boolean;
  addGarment: (newGarment: Omit<Garment, 'id' | 'created_at'>) => Promise<Garment>;
  deleteGarment: (id: string) => Promise<void>;
  updateGarment: (id: string, fields: GarmentEditableFields) => Promise<void>;
  /** Marca la prenda para recorte de fondo y lo intenta ahora. */
  requestCutoutFor: (id: string) => Promise<CutoutRequestResult>;
  /** Sube fotos pendientes y reintenta recortes en cola (se llama sola al abrir la app y al agregar prendas). */
  processBackgroundWork: () => Promise<void>;
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

  // Espejo síncrono de `garments` para el trabajo en segundo plano (evita leer un estado viejo entre awaits).
  const garmentsRef = useRef<Garment[]>([]);
  const workRunning = useRef(false);
  useEffect(() => {
    garmentsRef.current = garments;
  }, [garments]);

  /** Aplica cambios a una prenda, los guarda en el dispositivo y los sube a Supabase. */
  const patchGarment = useCallback(
    async (id: string, patch: Partial<Garment>) => {
      const next = garmentsRef.current.map((g) => (g.id === id ? { ...g, ...patch } : g));
      garmentsRef.current = next;
      await persistGarments(next);
      const updated = next.find((g) => g.id === id);
      const supabase = getSupabaseClient();
      if (supabase && updated) await upsertGarmentToSupabase(supabase, updated);
    },
    [persistGarments]
  );

  /**
   * Un intento de recorte. 'done' = listo, 'failed' = error definitivo con esta imagen,
   * 'retry' = reintentar más tarde; `stop` = no seguir con otras prendas (sin red, sin cuota, sin sesión).
   */
  const attemptCutout = useCallback(
    async (
      g: Garment
    ): Promise<{ outcome: 'done' | 'failed' | 'retry'; stop: boolean; message?: string }> => {
      const path = storagePathFromPublicUrl(g.original_image_url);
      if (!path) {
        return { outcome: 'retry', stop: false, message: 'La foto aún no se ha subido. Se intentará de nuevo.' };
      }
      try {
        const url = await requestCutout(path);
        await patchGarment(g.id, { cutout_image_url: url, cutout_status: 'done' });
        return { outcome: 'done', stop: false };
      } catch (e) {
        if (e instanceof AiServiceError) {
          if (e.code === 'invalid') {
            await patchGarment(g.id, { cutout_status: 'failed' });
            return { outcome: 'failed', stop: false, message: e.message };
          }
          return { outcome: 'retry', stop: true, message: e.message };
        }
        return { outcome: 'retry', stop: true, message: 'No pudimos quitar el fondo ahora.' };
      }
    },
    [patchGarment]
  );

  /** Sube las fotos que solo existen en el dispositivo. Devuelve false si no hubo conexión. */
  const uploadLocalImages = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const local = garmentsRef.current.filter(
      (g) => isLocalImageUri(g.original_image_url) || isLocalImageUri(g.cutout_image_url)
    );
    for (const g of local) {
      try {
        const source = isLocalImageUri(g.original_image_url) ? g.original_image_url! : g.cutout_image_url;
        const up = await uploadGarmentImage(userId, source);
        await patchGarment(g.id, {
          original_image_url: up.publicUrl,
          cutout_image_url: isLocalImageUri(g.cutout_image_url) ? up.publicUrl : g.cutout_image_url,
        });
      } catch (e) {
        console.warn('No se pudo subir la foto de una prenda (se reintentará):', e);
        return false;
      }
    }
    return true;
  }, [userId, patchGarment]);

  const processBackgroundWork = useCallback(async () => {
    if (workRunning.current || !userId) return;
    workRunning.current = true;
    try {
      await uploadLocalImages();
      // Máximo 3 recortes por ejecución para no saturar la cuota ni la red.
      const queue = garmentsRef.current.filter((g) => g.cutout_status === 'pending').slice(0, 3);
      for (const g of queue) {
        const result = await attemptCutout(g);
        if (result.stop) break;
      }
    } finally {
      workRunning.current = false;
    }
  }, [userId, uploadLocalImages, attemptCutout]);

  const requestCutoutFor = useCallback(
    async (id: string): Promise<CutoutRequestResult> => {
      const garment = garmentsRef.current.find((g) => g.id === id);
      if (!garment) return { status: 'none', message: 'No encontramos la prenda.' };

      await patchGarment(id, { cutout_status: 'pending' });
      if (!(await uploadLocalImages())) {
        return { status: 'pending', message: 'Sin conexión. Intentaremos quitar el fondo cuando haya internet.' };
      }
      const current = garmentsRef.current.find((g) => g.id === id) ?? garment;
      const result = await attemptCutout(current);
      if (result.outcome === 'done') return { status: 'done' };
      return {
        status: result.outcome === 'failed' ? 'failed' : 'pending',
        message:
          result.outcome === 'retry'
            ? `${result.message ?? 'No pudimos quitar el fondo ahora.'} Quedó en cola y se reintentará.`
            : result.message,
      };
    },
    [patchGarment, uploadLocalImages, attemptCutout]
  );

  const updateGarment = useCallback(
    async (id: string, fields: GarmentEditableFields) => {
      await patchGarment(id, fields);
    },
    [patchGarment]
  );

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

        // Fotos sin subir y recortes en cola de sesiones anteriores.
        garmentsRef.current = activeGarments;
        if (!cancelled) void processBackgroundWork();
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

  const addGarment = useCallback(
    async (newGarmentData: Omit<Garment, 'id' | 'created_at'>): Promise<Garment> => {
      const created: Garment = {
        ...newGarmentData,
        id: newId(),
        created_at: new Date().toISOString(),
      };
      const next = [created, ...garments];
      garmentsRef.current = next;
      await persistGarments(next);

      const supabase = getSupabaseClient();
      if (supabase) {
        await upsertGarmentToSupabase(supabase, created);
      }
      // Sube la foto si quedó pendiente y encola el recorte, sin bloquear al usuario.
      void processBackgroundWork();
      return created;
    },
    [garments, persistGarments, processBackgroundWork]
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
        updateGarment,
        requestCutoutFor,
        processBackgroundWork,
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
