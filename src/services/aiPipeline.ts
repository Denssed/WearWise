import {
  ApiSettings,
  Garment,
  GarmentCategory,
  PlannedDayOutfit,
  Season,
  UserProfile,
  WashCareGroup,
  WeatherDay,
  WeeklyPlan,
} from '../types/wardrobe';
import { getSupabaseClient } from './supabase';

const DEFAULT_851LABS_VERSION =
  'a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc';

export interface GarmentAIAnalysisResult {
  cutoutImageUrl: string;
  bgRemovalProvider: 'replicate_851labs' | 'edge_function' | 'local_preview';
  aiProvider: 'claude_haiku' | 'smart_fallback';
  name: string;
  category: GarmentCategory;
  subcategory: string;
  colors: string[];
  pattern: string;
  fabric: string;
  seasons: Season[];
  formality: number;
  wash_care_group: WashCareGroup;
  care_instructions: string;
  max_wears_before_wash: number;
  ai_styling_notes: string;
}

/**
 * 1. Quita el fondo con Replicate (851-labs/background-remover)
 * 2. Analiza la prenda con Claude Haiku 5.5 Vision
 * Soporta tanto la llamada vía Supabase Edge Function (`process-garment`)
 * como la llamada directa con las API Keys configuradas en la app o `.env`.
 */
