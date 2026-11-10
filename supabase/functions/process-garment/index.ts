// ============================================================================
// SUPABASE EDGE FUNCTION: process-garment
// 1. Recibe la imagen de la prenda (base64 o data URI)
// 2. Llama a Replicate (modelo 851-labs/background-remover) para quitar el fondo
// 3. Llama a Claude Haiku 5.5 Vision para auto-etiquetar categoría, color,
//    tela, grupo de lavado y máximo de puestas antes de lavar.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-replicate-token, x-claude-key',
};

const DEFAULT_851LABS_VERSION =
  'a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc';

interface ProcessGarmentRequest {
  imageBase64: string;
  mimeType?: string;
  replicateApiToken?: string;
  replicateBgVersion?: string;
  claudeApiKey?: string;
  claudeModel?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: ProcessGarmentRequest = await req.json();
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      replicateApiToken =
        Deno.env.get('REPLICATE_API_TOKEN') ||
        req.headers.get('x-replicate-token') ||
        '',
      replicateBgVersion =
        Deno.env.get('REPLICATE_BG_VERSION') || DEFAULT_851LABS_VERSION,
      claudeApiKey =
        Deno.env.get('CLAUDE_API_KEY') || req.headers.get('x-claude-key') || '',
      claudeModel = Deno.env.get('CLAUDE_MODEL') || 'claude-haiku-4-5-20251001',
    } = body;

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'Se requiere imageBase64' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const dataUri = `data:${mimeType};base64,${cleanBase64}`;

    // ------------------------------------------------------------------------
    // PASO 1: Quitar el fondo con Replicate (851-labs/background-remover)
    // Usa el header Prefer: wait=60 para respuesta síncrona rápida (~1 seg)
    // y hace polling automático si la predicción sigue en curso.
    // ------------------------------------------------------------------------
    let cutoutImageUrl = dataUri;
    let bgRemovalProvider = 'original_fallback';

    if (replicateApiToken) {
      try {
        const versionHash = replicateBgVersion.includes(':')
          ? replicateBgVersion.split(':')[1]
          : replicateBgVersion;

        const createRes = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${replicateApiToken}`,
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

        if (createRes.ok) {
          let prediction = await createRes.json();

          // Si aún no terminó con Prefer: wait, hacer polling corto en urls.get
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
                Authorization: `Bearer ${replicateApiToken}`,
              },
            });
            if (pollRes.ok) {
              prediction = await pollRes.json();
            }
          }

          if (prediction?.status === 'succeeded' && prediction.output) {
            const outputUrl = Array.isArray(prediction.output)
              ? prediction.output[0]
              : prediction.output;
            if (typeof outputUrl === 'string' && outputUrl.length > 0) {
              cutoutImageUrl = outputUrl;
              bgRemovalProvider = 'replicate_851labs';
            }
          }
        }
      } catch (err) {
        console.warn(
          'Replicate 851-labs warning (usando imagen original como respaldo):',
          err
        );
      }
    }

    // ------------------------------------------------------------------------
    // PASO 2: Auto-etiquetado inteligente con Claude Haiku Vision
    // ------------------------------------------------------------------------
    if (!claudeApiKey) {
      return new Response(
        JSON.stringify({
          error: 'Falta CLAUDE_API_KEY para analizar la prenda',
          cutoutImageUrl,
          bgRemovalProvider,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Eres un experto estilista de moda y especialista en cuidado textil para la app WearWise.
Analiza la foto de la prenda y responde ÚNICAMENTE con un objeto JSON válido (sin bloques markdown ni texto adicional) con esta estructura exacta:
{
  "name": "Nombre descriptivo corto en español (ej. Camisa Oxford Azul Claro)",
  "category": "top" | "bottom" | "outerwear" | "footwear" | "one_piece" | "accessory",
  "subcategory": "Subcategoría en español (ej. Camisa, Camiseta, Jeans, Chamarra, Tenis, Vestido)",
  "colors": ["color principal en español", "color secundario opcional"],
  "pattern": "liso" | "rayas" | "cuadros" | "estampado" | "texturizado",
  "fabric": "Material estimado en español (ej. Algodón, Mezclilla, Lino, Lana, Sintético, Cuero)",
  "seasons": ["primavera", "verano", "otoño", "invierno"],
  "formality": número entero del 1 (muy casual/deportivo) al 5 (formal/etiqueta),
  "wash_care_group": "whites" | "darks" | "colors" | "delicates",
  "care_instructions": "Consejo breve de lavado en español (ej. Lavar en frío con colores oscuros, no usar secadora)",
  "max_wears_before_wash": número entero recomendado de usos antes de lavar (ej. 1 para camisetas/deportiva, 2-3 para camisas/blusas, 4-5 para jeans/pantalones, 10 para chamarras/abrigos/calzado),
  "ai_styling_notes": "Consejo breve de cómo combinar esta prenda (máximo 140 caracteres)"
}`;

    const modelsToTry = [
      claudeModel,
      'claude-haiku-4-5-20251001',
      'claude-3-5-haiku-latest',
    ];

    let claudeAnalysis = null;
    let lastError = '';

    for (const modelId of modelsToTry) {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
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
                  text: 'Analiza esta prenda de ropa y devuelve el JSON con sus atributos y reglas de lavado.',
                },
              ],
            },
          ],
        }),
      });

      if (claudeRes.ok) {
        const data = await claudeRes.json();
        const rawText = data?.content?.[0]?.text || '{}';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        claudeAnalysis = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        break;
      } else {
        lastError = await claudeRes.text();
      }
    }

    if (!claudeAnalysis) {
      return new Response(
        JSON.stringify({ error: `Error en Claude API: ${lastError}`, cutoutImageUrl }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        cutoutImageUrl,
        bgRemovalProvider,
        analysis: claudeAnalysis,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
