# Checklist de Pendientes y Estado del Proyecto — WearWise

Documento de control actualizado tras ejecutar todas las tareas automatizables de [`docs/ANTIGRAVITY_TASKS.md`](./ANTIGRAVITY_TASKS.md).

---

## 1. Lo que YA está completado y verificado (Fases 0, 1, 2 y 3)

- [x] **Tarea 0 — Entorno y Calidad de Código**:
  - `npm install --legacy-peer-deps`, `npm run typecheck` (0 errores), `npm run lint` (0 errores), `npm test` (5 archivos, 32 tests pasando).
  - Archivo `.env` configurado con `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- [x] **Tarea 1 — Migraciones SQL (`001`, `002`, `003`)**:
  - `001_initial_schema.sql`: Tablas `profiles`, `garments`, `weekly_plans`, `wear_logs` activas.
  - `002_security_and_quotas.sql`: Tabla `ai_usage` con RLS activada y 0 políticas públicas; funciones `consume_ai_quota` y `refund_ai_quota` restringidas exclusivamente a `service_role`; políticas de Storage restringidas a la carpeta `{uid}/` y bucket `garments` limitado a 5 MB (`5242880` bytes) y `{image/png, image/jpeg, image/webp}`.
  - `003_garment_resilience.sql`: Columnas `cutout_status` (`'none'`) y `analysis_source` (`'manual'`) en `garments`; constraint `ai_usage_kind_check` ampliado a `('analyze', 'plan', 'cutout')`.
- [x] **Tarea 2.1, 2.2 y 2.4 — Auth en Supabase**:
  - Redirect URLs: `wearwise://auth-callback` y `exp://**`.
  - Email Auth: Activo, `Confirm email` activado (`mailer_autoconfirm = false`), `password_min_length = 8`.
  - Apple Provider (lado Supabase): Activo con Client ID `com.denssed.wearwise`.
- [x] **Tarea 3 — Secretos y Edge Functions (Fase 3)**:
  - Secretos configurados: `CLAUDE_API_KEY`, `REPLICATE_API_TOKEN`, `CLAUDE_MODEL=claude-haiku-5-5`, `QUOTA_ANALYZE_PER_DAY=20`, `QUOTA_PLAN_PER_DAY=3`, `QUOTA_CUTOUT_PER_DAY=30`, `MAX_IMAGE_BYTES=2500000`.
  - 4 funciones desplegadas (`ACTIVE`): `analyze-garment`, `remove-background`, `generate-weekly-plan`, `delete-account`.
  - Función obsoleta `process-garment` eliminada.
- [x] **Tareas 4 y 6.1–6.3 — Pruebas de humo de Seguridad, Cuotas, Storage y Borrado**:
  - Verificadas respuestas `401 unauthorized`, `400 invalid_request`, bloqueo RLS `403 AccessDenied` en carpeta ajena, reembolso automático de cuota en `502 ai_unavailable`, bloqueo `429 quota_exceeded` al superar el límite diario, y borrado en cascada con `delete-account`.

---

## 2. Pendientes que requieren credenciales o acción manual del usuario (👤)

### A. Tarea 2.3 — Google OAuth (BLOQUEADA por credenciales de Google Cloud)
- [ ] **1. Crear credenciales en Google Cloud Console**:
  1. Ir a [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
  2. Configurar la pantalla de consentimiento OAuth (*OAuth consent screen*).
  3. Crear **ID de cliente de OAuth** tipo **Aplicación web**.
  4. En **URI de redirección autorizados**, agregar:
     ```text
     https://gnhsmapjozmxpmhtudgx.supabase.co/auth/v1/callback
     ```
- [ ] **2. Activar Google en Supabase**:
  - Pegar `Client ID` y `Client Secret` en *Supabase → Authentication → Providers → Google* (o compartirlos en el chat para inyectarlos por API).

### B. Tarea 2.4 (parte Apple Developer) y 5.2 — Apple Sign-In & EAS Development Builds
- [ ] Activar la capacidad **Sign In with Apple** para `com.denssed.wearwise` en el portal de *Apple Developer*.
- [ ] Ejecutar `npx eas login`, definir variables con `npx eas env:create` y generar los builds de desarrollo (`npx eas build --profile development --platform android|ios`).

### C. Tareas 5.3 y 6.4 — Pruebas manuales en dispositivo físico
- [ ] Probar el checklist manual de login, modo avión (resiliencia offline al agregar prenda), edición de prenda y recorte de fondo desde el teléfono.
