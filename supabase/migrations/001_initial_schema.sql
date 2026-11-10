-- ============================================================================
-- WEARWISE — SUPABASE POSTGRESQL SCHEMA & RLS POLICIES
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase
-- ============================================================================

create extension if not exists "uuid-ossp";

-- 1. TABLA DE PERFILES DE ESTILO (Default o Personalizado)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text default 'Mi Perfil',
  profile_mode text not null default 'default' check (profile_mode in ('default', 'custom')),
  style_archetypes text[] not null default array['casual', 'smart_casual'],
  preferred_colors text[] not null default array['negro', 'blanco', 'azul marino', 'beige'],
  avoid_colors text[] not null default array[]::text[],
  work_environment text not null default 'hybrid' check (work_environment in ('remote', 'office_casual', 'business_formal', 'hybrid', 'student', 'active')),
  climate_sensitivity text not null default 'normal' check (climate_sensitivity in ('cold_sensitive', 'normal', 'heat_sensitive')),
  city_name text default 'Ciudad de México',
  latitude double precision default 19.4326,
  longitude double precision default -99.1332,
  weekly_schedule jsonb not null default '{
    "monday": "Trabajo / Oficina casual",
    "tuesday": "Trabajo / Home office",
    "wednesday": "Trabajo / Reuniones",
    "thursday": "Trabajo / Casual",
    "friday": "Casual / Salida social",
    "saturday": "Fin de semana / Paseo",
    "sunday": "Descanso / Cómodo"
  }'::jsonb,
  custom_prompt_notes text default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 2. TABLA DE PRENDAS (GARMENTS) CON CONTROL DE LAVANDERÍA Y ETIQUETAS CLAUDE VISION
create table if not exists public.garments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('top', 'bottom', 'outerwear', 'footwear', 'one_piece', 'accessory')),
  subcategory text not null default 'Prenda',
  cutout_image_url text not null,
  original_image_url text,
  colors text[] not null default array[]::text[],
  pattern text not null default 'liso',
  fabric text not null default 'algodón',
  seasons text[] not null default array['primavera', 'verano', 'otoño', 'invierno'],
  formality integer not null default 3 check (formality between 1 and 5),
  wash_care_group text not null default 'colors' check (wash_care_group in ('whites', 'darks', 'colors', 'delicates')),
  care_instructions text default 'Lavado normal en frío',
  current_wears integer not null default 0 check (current_wears >= 0),
  max_wears_before_wash integer not null default 2 check (max_wears_before_wash >= 1),
  total_lifetime_wears integer not null default 0,
  status text not null default 'clean' check (status in ('clean', 'needs_wash')),
  ai_styling_notes text default '',
  is_favorite boolean not null default false,
  last_worn_at timestamptz,
  last_washed_at timestamptz default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_garments_user_status on public.garments(user_id, status);
create index if not exists idx_garments_user_category on public.garments(user_id, category);

-- 3. TABLA DE PLANES SEMANALES GENERADOS POR CLAUDE HAIKU
create table if not exists public.weekly_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  profile_mode_used text not null default 'default',
  days jsonb not null default '[]'::jsonb,
  claude_summary text,
  created_at timestamptz not null default now(),
  unique(user_id, week_start_date)
);

-- 4. TABLA DE HISTORIAL DE USO (WEAR LOGS)
create table if not exists public.wear_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  garment_id uuid not null references public.garments(id) on delete cascade,
  worn_date date not null default current_date,
  forced_dirty boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- FUNCIONES RPC PARA CONTROL DE USO Y LAVADO INTELIGENTE
-- ============================================================================

-- Registra una puesta de un conjunto de prendas y actualiza automáticamente su estado de lavado
create or replace function public.log_outfit_wear(
  p_garment_ids uuid[],
  p_force_dirty boolean default false
)
returns setof public.garments
language plpgsql
security definer
as $$
begin
  update public.garments
  set
    current_wears = current_wears + 1,
    total_lifetime_wears = total_lifetime_wears + 1,
    last_worn_at = now(),
    status = case
      when p_force_dirty or (current_wears + 1) >= max_wears_before_wash then 'needs_wash'
      else 'clean'
    end
  where id = any(p_garment_ids)
    and user_id = auth.uid();

  insert into public.wear_logs (user_id, garment_id, worn_date, forced_dirty)
  select auth.uid(), unnest(p_garment_ids), current_date, p_force_dirty;

  return query
  select * from public.garments
  where id = any(p_garment_ids) and user_id = auth.uid();
end;
$$;

-- Marca una tanda de ropa como lavada (resetea current_wears a 0 y status a 'clean')
create or replace function public.wash_garments(
  p_garment_ids uuid[]
)
returns setof public.garments
language plpgsql
security definer
as $$
begin
  update public.garments
  set
    current_wears = 0,
    status = 'clean',
    last_washed_at = now()
  where id = any(p_garment_ids)
    and user_id = auth.uid();

  return query
  select * from public.garments
  where id = any(p_garment_ids) and user_id = auth.uid();
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.garments enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.wear_logs enable row level security;

create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage own garments" on public.garments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own weekly plans" on public.weekly_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own wear logs" on public.wear_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- STORAGE BUCKET PARA RECORTES PNG DE PRENDAS
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('garments', 'garments', true)
on conflict (id) do nothing;

create policy "Public read access for garment cutouts"
  on storage.objects for select
  using (bucket_id = 'garments');

create policy "Authenticated users upload garment cutouts"
  on storage.objects for insert
  with check (bucket_id = 'garments' and auth.role() = 'authenticated');
