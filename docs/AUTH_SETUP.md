# Configuración de autenticación (Fase 1)

La app usa Supabase Auth con **email/contraseña**, **Google** y **Apple**. El código ya está listo;
estos pasos se hacen una sola vez en los paneles externos.

## 1. Variables de entorno
Copia `.env.example` a `.env` y completa `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
Para builds EAS: `eas env:create` con las mismas variables.

## 2. Supabase → Authentication → URL Configuration
Añade en **Redirect URLs**:
- `wearwise://auth-callback` (builds de desarrollo/producción)
- `exp://**` (solo para pruebas con Expo Go)

## 3. Email
Authentication → Providers → Email: activa **Confirm email**.
Authentication → Email Templates: personaliza los textos en español.
(Producción: configura un SMTP propio; el SMTP por defecto de Supabase tiene límites muy bajos.)

## 4. Google
1. Google Cloud Console → APIs y servicios → Credenciales → **ID de cliente OAuth** tipo *Web*.
2. URI de redirección autorizado: `https://<ref-proyecto>.supabase.co/auth/v1/callback`.
3. Pega Client ID y Secret en Supabase → Authentication → Providers → Google.
(La app usa el flujo web con `expo-web-browser`, así que no necesita Client IDs nativos.)

## 5. Apple (solo iOS, requiere cuenta Apple Developer)
1. Developer portal → Identifiers → tu App ID `com.denssed.wearwise` → activa **Sign In with Apple**.
2. Supabase → Providers → Apple: activa y añade `com.denssed.wearwise` en **Client IDs**
   (el login nativo envía un id_token cuyo `aud` es el bundle ID).
3. `app.json` ya incluye `usesAppleSignIn` y el plugin `expo-apple-authentication`.
4. Hace falta un **development build** (`eas build --profile development`); no funciona en Expo Go.

## 6. Eliminación de cuenta (obligatoria en App Store y Google Play)
Despliega la Edge Function (usa `SUPABASE_SERVICE_ROLE_KEY`, que Supabase inyecta automáticamente):

```
supabase functions deploy delete-account
```

Mantén activada la verificación de JWT (valor por defecto).
Pendiente para producción: revocar el token de Apple al borrar cuentas creadas con Apple
(requiere el secret de Apple Sign In en la función).
