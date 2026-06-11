-- ═══════════════════════════════════════════════════════════════════════════
-- SUPERADMIN + WHITELIST GLOBAL
--
-- Hasta ahora el "superadmin" era solo un env var del frontend
-- (VITE_SUPERADMIN_EMAIL) sin respaldo en la DB: el panel de suscripciones
-- leía vía es_miembro() (solo veía su propio negocio) y los UPDATE de
-- suscripciones no tenían policy (fallaban para authenticated).
--
-- Esta migration crea:
--   1. Tabla superadmins (RLS sin policies — solo la leen funciones definer)
--   2. es_superadmin() — gate de backend real
--   3. admin_whitelist() — todos los emails con acceso + negocio/owner
--   4. admin_suscripciones() — todas las suscripciones del sistema
--   5. admin_update_suscripcion() / admin_renovar_suscripcion() — acciones
--      del panel con validación de estado en backend
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists superadmins (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table superadmins enable row level security;

insert into superadmins (email) values ('pedrodelcarlo@icloud.com')
on conflict (email) do nothing;

create or replace function es_superadmin()
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from superadmins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Whitelist global: cada email autorizado, su rol y a qué negocio pertenece
create or replace function admin_whitelist()
returns jsonb
language sql stable security definer set search_path = public, pg_catalog
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ae.id,
    'email', ae.email,
    'rol', ae.rol,
    'is_owner', ae.is_owner,
    'trial_activo', ae.trial_activo,
    'owner_email', (select u.email from auth.users u where u.id = ae.owner_user_id),
    'negocio_nombre', (select nc.nombre from negocio_config nc where nc.negocio_id = ae.owner_user_id limit 1),
    'created_at', ae.created_at
  ) order by ae.created_at), '[]'::jsonb)
  from allowed_emails ae
  where es_superadmin();
$$;

create or replace function admin_suscripciones()
returns jsonb
language sql stable security definer set search_path = public, pg_catalog
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'user_id', s.user_id,
    'user_email', s.user_email,
    'estado', s.estado,
    'fecha_inicio', s.fecha_inicio,
    'fecha_vencimiento', s.fecha_vencimiento,
    'created_at', s.created_at
  ) order by s.created_at desc), '[]'::jsonb)
  from suscripciones s
  where es_superadmin();
$$;

create or replace function admin_update_suscripcion(p_id uuid, p_estado text)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if not es_superadmin() then
    raise exception 'No autorizado';
  end if;
  if p_estado not in ('activa', 'prueba', 'vencida', 'bloqueada') then
    raise exception 'Estado inválido: %', p_estado;
  end if;
  update suscripciones
  set estado = p_estado, updated_at = now()
  where id = p_id;
end;
$$;

create or replace function admin_renovar_suscripcion(p_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if not es_superadmin() then
    raise exception 'No autorizado';
  end if;
  -- Extiende 30 días desde el vencimiento si está vigente, desde hoy si venció
  update suscripciones
  set estado = 'activa',
      fecha_vencimiento = greatest(fecha_vencimiento, current_date) + 30,
      updated_at = now()
  where id = p_id;
end;
$$;

commit;
