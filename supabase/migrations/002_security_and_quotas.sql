-- ============================================================================
-- WEARWISE — FASE 2: SEGURIDAD Y CUOTAS DE IA
-- Ejecuta este script en el SQL Editor de Supabase (después de 001).
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================================

-- 1. CUOTAS DIARIAS DE IA POR USUARIO ---------------------------------------
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  kind text not null check (kind in ('analyze', 'plan')),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day, kind)
);

-- RLS activada SIN políticas: ni anon ni usuarios autenticados pueden leer o escribir.
-- Solo las Edge Functions (service_role) acceden, mediante las funciones de abajo.
alter table public.ai_usage enable row level security;

-- Consume 1 uso de forma atómica. Devuelve allowed=false si ya se alcanzó el límite.
create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_kind text,
  p_limit integer
)
returns table (allowed boolean, used integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_count integer;
begin
  if p_limit <= 0 then
    return query select false, 0;
    return;
  end if;

  insert into public.ai_usage as u (user_id, day, kind, count)
  values (p_user_id, v_day, p_kind, 1)
  on conflict (user_id, day, kind)
  do update set count = u.count + 1
  where u.count < p_limit
  returning u.count into v_count;

  if v_count is null then
    select u.count into v_count
    from public.ai_usage u
    where u.user_id = p_user_id and u.day = v_day and u.kind = p_kind;
    return query select false, coalesce(v_count, 0);
  else
    return query select true, v_count;
  end if;
end;
$$;

-- Devuelve 1 uso cuando el fallo fue del servicio y no del usuario.
create or replace function public.refund_ai_quota(
  p_user_id uuid,
  p_kind text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage
  set count = greatest(count - 1, 0)
  where user_id = p_user_id
    and day = (now() at time zone 'utc')::date
    and kind = p_kind;
$$;

-- Solo service_role puede ejecutarlas (los usuarios no pueden resetear su propia cuota).
revoke all on function public.consume_ai_quota(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, integer) to service_role;
grant execute on function public.refund_ai_quota(uuid, text) to service_role;

-- 2. STORAGE: cada usuario solo escribe en su propia carpeta ({uid}/...) ------
-- Antes cualquier usuario autenticado podía subir a cualquier ruta del bucket.
drop policy if exists "Authenticated users upload garment cutouts" on storage.objects;
drop policy if exists "Users upload to own folder" on storage.objects;
drop policy if exists "Users update own files" on storage.objects;
drop policy if exists "Users delete own files" on storage.objects;

create policy "Users upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'garments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update own files"
  on storage.objects for update to authenticated
  using (bucket_id = 'garments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'garments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'garments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Límite de tamaño y tipos permitidos en el bucket (5 MB, solo imágenes).
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'garments';

-- NOTA: el bucket sigue siendo público (lectura por URL) porque las fotos se muestran
-- directamente en la app. Los nombres de archivo son UUID aleatorios (no adivinables).
-- Pasar a bucket privado con URLs firmadas es una mejora futura.

-- 3. ENDURECER FUNCIONES SECURITY DEFINER de 001 -----------------------------
-- Fijar search_path evita ataques por sustitución de objetos.
alter function public.log_outfit_wear(uuid[], boolean) set search_path = public;
alter function public.wash_garments(uuid[]) set search_path = public;
revoke all on function public.log_outfit_wear(uuid[], boolean) from public, anon;
revoke all on function public.wash_garments(uuid[]) from public, anon;
grant execute on function public.log_outfit_wear(uuid[], boolean) to authenticated;
grant execute on function public.wash_garments(uuid[]) to authenticated;
