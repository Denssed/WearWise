import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageKeys } from './keys';

/** Borra del dispositivo todos los datos locales de un usuario (se usa al eliminar la cuenta). */
export async function clearUserData(userId: string): Promise<void> {
  const keys = storageKeys(userId);
  await AsyncStorage.multiRemove([keys.garments, keys.profile, keys.weeklyPlan]);
}
