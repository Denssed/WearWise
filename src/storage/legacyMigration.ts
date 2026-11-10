import { INITIAL_GARMENTS } from '../data/initialWardrobe';
import { LEGACY_KEYS, storageKeys } from './keys';
import { parseStoredGarments, parseStoredProfile } from './schemas';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEMO_IDS = new Set(INITIAL_GARMENTS.map((g) => g.id));

/**
 * Traslada los datos locales previos a la autenticación a la primera cuenta que inicia sesión.
 * - Descarta las prendas de demostración (INITIAL_GARMENTS).
 * - Reemplaza IDs que no son UUID (p. ej. "garment-1712...") para poder sincronizarlos con Supabase.
 * - El plan semanal antiguo se descarta (se regenera con las prendas reales).
 * - Borra las claves legacy al terminar, así solo se migra una vez.
 * Devuelve cuántas prendas se migraron.
 */
export async function migrateLegacyData(
  storage: KeyValueStorage,
  userId: string,
  newId: () => string
): Promise<number> {
  const [rawGarments, rawProfile] = await Promise.all([
    storage.getItem(LEGACY_KEYS.garments),
    storage.getItem(LEGACY_KEYS.profile),
  ]);
  const hadLegacy = rawGarments !== null || rawProfile !== null;
  if (!hadLegacy) {
    await storage.removeItem(LEGACY_KEYS.apiSettings);
    return 0;
  }

  const keys = storageKeys(userId);
  const garments = (parseStoredGarments(rawGarments) ?? [])
    .filter((g) => !DEMO_IDS.has(g.id))
    .map((g) => (UUID_RE.test(g.id) ? g : { ...g, id: newId() }));

  // No pisar datos que el usuario ya tenga bajo su cuenta.
  const existing = await storage.getItem(keys.garments);
  if (garments.length > 0 && existing === null) {
    await storage.setItem(keys.garments, JSON.stringify(garments));
  }
  const profile = parseStoredProfile(rawProfile);
  if (profile && (await storage.getItem(keys.profile)) === null) {
    await storage.setItem(keys.profile, JSON.stringify(profile));
  }

  await Promise.all([
    storage.removeItem(LEGACY_KEYS.garments),
    storage.removeItem(LEGACY_KEYS.profile),
    storage.removeItem(LEGACY_KEYS.weeklyPlan),
    storage.removeItem(LEGACY_KEYS.apiSettings),
  ]);
  return garments.length;
}
