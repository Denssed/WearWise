import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV, isSupabaseConfigured } from '../config/env';
import { parseRemoteGarments } from '../storage/schemas';
import { Garment, UserProfile, WeeklyPlan } from '../types/wardrobe';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseInstance;
}

export async function syncGarmentsFromSupabase(
  client: SupabaseClient
): Promise<Garment[] | null> {
  try {
    const { data, error } = await client
      .from('garments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;
    return parseRemoteGarments(data);
  } catch {
    return null;
  }
}

export async function upsertGarmentToSupabase(
  client: SupabaseClient,
  garment: Garment
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return false;

    const { error } = await client.from('garments').upsert({
      ...garment,
      user_id: user.id,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function upsertProfileToSupabase(
  client: SupabaseClient,
  profile: UserProfile
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return false;

    const { error } = await client.from('profiles').upsert({
      id: user.id,
      display_name: profile.displayName,
      profile_mode: profile.profileMode,
      style_archetypes: profile.styleArchetypes,
      preferred_colors: profile.preferredColors,
      avoid_colors: profile.avoidColors,
      work_environment: profile.workEnvironment,
      climate_sensitivity: profile.climateSensitivity,
      city_name: profile.cityName,
      latitude: profile.latitude,
      longitude: profile.longitude,
      weekly_schedule: profile.weeklySchedule,
      custom_prompt_notes: profile.customPromptNotes,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

export async function saveWeeklyPlanToSupabase(
  client: SupabaseClient,
  plan: WeeklyPlan
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return false;

    const { error } = await client.from('weekly_plans').upsert({
      user_id: user.id,
      week_start_date: plan.weekStartDate,
      profile_mode_used: plan.profileModeUsed,
      days: plan.days,
      claude_summary: plan.claudeSummary,
    });
    return !error;
  } catch {
    return false;
  }
}
