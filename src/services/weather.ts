import * as Location from 'expo-location';
import { WeatherDay } from '../types/wardrobe';

const DAY_NAMES_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

function mapWmoCodeToWeather(
  code: number,
  rainProb: number
): { label: string; icon: WeatherDay['icon'] } {
  if (code >= 95) return { label: 'Tormenta eléctrica', icon: 'thunderstorm' };
  if (code >= 51 || rainProb >= 55) return { label: 'Lluvia probable', icon: 'rainy' };
  if (code >= 3) return { label: 'Nublado', icon: 'cloudy' };
  if (code >= 1) return { label: 'Parcialmente nublado', icon: 'partly-sunny' };
  return { label: 'Soleado y despejado', icon: 'sunny' };
}

export async function requestUserCoordinates(): Promise<{
  latitude: number;
  longitude: number;
  cityName?: string;
} | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    let cityName: string | undefined;
    try {
      const reverse = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (reverse.length > 0) {
        cityName = reverse[0].city || reverse[0].region || undefined;
      }
    } catch {
      // Ignorar si falla geocodificación inversa en web/emulador
    }

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      cityName,
    };
  } catch {
    return null;
  }
}

export async function fetchSevenDayWeather(
  latitude = 19.4326,
  longitude = -99.1332
): Promise<WeatherDay[]> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error consultando Open-Meteo');

    const data = await res.json();
    const dates: string[] = data?.daily?.time || [];
    const maxTemps: number[] = data?.daily?.temperature_2m_max || [];
    const minTemps: number[] = data?.daily?.temperature_2m_min || [];
    const rainProbs: number[] = data?.daily?.precipitation_probability_max || [];
    const codes: number[] = data?.daily?.weathercode || [];

    if (dates.length === 0) throw new Error('Sin datos diarios');

    return dates.slice(0, 7).map((dateStr, idx) => {
      const d = new Date(`${dateStr}T12:00:00`);
      const dayName = DAY_NAMES_ES[d.getDay()] || `Día ${idx + 1}`;
      const rainProb = Math.round(rainProbs[idx] ?? 10);
      const mapped = mapWmoCodeToWeather(codes[idx] ?? 0, rainProb);

      return {
        date: dateStr,
        dayName,
        tempMin: Math.round(minTemps[idx] ?? 14),
        tempMax: Math.round(maxTemps[idx] ?? 24),
        rainProbability: rainProb,
        conditionLabel: mapped.label,
        icon: mapped.icon,
      };
    });
  } catch {
    // Pronóstico de respaldo para operación 100% offline
    const fallbackOrder = [
      { dayName: 'Lunes', min: 13, max: 24, rain: 10, label: 'Soleado y despejado', icon: 'sunny' as const },
      { dayName: 'Martes', min: 14, max: 25, rain: 15, label: 'Parcialmente nublado', icon: 'partly-sunny' as const },
      { dayName: 'Miércoles', min: 12, max: 21, rain: 60, label: 'Lluvia ligera por la tarde', icon: 'rainy' as const },
      { dayName: 'Jueves', min: 11, max: 20, rain: 30, label: 'Fresco y nublado', icon: 'cloudy' as const },
      { dayName: 'Viernes', min: 13, max: 24, rain: 10, label: 'Templado agradable', icon: 'sunny' as const },
      { dayName: 'Sábado', min: 15, max: 26, rain: 5, label: 'Soleado ideal para salir', icon: 'sunny' as const },
      { dayName: 'Domingo', min: 14, max: 23, rain: 20, label: 'Parcialmente soleado', icon: 'partly-sunny' as const },
    ];

    const today = new Date();
    return fallbackOrder.map((item, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return {
        date: d.toISOString().split('T')[0],
        dayName: item.dayName,
        tempMin: item.min,
        tempMax: item.max,
        rainProbability: item.rain,
        conditionLabel: item.label,
        icon: item.icon,
      };
    });
  }
}
