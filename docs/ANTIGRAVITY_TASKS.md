# WearWise — Tareas de configuración para Antigravity

Este documento lista **todo lo que NO es código** y debe hacerse en paneles externos o con CLIs para que
lo implementado funcione. El código de cada fase ya está en el repo; aquí solo se ejecuta, configura y verifica.

- Proyecto Supabase: ref `gnhsmapjozmxpmhtudgx` (URL `https://gnhsmapjozmxpmhtudgx.supabase.co`)
- Bundle ID iOS / package Android: `com.denssed.wearwise`
- Deep link scheme: `wearwise`
- Sistema: Windows + PowerShell. Directorio del repo: `C:\Ps\WearWise`

## Reglas para el agente
1. **No modifiques código fuente** salvo que una tarea lo pida explícitamente. Si algo falla, repórtalo.
2. **Nunca escribas secretos en archivos del repo** ni en commits. Los secretos van solo a Supabase Secrets / EAS.
3. Si una tarea necesita una credencial que no tienes (Claude API key, Replicate token, cuenta Apple Developer,
   Google Cloud), **detente en ese paso y pídesela al usuario**. Marca la tarea como `BLOQUEADA`.
4. Al terminar cada tarea, ejecuta su **Verificación** y anota el resultado (OK / FALLÓ + salida).
5. Al final entrega el reporte con el formato de la sección *Reporte final*.

Leyenda: 🤖 = el agente puede hacerlo · 👤 = requiere al usuario (credenciales/cuentas/dispositivo físico).

---

## TAREA 0 — Preparar el entorno (Fases 0 y 1)

### 0.1 🤖 Dependencias y comprobaciones
```powershell
cd C:\Ps\WearWise
npm install --legacy-peer-deps
npm run typecheck
npm run lint
npm test
```
**Verificación:** los tres comandos terminan sin errores; `npm test` reporta 32 tests pasando (5 archivos).
> `--legacy-peer-deps` es necesario por conflictos de peer dependencies; no lo quites.

### 0.2 🤖 Archivo `.env`
Comprueba que existe `C:\Ps\WearWise\.env` (está en .gitignore) con:
```
EXPO_PUBLIC_SUPABASE_URL=https://gnhsmapjozmxpmhtudgx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key del proyecto>
```
Si falta, créalo copiando `.env.example` y pide al usuario la anon key (Supabase → Project Settings → API).
**Verificación:** `Get-Content .env` muestra ambas variables con valor.

### 0.3 🤖 Supabase CLI
```powershell
npx supabase --version
npx supabase login            # 👤 abre el navegador; el usuario debe autorizar
npx supabase link --project-ref gnhsmapjozmxpmhtudgx   # pedirá la contraseña de la base de datos (👤)
```
**Verificación:** `npx supabase projects list` muestra el proyecto con marca de "linked".

---

## TAREA 1 — Base de datos (Fases 1 y 2)

> Usa el **SQL Editor** del panel de Supabase (no `supabase db push`): los archivos `001`/`002` no están en
> formato timestamp y `001` no es idempotente.

### 1.1 🤖 Comprobar si 001 ya está aplicada
Ejecuta en SQL Editor:
```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('profiles','garments','weekly_plans','wear_logs');
```
- Si devuelve las 4 tablas → **omite** 001.
- Si no devuelve filas → ejecuta el contenido completo de `supabase/migrations/001_initial_schema.sql`.

### 1.2 🤖 Aplicar 002 (Fase 2)
Ejecuta el contenido completo de `supabase/migrations/002_security_and_quotas.sql` (es idempotente).

**Verificación (ejecuta y comprueba cada resultado):**
```sql
-- a) tabla de cuotas con RLS activada y sin políticas
select relrowsecurity from pg_class where oid = 'public.ai_usage'::regclass;           -- true
select count(*) from pg_policies where tablename = 'ai_usage';                          -- 0

-- b) funciones de cuota existen y solo service_role las ejecuta
select has_function_privilege('anon','public.consume_ai_quota(uuid,text,integer)','execute');          -- false
select has_function_privilege('authenticated','public.consume_ai_quota(uuid,text,integer)','execute'); -- false
select has_function_privilege('service_role','public.consume_ai_quota(uuid,text,integer)','execute');  -- true

-- c) políticas de storage (deben aparecer 4: lectura pública + 3 de carpeta propia)
select policyname from pg_policies where schemaname='storage' and tablename='objects' order by 1;
--   esperado: "Public read access for garment cutouts", "Users delete own files",
--             "Users update own files", "Users upload to own folder"
--   NO debe existir "Authenticated users upload garment cutouts"

-- d) límites del bucket
select file_size_limit, allowed_mime_types from storage.buckets where id = 'garments';  -- 5242880, {png,jpeg,webp}
```