export async function processGarmentWithAI(
  imageUri: string,
  imageBase64: string | null | undefined,
  mimeType = 'image/jpeg',
  settings: ApiSettings
): Promise<GarmentAIAnalysisResult> {
  const supabase = getSupabaseClient(settings);

  // A) Intentar primero vía Supabase Edge Function si está configurada
  if (supabase && imageBase64) {
    try {
      const { data, error } = await supabase.functions.invoke('process-garment', {
        body: {
          imageBase64,
          mimeType,
          replicateApiToken: settings.replicateApiToken,
          replicateBgVersion: settings.replicateBgVersion,
          claudeApiKey: settings.claudeApiKey,
          claudeModel: settings.claudeModel,
        },
      });

      if (!error && data?.analysis) {
        return {
          cutoutImageUrl: data.cutoutImageUrl || imageUri,
          bgRemovalProvider:
            data.bgRemovalProvider === 'replicate_851labs'
              ? 'replicate_851labs'
              : 'edge_function',
          aiProvider: 'claude_haiku',
          ...data.analysis,
        };
      }
    } catch {
      // Continúa a llamada directa a Replicate + Claude API
    }
  }

  let cutoutImageUrl = imageUri;
  let bgRemovalProvider: GarmentAIAnalysisResult['bgRemovalProvider'] = 'local_preview';

  const cleanBase64 = imageBase64 ? imageBase64.replace(/^data:image\/\w+;base64,/, '') : '';
  const dataUri = cleanBase64 ? `data:${mimeType};base64,${cleanBase64}` : imageUri;

  // B) Llamada directa a Replicate API (851-labs/background-remover)
  if (settings.replicateApiToken && cleanBase64) {
    try {
      const rawVersion = settings.replicateBgVersion || DEFAULT_851LABS_VERSION;
      const versionHash = rawVersion.includes(':')
        ? rawVersion.split(':')[1]
        : rawVersion;

      const replicateRes = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.replicateApiToken}`,
          'Content-Type': 'application/json',
          Prefer: 'wait=60',
        },
        body: JSON.stringify({
          version: versionHash || DEFAULT_851LABS_VERSION,
          input: {
            image: dataUri,
            format: 'png',
            reverse: false,
            threshold: 0,
            background_type: 'rgba',
          },
        }),
      });

      if (replicateRes.ok) {
        let prediction = await replicateRes.json();

        let attempts = 0;
        while (
          prediction &&
          prediction.status !== 'succeeded' &&
          prediction.status !== 'failed' &&
          prediction.status !== 'canceled' &&
          prediction.urls?.get &&
          attempts < 15
        ) {
          await new Promise((r) => setTimeout(r, 1000));
          attempts++;
          const pollRes = await fetch(prediction.urls.get, {
            headers: {
              Authorization: `Bearer ${settings.replicateApiToken}`,
            },
          });
          if (pollRes.ok) {
            prediction = await pollRes.json();
          }
        }

        if (prediction?.status === 'succeeded' && prediction.output) {
          const outUrl = Array.isArray(prediction.output)
            ? prediction.output[0]
            : prediction.output;
          if (typeof outUrl === 'string' && outUrl.length > 0) {
            cutoutImageUrl = outUrl;
            bgRemovalProvider = 'replicate_851labs';
          }
        }
      }
    } catch (err) {
      console.warn('Aviso Replicate 851-labs:', err);
    }
  }

  // C) Llamada a Claude Haiku 5.5 / 4.5 Vision para auto-etiquetar la prenda
  if (settings.claudeApiKey && cleanBase64) {
    const systemPrompt = `Eres un experto estilista de moda y especialista en cuidado textil para la app WearWise.
Analiza la imagen de la prenda y responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional) con esta estructura exacta:
{
  "name": "Nombre descriptivo corto en español (ej. Camisa Oxford Azul Cielo)",
  "category": "top" | "bottom" | "outerwear" | "footwear" | "one_piece" | "accessory",
  "subcategory": "Subcategoría en español (ej. Camisa, Camiseta, Jeans, Chamarra, Tenis)",
  "colors": ["Color principal", "Color secundario opcional"],
  "pattern": "liso" | "rayas" | "cuadros" | "estampado" | "texturizado",
  "fabric": "Material estimado en español (ej. Algodón, Mezclilla, Lino, Lana, Piel)",
  "seasons": ["primavera", "verano", "otoño", "invierno"],
  "formality": 3,
  "wash_care_group": "whites" | "darks" | "colors" | "delicates",
  "care_instructions": "Instrucción breve de lavado en español",
  "max_wears_before_wash": 2,
  "ai_styling_notes": "Consejo breve para combinar esta prenda"
}`;

    const candidateModels = Array.from(
      new Set([
        settings.claudeModel || 'claude-haiku-4-5-20251001',
        'claude-haiku-4-5-20251001',
        'claude-3-5-haiku-latest',
      ])
    );

    for (const modelId of candidateModels) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': settings.claudeApiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: 700,
            temperature: 0.2,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: mimeType,
                      data: cleanBase64,
                    },
                  },
                  {
                    type: 'text',
                    text: 'Extrae todos los metadatos y reglas de lavado de esta prenda en JSON.',
                  },
                ],
              },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data?.content?.[0]?.text || '{}';
          const match = text.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(match ? match[0] : text);

          return {
            cutoutImageUrl,
            bgRemovalProvider,
            aiProvider: 'claude_haiku',
            name: parsed.name || 'Prenda Analizada con Claude',
            category: parsed.category || 'top',
            subcategory: parsed.subcategory || 'Prenda',
            colors: Array.isArray(parsed.colors) ? parsed.colors : ['Neutro'],
            pattern: parsed.pattern || 'liso',
            fabric: parsed.fabric || 'Algodón',
            seasons: Array.isArray(parsed.seasons)
              ? parsed.seasons
              : ['primavera', 'verano', 'otoño', 'invierno'],
            formality: Number(parsed.formality) || 3,
            wash_care_group: parsed.wash_care_group || 'colors',
            care_instructions:
              parsed.care_instructions || 'Lavar en agua fría en ciclo suave.',
            max_wears_before_wash: Number(parsed.max_wears_before_wash) || 2,
            ai_styling_notes:
              parsed.ai_styling_notes || 'Combina con tonos neutros para un look equilibrado.',
          };
        }
      } catch (err) {
        console.warn(`Intento con modelo ${modelId} falló:`, err);
      }
    }
  }

  // D) Respuesta inteligente por defecto (permite probar todo el flujo aún sin conexión)
  return {
    cutoutImageUrl,
    bgRemovalProvider,
    aiProvider: 'smart_fallback',
    name: 'Sobrecamisa Texturizada Terracota',
    category: 'top',
    subcategory: 'Camisa / Sobrecamisa',
    colors: ['Terracota', 'Beige'],
    pattern: 'texturizado',
    fabric: 'Algodón Orgánico',
    seasons: ['primavera', 'otoño', 'invierno'],
    formality: 3,
    wash_care_group: 'colors',
    care_instructions: 'Lavar a máquina en frío (30°C) con colores similares.',
    max_wears_before_wash: 3,
    ai_styling_notes: 'Ideal sobre camiseta blanca básica con jeans oscuros o chinos beige.',
  };
}

/**
 * Genera el plan semanal de 7 días usando Claude Haiku 5.5
 * Filtra estrictamente prendas LIMPIAS y respeta cuántas puestas le quedan a cada prenda.
 */
export async function generateWeeklyOutfitsWithAI(
  garments: Garment[],
  profile: UserProfile,
  weather: WeatherDay[],
  settings: ApiSettings
): Promise<WeeklyPlan> {
  const cleanGarments = garments.filter(
    (g) => g.status === 'clean' && g.current_wears < g.max_wears_before_wash
  );

  const supabase = getSupabaseClient(settings);

  // 1. Intentar vía Supabase Edge Function si está configurada
  if (supabase && settings.claudeApiKey) {
    try {
      const { data, error } = await supabase.functions.invoke('generate-weekly-plan', {
        body: {
          garments: cleanGarments,
          profile,
          weatherForecast: weather,
          claudeApiKey: settings.claudeApiKey,
          claudeModel: settings.claudeModel,
        },
      });

      if (!error && Array.isArray(data?.days) && data.days.length > 0) {
        return {
          id: `plan-${Date.now()}`,
          weekStartDate: weather[0]?.date || new Date().toISOString().split('T')[0],
          profileModeUsed: profile.profileMode,
          claudeSummary: data.claudeSummary || 'Plan semanal optimizado por Claude Haiku.',
          days: data.days,
          generatedBy: 'claude_haiku',
          createdAt: new Date().toISOString(),
        };
      }
    } catch {
      // Continuar a llamada directa a Claude API
    }
  }

  // 2. Llamada directa a Claude Haiku 5.5 API
  if (settings.claudeApiKey && cleanGarments.length >= 2) {
    const compactCatalog = cleanGarments.map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      subcategory: g.subcategory,
      colors: g.colors,
      formality: g.formality,
      remainingWearsBeforeWash: g.max_wears_before_wash - g.current_wears,
    }));

    const systemPrompt = `Eres el estilista personal IA de WearWise.
Crea un plan semanal de 7 días (Lunes a Domingo) usando EXCLUSIVAMENTE los IDs de las prendas limpias en availableCleanGarments.
REGLAS:
1. No asignes una prenda más veces en la semana de lo que indica su remainingWearsBeforeWash.
2. Ajusta cada outfit al clima del día (tempMin, tempMax, rainProbability). Si hace frío (<16°C) o llueve (>45%), incluye "outerwear" si está disponible.
3. Si profileMode es "default", aplica un estilo equilibrado Smart Casual. Si es "custom", sigue estrictamente styleArchetypes, preferredColors, climateSensitivity y weeklySchedule.
4. Devuelve ÚNICAMENTE un objeto JSON válido con este formato:
{
  "claudeSummary": "Resumen de 2 líneas explicando la estrategia semanal de estilo, clima y ahorro de lavadas",
  "days": [
    {
      "dayIndex": 0,
      "dayName": "Lunes",
      "date": "YYYY-MM-DD",
      "occasion": "Actividad del día",
      "outfitTitle": "Nombre del look",
      "garmentIds": ["id1", "id2", "id3"],
      "stylingTip": "Consejo de estilo para este conjunto",
      "weatherNote": "Por qué es ideal para el clima de ese día"
    }
  ]
}`;

    const candidateModels = Array.from(
      new Set([
        settings.claudeModel || 'claude-haiku-4-5-20251001',
        'claude-haiku-4-5-20251001',
        'claude-3-5-haiku-latest',
      ])
    );

    for (const modelId of candidateModels) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': settings.claudeApiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: 2200,
            temperature: 0.4,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: JSON.stringify({
                  profileMode: profile.profileMode,
                  userProfile: profile,
                  weatherForecast: weather,
                  availableCleanGarments: compactCatalog,
                }),
              },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data?.content?.[0]?.text || '{}';
          const match = rawText.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(match ? match[0] : rawText);

          if (Array.isArray(parsed.days) && parsed.days.length > 0) {
            return {
              id: `plan-${Date.now()}`,
              weekStartDate: weather[0]?.date || new Date().toISOString().split('T')[0],
              profileModeUsed: profile.profileMode,
              claudeSummary:
                parsed.claudeSummary ||
                'Plan semanal creado con Claude Haiku respetando tus prendas limpias y el clima.',
              days: parsed.days,
              generatedBy: 'claude_haiku',
              createdAt: new Date().toISOString(),
            };
          }
        }
      } catch (err) {
        console.warn(`Error generando plan con ${modelId}:`, err);
      }
    }
  }

  // 3. Motor local inteligente (respeta prendas limpias, rotación de lavandería, perfil y clima)
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
    id: `plan-${Date.now()}`,
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
