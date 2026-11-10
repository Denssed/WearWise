-- ============================================================================
-- WEARWISE — FASE 3: AGREGAR PRENDA RESILIENTE
-- Ejecuta este script en el SQL Editor de Supabase (después de 001 y 002).
-- Es idempotente.
-- ============================================================================

-- Estado del recorte de fondo y origen de los datos de la prenda.
alter table public.garments
  add column if not exists cutout_status text not null default 'none',
  add column if not exists analysis_source text not null default 'manual';

alter table public.garments drop constraint if exists garments_cutout_status_check;
alter table public.garments
  add constraint garments_cutout_status_check
  check (cutout_status in ('none', 'pending', 'done', 'failed'));

alter table public.garments drop constraint if exists garments_analysis_source_check;
alter table public.garments
  add constraint garments_analysis_source_check
  check (analysis_source in ('ai', 'manual'));

-- Las prendas ya existentes cuya imagen es un recorte se marcan como listas.
update public.garments
set cutout_status = 'done'
where cutout_status = 'none' and cutout_image_url like '%/cutout-%';

-- Nueva cuota diaria para el recorte de fondo.
alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage
  add constraint ai_usage_kind_check
  check (kind in ('analyze', 'plan', 'cutout'));