### 1.3 🤖 Aplicar 003 (Fase 3)
Ejecuta el contenido completo de `supabase/migrations/003_garment_resilience.sql` (idempotente).
Debe aplicarse **antes** de probar la app: la app ya envía las columnas nuevas al guardar prendas.

**Verificación:**
```sql
-- a) columnas nuevas con sus restricciones
select column_name, column_default from information_schema.columns
where table_schema='public' and table_name='garments'
  and column_name in ('cutout_status','analysis_source');          -- 2 filas ('none' y 'manual')

-- b) la cuota admite el nuevo tipo 'cutout'
select pg_get_constraintdef(oid) from pg_constraint where conname = 'ai_usage_kind_check';
--   debe incluir 'analyze', 'plan' y 'cutout'
```

---

## TAREA 2 — Autenticación en el panel de Supabase (Fase 1)

### 2.1 🤖/👤 URLs de redirección
Panel → Authentication → URL Configuration → **Redirect URLs**, añadir:
- `wearwise://auth-callback`
- `exp://**` (solo para pruebas con Expo Go; quitar antes de producción)

### 2.2 🤖/👤 Email
Authentication → Providers → Email: **Enable Email provider = ON**, **Confirm email = ON**,
longitud mínima de contraseña = 8.
(Producción: configurar SMTP propio en Authentication → SMTP Settings; el SMTP por defecto tiene límites muy bajos.)

### 2.3 👤 Google
1. Google Cloud Console → APIs y servicios → Pantalla de consentimiento OAuth (configurar si no existe).
2. Credenciales → Crear **ID de cliente OAuth** tipo **Aplicación web**.
3. **URI de redirección autorizado:** `https://gnhsmapjozmxpmhtudgx.supabase.co/auth/v1/callback`
4. Copiar Client ID y Client Secret → Supabase → Authentication → Providers → Google → activar y pegar.

### 2.4 👤 Apple (solo iOS; requiere cuenta Apple Developer de pago)
1. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → App ID `com.denssed.wearwise`
   → activar capacidad **Sign In with Apple**.
2. Supabase → Authentication → Providers → Apple → activar y, en **Client IDs**, escribir `com.denssed.wearwise`.
   (El login es nativo: el `id_token` trae ese bundle ID como `aud`; no hace falta Services ID ni clave .p8
   para el login nativo.)

**Verificación de toda la tarea 2:** Authentication → Providers muestra Email, Google y Apple en "Enabled".

---

## TAREA 3 — Edge Functions: secretos y despliegue (Fases 1 y 2)

### 3.1 👤 Secretos (el agente debe pedir los valores al usuario; no inventarlos)
```powershell
cd C:\Ps\WearWise
npx supabase secrets set CLAUDE_API_KEY=<valor del usuario>          # obligatorio
npx supabase secrets set REPLICATE_API_TOKEN=<valor del usuario>     # opcional (sin él no se quita el fondo)
npx supabase secrets set CLAUDE_MODEL=claude-haiku-5-5
npx supabase secrets set QUOTA_ANALYZE_PER_DAY=20
npx supabase secrets set QUOTA_PLAN_PER_DAY=3
npx supabase secrets set QUOTA_CUTOUT_PER_DAY=30
npx supabase secrets set MAX_IMAGE_BYTES=2500000
```
No definas `ALLOWED_ORIGINS` salvo que exista un cliente web. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
los inyecta Supabase automáticamente (no los configures).

**Verificación:** `npx supabase secrets list` muestra `CLAUDE_API_KEY`, `CLAUDE_MODEL`, `QUOTA_ANALYZE_PER_DAY`,
`QUOTA_PLAN_PER_DAY`, `MAX_IMAGE_BYTES` (y `REPLICATE_API_TOKEN` si se dio). Los valores salen como hash; no se leen.

