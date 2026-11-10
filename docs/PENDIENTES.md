# Checklist de Pendientes y Estado del Proyecto — WearWise

Documento de control para llevar el seguimiento de lo que **ya está activo** en producción/desarrollo y los **pendientes externos** (como Google OAuth, Apple Developer y SMTP).

---

## 1. Lo que YA está completado y activo

- [x] **Proyecto Supabase (`WearWise`)**:
  - **Ref**: `gnhsmapjozmxpmhtudgx`
  - **URL**: `https://gnhsmapjozmxpmhtudgx.supabase.co`
- [x] **Base de datos y Storage**:
  - Tablas `profiles`, `garments`, `weekly_plans`, `wear_logs` con políticas RLS activas ([`001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql)).
  - Bucket público `garments` creado con políticas de lectura/escritura por carpeta `{uid}/`.
- [x] **Edge Functions desplegadas (`ACTIVE`)**:
  - `process-garment` (`verify_jwt: false`) — recorte de fondo y análisis textil IA.
  - `generate-weekly-plan` (`verify_jwt: false`) — generación del plan semanal de 7 días.
  - `delete-account` (`verify_jwt: true`) — borrado definitivo de archivos y cuenta del usuario.
- [x] **Secrets en Supabase Edge Functions**:
  - `REPLICATE_API_TOKEN`, `REPLICATE_BG_VERSION`, `CLAUDE_API_KEY`, `CLAUDE_MODEL` guardados en el servidor (ocultos de la app móvil).
- [x] **Configuración base de Auth en Supabase**:
  - `site_url`: `wearwise://auth-callback`
  - **Redirect URLs**: `wearwise://auth-callback` y `exp://**`
  - **Email Auth**: Activo con confirmación de correo (`Confirm email` activado).
  - **Apple Sign-In (lado Supabase)**: Activo con Client ID `com.denssed.wearwise`.

---

## 2. Pendientes por configurar

### A. Google OAuth (Prioridad Alta para Login con Google)
- [ ] **1. Crear credenciales en Google Cloud Console**:
  1. Ir a [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
  2. Configurar la pantalla de consentimiento OAuth (*OAuth consent screen*) con el nombre **WearWise**.
  3. Crear credenciales → **ID de cliente de OAuth** → Tipo **Aplicación web**.
  4. En **URI de redirección autorizados**, agregar exactamente:
     ```text
     https://gnhsmapjozmxpmhtudgx.supabase.co/auth/v1/callback
     ```
- [ ] **2. Activar Google en Supabase**:
  - Copiar el **Client ID** y el **Client Secret** generados por Google.
  - Pegarlos en *Supabase → Authentication → Providers → Google* (o compartirlos en el chat para inyectarlos vía API).

---

### B. Apple Sign-In en iOS (Solo requerido para publicar en App Store / probar en iPhone nativo)
- [ ] **1. Cuenta de Apple Developer**:
  - En *Certificates, Identifiers & Profiles → Identifiers*, registrar el App ID `com.denssed.wearwise` y marcar la casilla **Sign In with Apple**.
- [ ] **2. Development Build con EAS**:
  - El botón de Apple solo aparece en iOS y requiere compilar un build de desarrollo (`eas build --profile development --platform ios`), ya que no corre dentro de Expo Go estándar.
- [ ] **3. Revocación de token Apple al eliminar cuenta (Producción)**:
  - Generar llave privada `.p8` de Sign In with Apple para revocar el token de Apple dentro de [`supabase/functions/delete-account/index.ts`](../supabase/functions/delete-account/index.ts) antes de enviar la app a revisión final del App Store.

---

### C. Correo SMTP Propio y Plantillas en Español (Prioridad Media — antes de lanzamiento público)
- [ ] **1. Configurar Custom SMTP en Supabase**:
  - El servidor de correo gratuito por defecto de Supabase tiene un límite de ~2–4 correos por hora y no permite editar las plantillas HTML en el plan Free.
  - Conectar un proveedor SMTP (ej. **Resend**, **SendGrid**, **Postmark** o **AWS SES**) en *Supabase → Project Settings → Authentication → SMTP Settings*.
- [ ] **2. Aplicar plantillas de correo en español**:
  - Una vez activo el SMTP propio, traducir los asuntos y cuerpos de *Confirm signup* y *Reset password* en *Authentication → Email Templates*.

---

### D. Builds de Producción y Tiendas (Fase de Lanzamiento)
- [ ] **1. Variables de entorno en EAS**:
  - Ejecutar `eas env:create` para registrar `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` en los servidores de Expo Application Services.
- [ ] **2. Icono, Splash Screen y Capturas de Tienda**:
  - Reemplazar los assets de icono/splash definitivos en `app.json` antes de correr `eas build --profile production`.
