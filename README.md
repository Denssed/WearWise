# WearWise — Armario Inteligente, Estilista Semanal IA y Control de Lavandería (iOS & Android)

Aplicación móvil híbrida construida con **Expo (React Native + Expo Router + TypeScript)**, **Supabase** (PostgreSQL, Storage y Edge Functions), **Replicate (`851-labs/background-remover`)** para recorte de fondo ultrarrápido y **Claude Haiku 5.5** (auto-etiquetado visual de prendas y planificador semanal de outfits según clima y ropa limpia).

---

## Características Principales

1. **Escáner de Ropa con Replicate (`851-labs/background-remover`) + Claude Haiku 5.5 (`app/(tabs)/add.tsx`)**:
   - Toma una foto con la cámara o súbela desde tu galería.
   - **Replicate (`851-labs/background-remover`)** elimina el fondo en ~1 segundo para dejar un PNG transparente (`background_type: "rgba"`).
   - **Claude Haiku 5.5 Vision** detecta automáticamente: nombre, categoría (`top`, `bottom`, `outerwear`, `footwear`, `one_piece`, `accessory`), colores, tela, grupo de lavado (`whites`, `darks`, `colors`, `delicates`), instrucciones de cuidado y **máximo de puestas recomendadas antes de lavar**.
2. **Colección Digital y Control de Puestas (`app/(tabs)/wardrobe.tsx`)**:
   - Filtra tu ropa por categoría y estado (`Limpias para vestir` vs `En cesto para lavar`).
   - Barra de progreso de usos (`current_wears / max_wears_before_wash`) ajustable por prenda.
3. **Sugerencias Semanales de Outfits + Clima Local (`app/(tabs)/index.tsx`)**:
   - Obtiene el pronóstico real de 7 días con **Open-Meteo** y `expo-location`.
   - **Claude Haiku 5.5** arma los 7 looks de Lunes a Domingo usando **exclusivamente prendas limpias** y respetando cuántas puestas le quedan a cada prenda.
   - Botón **"¡Me puse este outfit!"** que incrementa automáticamente el contador de uso de cada prenda del día y envía al cesto las que alcanzaron su límite.
4. **Cesto de Lavandería Inteligente por Tandas (`app/(tabs)/laundry.tsx`)**:
   - Agrupa la ropa sucia en **4 tandas de cuidado textil**: *Ropa Blanca*, *Oscuros y Mezclilla*, *Ropa de Color* y *Delicados / Lana / Lino*.
   - Muestra también qué prendas están a **1 sola puesta de ensuciarse** por si quieres incluirlas para completar una carga de lavadora.
   - Botón de 1 toque para marcar una tanda completa como lavada (reinicia `current_wears = 0` y devuelve las prendas al catálogo limpio).
5. **Perfil Default vs. Personalizado + Configuración de APIs (`app/(tabs)/profile.tsx`)**:
   - Alterna entre el **Perfil Default** (Smart Casual automático) y el **Perfil Personalizado** (arquetipos de estilo, sensibilidad al frío/calor y agenda de actividades de Lunes a Domingo).
   - Panel integrado para pegar tu token de **Replicate (`r8_...`)**, tu llave de **Claude Haiku 5.5** y tus credenciales de **Supabase** directamente desde el teléfono o mediante `.env`.

---

## Instalación y Ejecución Rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno y colocar tus llaves de Replicate, Claude y Supabase
cp .env.example .env

# 3. Iniciar Expo (escanea el QR con Expo Go en Android/iOS o presiona 'a' / 'i' / 'w')
npx expo start
```

---

## Configuración de Supabase (Base de Datos y Edge Functions)

1. Ve al **SQL Editor** de tu proyecto en Supabase y ejecuta, en orden, `supabase/migrations/001_initial_schema.sql`, `002_security_and_quotas.sql` y `003_garment_resilience.sql`.
2. Para desplegar las Edge Functions que protegen tus llaves en la nube:
   ```bash
   npx supabase secrets set REPLICATE_API_TOKEN=r8_tu_token CLAUDE_API_KEY=sk-ant-tu_clave
   npx supabase functions deploy analyze-garment
   npx supabase functions deploy remove-background
   npx supabase functions deploy generate-weekly-plan
   npx supabase functions deploy delete-account
   ```
   Guía completa: [`docs/BACKEND_SETUP.md`](./docs/BACKEND_SETUP.md) y [`docs/ANTIGRAVITY_TASKS.md`](./docs/ANTIGRAVITY_TASKS.md).