### 3.2 🤖 Desplegar funciones
```powershell
npx supabase functions deploy analyze-garment
npx supabase functions deploy remove-background
npx supabase functions deploy generate-weekly-plan
npx supabase functions deploy delete-account
```
> `process-garment` (Fase 2) fue reemplazada en la Fase 3 por `analyze-garment` + `remove-background`.
> Si estaba desplegada, bórrala: `npx supabase functions delete process-garment`.

**Verificación:** `npx supabase functions list` muestra las 4 funciones con estado `ACTIVE` y `process-garment` ya no aparece.
Si el despliegue falla por resolver `../_shared/...`, ejecútalo desde `C:\Ps\WearWise` (raíz del proyecto, donde está la carpeta `supabase`).

---

## TAREA 4 — Pruebas de humo del backend (Fase 2)

Variables para los comandos (rellena con valores reales; **no los guardes en archivos**):
```powershell
$ref  = "gnhsmapjozmxpmhtudgx"
$base = "https://$ref.supabase.co"
$anon = "<anon key>"
```

### 4.1 🤖 Sin sesión → 401
```powershell
try {
  Invoke-RestMethod -Method Post -Uri "$base/functions/v1/analyze-garment" `
    -Headers @{ apikey=$anon; Authorization="Bearer $anon" } -ContentType 'application/json' -Body '{}'
} catch { $_.Exception.Response.StatusCode.value__; $_.ErrorDetails.Message }
```
**Esperado:** `401` y `"code":"unauthorized"` (la anon key no es un JWT de usuario).

### 4.2 👤+🤖 Crear usuario de prueba y obtener su token
Crea en Supabase → Authentication → Users un usuario `test+wearwise@<dominio>` con contraseña y email confirmado, luego:
```powershell
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/v1/token?grant_type=password" `
  -Headers @{ apikey=$anon } -ContentType 'application/json' `
  -Body (@{ email="<email de prueba>"; password="<password de prueba>" } | ConvertTo-Json)
$jwt = $login.access_token
$uid = $login.user.id
```

### 4.3 🤖 Validaciones de entrada (con sesión)
```powershell
$h = @{ apikey=$anon; Authorization="Bearer $jwt" }
# cuerpo sin imagen → 400 invalid_request
try { Invoke-RestMethod -Method Post -Uri "$base/functions/v1/analyze-garment" -Headers $h -ContentType 'application/json' -Body '{}' } catch { $_.ErrorDetails.Message }
# formato no soportado → 400
try { Invoke-RestMethod -Method Post -Uri "$base/functions/v1/analyze-garment" -Headers $h -ContentType 'application/json' -Body '{"imageBase64":"QUJD","mimeType":"application/pdf"}' } catch { $_.ErrorDetails.Message }
```
**Esperado:** ambos `400` con `"code":"invalid_request"`.

### 4.4 🤖 Cuota diaria (429)
1. Baja temporalmente el límite: `npx supabase secrets set QUOTA_ANALYZE_PER_DAY=1`
   (la función lee el secreto en cada arranque; espera ~30 s o redespliega `analyze-garment`).
2. Usa una imagen JPEG pequeña real en base64 (≤ 200 KB) y llama dos veces a `analyze-garment`.
3. **Esperado:** la 1.ª devuelve 200 (o 502 `ai_unavailable` si falta CLAUDE_API_KEY → en ese caso la cuota
   se devuelve); la 2.ª devuelve `429 quota_exceeded` solo si la 1.ª fue 200.
4. Comprueba en SQL: `select * from public.ai_usage;` → `count` nunca supera 1.
5. **Restaura:** `npx supabase secrets set QUOTA_ANALYZE_PER_DAY=20` y borra la fila de prueba:
   `delete from public.ai_usage where user_id = '<uid>';`

