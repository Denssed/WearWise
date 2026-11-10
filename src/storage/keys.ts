/** Claves de AsyncStorage por usuario, para que dos cuentas nunca compartan datos en el mismo dispositivo. */
export function storageKeys(userId: string) {
  return {
    garments: `@wearwise/${userId}/garments_v1`,
    profile: `@wearwise/${userId}/profile_v1`,
    weeklyPlan: `@wearwise/${userId}/weekly_plan_v1`,
  };
}

/** Claves anteriores a la autenticación (un solo "usuario" por dispositivo). */
export const LEGACY_KEYS = {
  garments: '@wearwise/garments_v1',
  profile: '@wearwise/profile_v1',
  weeklyPlan: '@wearwise/weekly_plan_v1',
  apiSettings: '@wearwise/api_settings_v1',
} as const;
