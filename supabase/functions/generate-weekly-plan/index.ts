// ============================================================================
// SUPABASE EDGE FUNCTION: generate-weekly-plan
// La llave CLAUDE_API_KEY vive exclusivamente en Supabase Secrets (Deno.env).
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      garments = [],
      profile = {},
      weatherForecast = [],
    } = await req.json();

    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY') || '';
    const claudeModel =
      Deno.env.get('CLAUDE_MODEL') || 'claude-haiku-4-5-20251001';

    if (!claudeApiKey) {
      return new Response(
        JSON.stringify({
          error:
            'Falta configurar el secret CLAUDE_API_KEY en Supabase Edge Functions',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanGarments = garments.filter(
      (g: any) => g.status === 'clean' && g.current_wears < g.max_wears_before_wash
    );

    const compactCatalog = cleanGarments.map((g: any) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      subcategory: g.subcategory,
      colors: g.colors,
      formality: g.formality,
      seasons: g.seasons,
      remainingWearsBeforeWash: g.max_wears_before_wash - g.current_wears,
    }));

    const systemPrompt = `Eres el estilista personal de IA de WearWise.
Tu objetivo es armar un plan de vestimenta semanal (Lunes a Domingo, 7 días) usando EXCLUSIVAMENTE los IDs de las prendas limpias disponibles en el catálogo proporcionado.

REGLAS ESTRICTAS:
1. Respeta el límite de usos restantes (remainingWearsBeforeWash) de cada prenda a lo largo de la semana: no asignes una prenda más veces en la semana de lo que su contador remainingWearsBeforeWash permite.
2. Ajusta cada outfit a la temperatura mínima/máxima y probabilidad de lluvia de ese día según weatherForecast.
3. Si el perfil está en modo "default", crea un balance versátil Smart Casual / Casual moderno. Si está en modo "custom", respeta estrictamente los arquetipos de estilo, colores preferidos, sensibilidad al clima y la actividad de cada día de la semana.
4. Cada día debe incluir al menos: 1 prenda superior ("top") y 1 inferior ("bottom") — o 1 "one_piece" — más calzado ("footwear") si existe en el catálogo, y "outerwear" si hace frío o llueve.
5. Responde ÚNICAMENTE con un JSON válido con este formato exacto:
{
  "claudeSummary": "Resumen general de la estrategia de estilo y clima para esta semana (2 oraciones)",
  "days": [
    {
      "dayIndex": 0,
      "dayName": "Lunes",
      "date": "YYYY-MM-DD",
      "occasion": "Actividad del día",
      "outfitTitle": "Nombre atractivo del look",
      "garmentIds": ["id-1", "id-2", "id-3"],
      "stylingTip": "Por qué funciona esta combinación y cómo llevarla",
      "weatherNote": "Nota sobre cómo este look responde al clima del día"
    }
  ]
}`;

    const userMessage = JSON.stringify({
      profileMode: profile.profileMode || 'default',
      userProfile: profile,
      weatherForecast7Days: weatherForecast,
      availableCleanGarments: compactCatalog,
    });

    const modelsToTry = [
      claudeModel,
      'claude-haiku-4-5-20251001',
      'claude-3-5-haiku-latest',
    ];

    let planResult = null;
    let lastError = '';

    for (const modelId of modelsToTry) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 2200,
          temperature: 0.4,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Genera el plan semanal de 7 outfits en JSON para estos datos:\n${userMessage}`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.content?.[0]?.text || '{}';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        planResult = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        break;
      } else {
        lastError = await response.text();
      }
    }

    if (!planResult) {
      return new Response(
        JSON.stringify({ error: `Error en Claude API: ${lastError}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(planResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
