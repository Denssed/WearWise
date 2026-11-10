// ============================================================================
// SUPABASE EDGE FUNCTION: analyze-garment
// Etiqueta una prenda con Claude Vision (solo análisis; el recorte de fondo vive en
// la función `remove-background`). CLAUDE_API_KEY está en Supabase Secrets.
//
// Seguridad:
//  - Requiere JWT válido; el usuario sale del token (nunca del body).
//  - Valida tipo y tamaño de la imagen.
//  - Cuota diaria por usuario (QUOTA_ANALYZE_PER_DAY, por defecto 20).
//  - La respuesta de Claude se sanea para cumplir los CHECK de la base de datos.
//
// Entrada: { imageBase64, mimeType }      Salida: { analysis }
// ============================================================================

import {
  authenticate,
  callClaudeJson,
  consumeQuota,
  envInt,
  errorResponse,
  jsonResponse,
  preflight,
  refundQuota,
} from '../_shared/common.ts';
import {
  ALLOWED_IMAGE_TYPES,
  base64ByteLength,
  sanitizeAnalysis,
} from '../_shared/pure.ts';

const SYSTEM_PROMPT = `Eres un experto estilista de moda y especialista en cuidado textil para la app WearWise.
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

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return errorResponse(req, 405, 'invalid_request', 'Método no permitido');

  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;
  const { userId, admin } = auth;

  let body: { imageBase64?: unknown; mimeType?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse(req, 400, 'invalid_request', 'JSON inválido');
  }

  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';
  if (typeof body.imageBase64 !== 'string' || !body.imageBase64) {
    return errorResponse(req, 400, 'invalid_request', 'Se requiere imageBase64');
  }
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return errorResponse(req, 400, 'invalid_request', 'Formato de imagen no soportado');
  }
  const cleanBase64 = body.imageBase64.replace(/^data:[\w/+.-]+;base64,/, '');
  const maxBytes = envInt('MAX_IMAGE_BYTES', 2_500_000);
  if (base64ByteLength(cleanBase64) > maxBytes) {
    return errorResponse(req, 413, 'image_too_large', 'La imagen es demasiado grande', { maxBytes });
  }

  const limit = envInt('QUOTA_ANALYZE_PER_DAY', 20);
  try {
    const quota = await consumeQuota(admin, userId, 'analyze', limit);
    if (!quota.allowed) {
      return errorResponse(req, 429, 'quota_exceeded', 'Alcanzaste el límite diario de análisis con IA', {
        limit,
      });
    }
  } catch (e) {
    console.error('Error consultando la cuota', e);
    return errorResponse(req, 500, 'server_error', 'No se pudo verificar tu uso diario');
  }

  const rawAnalysis = await callClaudeJson({
    system: SYSTEM_PROMPT,
    maxTokens: 600,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: cleanBase64 } },
          {
            type: 'text',
            text: 'Analiza esta prenda de ropa y devuelve el JSON con sus atributos y reglas de lavado.',
          },
        ],
      },
    ],
  });

  const analysis = sanitizeAnalysis(rawAnalysis);
  if (!analysis) {
    // Fallo del servicio, no del usuario: no se descuenta de su cuota.
    await refundQuota(admin, userId, 'analyze');
    return errorResponse(req, 502, 'ai_unavailable', 'El análisis con IA no está disponible ahora');
  }

  return jsonResponse(req, { analysis });
});