### 4.5 🤖 Storage: no se puede escribir en la carpeta de otro usuario
```powershell
$otro = "00000000-0000-4000-8000-000000000000"
try {
  Invoke-RestMethod -Method Post -Uri "$base/storage/v1/object/garments/$otro/x.png" `
    -Headers @{ apikey=$anon; Authorization="Bearer $jwt" } -ContentType 'image/png' -Body ([byte[]](137,80,78,71))
} catch { $_.Exception.Response.StatusCode.value__ }
```
**Esperado:** `400/403` (violación de política RLS). Luego repite con `$uid` en lugar de `$otro`: debe aceptarse
(o fallar por tipo/tamaño, nunca por política). Borra el archivo de prueba después.

### 4.6 🤖 Eliminar cuenta
Crea un segundo usuario de prueba, obtén su JWT (`$jwt2`) y ejecuta:
```powershell
Invoke-RestMethod -Method Post -Uri "$base/functions/v1/delete-account" -Headers @{ apikey=$anon; Authorization="Bearer $jwt2" }
```
**Esperado:** `{"ok":true}`; el usuario desaparece de Authentication → Users y sus filas de `garments`,
`profiles`, `weekly_plans`, `ai_usage` quedan eliminadas:
```sql
select count(*) from public.profiles where id = '<uid2>';   -- 0
```

### 4.7 🤖 Limpieza
Elimina los usuarios de prueba (o consérvalos si el usuario lo pide) y confirma que
`QUOTA_ANALYZE_PER_DAY` quedó en `20`.

---

## TAREA 5 — Ejecutar la app y probar el flujo de login (Fase 1)

### 5.1 🤖 Arrancar en desarrollo
```powershell
cd C:\Ps\WearWise
npx expo start
```
- **Email/contraseña, recuperación de contraseña y confirmación de correo** se pueden probar en Expo Go o emulador.
- **Google** funciona en un development build; en Expo Go requiere `exp://**` en las Redirect URLs (tarea 2.1).
- **Apple** solo funciona en un **development build en iPhone físico/simulador** (👤 requiere cuenta Apple Developer).

### 5.2 👤 Development build (necesario para Apple y para pruebas reales de deep links)
```powershell
npx eas login
npx eas build --profile development --platform android     # APK
npx eas build --profile development --platform ios         # requiere credenciales Apple
```
Define las variables en EAS para los builds:
```powershell
npx eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://gnhsmapjozmxpmhtudgx.supabase.co --environment development --visibility plaintext
npx eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --environment development --visibility plaintext
```
(Repite con `--environment preview` y `--environment production`.)

### 5.3 👤 Checklist manual en el dispositivo
- [ ] Registro con email → llega correo de confirmación → el enlace abre la app y entra sesión.
- [ ] Iniciar sesión / cerrar sesión desde Perfil.
- [ ] "¿Olvidaste tu contraseña?" → correo → enlace abre la pantalla "Nueva contraseña" → entra con la nueva.
- [ ] Continuar con Google crea la sesión y el perfil muestra el nombre de Google.
- [ ] (iOS) Continuar con Apple crea la sesión.
- [ ] Un usuario nuevo ve el armario **vacío** (sin prendas de demostración).
- [ ] Dos cuentas distintas en el mismo dispositivo no comparten prendas.
- [ ] Agregar una prenda y comprobar en Supabase → Table Editor → `garments` que aparece con el `user_id` correcto.
- [ ] Perfil → "Eliminar mi cuenta" borra la cuenta y regresa al login.

---

## TAREA 6 — Agregar prenda resiliente (Fase 3)

Requisitos previos: tareas 1.3 (migración 003) y 3.2 (funciones `analyze-garment` y `remove-background` desplegadas),
y `REPLICATE_API_TOKEN` configurado si se quiere probar el recorte real.

