# Backend: despliegue y secretos (Fase 2)

## 1. Migración SQL
En Supabase → SQL Editor ejecuta `supabase/migrations/002_security_and_quotas.sql`
(después de `001`). Es idempotente. Crea la tabla `ai_usage` y las funciones de cuota
(solo ejecutables por `service_role`), restringe Storage a la carpeta de cada usuario y
limita el bucket a imágenes ≤ 5 MB.

## 2. Secretos de las Edge Functions
```
supabase secrets set CLAUDE_API_KEY=...        # obligatorio
supabase secrets set REPLICATE_API_TOKEN=...   # opcional: sin él no se quita el fondo
supabase secrets set CLAUDE_MODEL=claude-haiku-5-5            # opcional
supabase secrets set QUOTA_ANALYZE_PER_DAY=20                 # opcional (defecto 20)
supabase secrets set QUOTA_PLAN_PER_DAY=3                     # opcional (defecto 3)
supabase secrets set MAX_IMAGE_BYTES=2500000                  # opcional
supabase secrets set ALLOWED_ORIGINS=https://tu-dominio.com   # opcional, solo si hay cliente web
```
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente.

## 3. Despliegue
```
supabase functions deploy analyze-garment
supabase functions deploy remove-background
supabase functions deploy generate-weekly-plan
supabase functions deploy delete-account
```
Las funciones validan el JWT en el código (`_shared/common.ts`), así que funcionan igual
con la verificación del gateway activada o desactivada.

## 4. Códigos de error que devuelven las funciones
| HTTP | `code` | Significado |
|---|---|---|
| 401 | `unauthorized` | Sin sesión o token inválido |
| 400 | `invalid_request` | Cuerpo o formato de imagen inválido |
| 413 | `image_too_large` | Imagen sobre `MAX_IMAGE_BYTES` |
| 429 | `quota_exceeded` | Límite diario alcanzado |
| 502 | `ai_unavailable` | La IA falló (la cuota se devuelve al usuario) |

## 5. Pruebas manuales recomendadas tras desplegar
- Llamada sin `Authorization` → 401.
- Llamar `analyze-garment` más veces que la cuota → 429 y la fila en `ai_usage` no pasa del límite.
- Con un usuario autenticado, subir un archivo a `garments/<otro-uid>/x.png` → debe fallar.