### 6.1 🤖 `remove-background` sin sesión y con rutas inválidas
Reutiliza `$base`, `$anon`, `$jwt`, `$uid` de la tarea 4.
```powershell
# sin sesión → 401
try { Invoke-RestMethod -Method Post -Uri "$base/functions/v1/remove-background" -Headers @{ apikey=$anon; Authorization="Bearer $anon" } -ContentType 'application/json' -Body '{"path":"x"}' } catch { $_.ErrorDetails.Message }
$h = @{ apikey=$anon; Authorization="Bearer $jwt" }
# ruta de OTRO usuario → 400 invalid_request
try { Invoke-RestMethod -Method Post -Uri "$base/functions/v1/remove-background" -Headers $h -ContentType 'application/json' -Body '{"path":"00000000-0000-4000-8000-000000000000/a.jpg"}' } catch { $_.ErrorDetails.Message }
# recorrido de directorio → 400
try { Invoke-RestMethod -Method Post -Uri "$base/functions/v1/remove-background" -Headers $h -ContentType 'application/json' -Body ("{`"path`":`"$uid/../x.jpg`"}") } catch { $_.ErrorDetails.Message }
# ruta propia pero archivo inexistente → 404
try { Invoke-RestMethod -Method Post -Uri "$base/functions/v1/remove-background" -Headers $h -ContentType 'application/json' -Body ("{`"path`":`"$uid/no-existe.jpg`"}") } catch { $_.Exception.Response.StatusCode.value__ }
```
**Esperado:** `401 unauthorized`, `400 invalid_request`, `400 invalid_request`, `404`.

### 6.2 🤖 Recorte real (si hay token de Replicate)
1. Sube un JPEG real a tu carpeta: `POST $base/storage/v1/object/garments/$uid/original-test.jpg`
   (cabeceras `apikey`, `Authorization: Bearer $jwt`, `Content-Type: image/jpeg`).
2. Llama `remove-background` con `{"path":"<uid>/original-test.jpg"}`.
3. **Esperado:** `200` con `cutoutImageUrl` apuntando a `.../garments/<uid>/cutout-<uuid>.png`; la URL abre un PNG con transparencia.
4. Sin `REPLICATE_API_TOKEN` el esperado es `503` con `"code":"ai_unavailable"`, y `ai_usage.count` de `kind='cutout'` no sube (se devolvió la cuota).
5. Limpieza: borra los archivos de prueba del bucket.

### 6.3 🤖 Cuota de recortes
Con `QUOTA_CUTOUT_PER_DAY=1` temporal, dos recortes exitosos seguidos → el segundo devuelve `429 quota_exceeded`.
Restaura `QUOTA_CUTOUT_PER_DAY=30` al terminar y borra las filas de prueba de `ai_usage`.

### 6.4 👤 Checklist manual en el dispositivo (development build)
- [ ] **Sin IA:** activar "Llenar los datos a mano", elegir foto → aparece el formulario vacío con valores sugeridos por categoría; guardar crea la prenda.
- [ ] **Con IA disponible:** elegir foto → el formulario llega prellenado y la etiqueta dice "Datos sugeridos por IA (revísalos)".
- [ ] **IA caída:** apagar `CLAUDE_API_KEY` (o desplegar sin secreto) → aparece el aviso "No se pudo agregar con IA ahora; completa los datos manualmente." y la prenda se puede guardar igual.
- [ ] **Sin internet:** con modo avión, agregar una prenda → se guarda; al recuperar conexión y reabrir la app, la foto se sube a Storage y `garments.original_image_url` pasa a ser una URL `https://...` (comprobar en Table Editor).
- [ ] Con "Quitar el fondo" activado la tarjeta muestra "Fondo en cola" y, cuando el servicio responde, la imagen pasa a PNG sin fondo (`cutout_status = done` en la tabla).
- [ ] Con Replicate caído, la prenda sigue usable con la foto original y queda `pending`; al abrir la app más tarde se reintenta sola.
- [ ] Tocar una prenda del armario abre "Editar prenda": cambiar nombre/temporadas/formalidad, guardar, y ver el cambio en `garments`.
- [ ] En "Editar prenda", el botón "Reintentar quitar el fondo" muestra un aviso claro si falla.
- [ ] Un armario nuevo muestra el estado vacío con el botón "Agregar prenda".

---

## Reporte final (el agente debe entregarlo)
Entrega una tabla con una fila por tarea:

| Tarea | Estado (OK / FALLÓ / BLOQUEADA) | Evidencia (salida resumida) | Notas |
|---|---|---|---|

Incluye además: versión de CLI usada, fecha/hora, y cualquier desviación respecto a este documento.
**No incluyas** secretos, tokens ni contraseñas en el reporte.

---

## Registro por fase (se amplía en cada fase)
| Fase | Estado del código | Tareas externas de este documento |
|---|---|---|
| 0 — Base y orden | Hecha | 0.1, 0.2 |
| 1 — Autenticación | Hecha | 0.3, 2.1–2.4, 3.1–3.2 (delete-account), 5.x |
| 2 — Seguridad backend | Hecha | 1.1–1.2, 3.1–3.2, 4.x |
| 3 — Agregar prenda resiliente | Hecha | 1.3, 3.1 (`QUOTA_CUTOUT_PER_DAY`), 3.2 (`analyze-garment`, `remove-background`), 6.x |
| 4 — Plan local de bajo costo | Pendiente | (se añadirá) |
| 5 — Sincronización | Pendiente | (se añadirá) |
| 6 — Preparación para tiendas | Pendiente | (se añadirá) |
