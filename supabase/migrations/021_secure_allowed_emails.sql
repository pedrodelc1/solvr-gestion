-- ═══════════════════════════════════════════════════════════════════════════
-- 021 — Seguridad: RLS + RPCs en allowed_emails
--
-- PROBLEMA:
--   allowed_emails no tenía RLS habilitado. Cualquier usuario autenticado
--   podía hacer UPDATE allowed_emails SET rol='admin' directamente vía REST.
--   Un amigo de Pedro lo demostró escalando de 'visualizador' a 'admin'.
--
-- SOLUCIÓN:
--   1. Habilitar RLS en allowed_emails (bloquea todo acceso directo por defecto).
--   2. Policy SELECT: owners ven su equipo; miembros ven su propia fila.
--   3. Toda mutación (UPDATE/INSERT/DELETE) pasa exclusivamente por RPCs
--      SECURITY DEFINER que validan quién llama antes de tocar datos.
--   4. Tabla de auditoría para registrar cambios de rol.
--
-- FUNCIONES EXISTENTES QUE NO SE ROMPEN:
--   get_my_role(), is_my_owner_data(), claim_team_access(), admin_whitelist()
--   — todas son SECURITY DEFINER, bypasean RLS correctamente.
--
-- IDEMPOTENTE: sí (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- ROLLBACK: ver sección al final.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Tabla de auditoría de cambios de rol
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists audit_role_changes (
  id           uuid primary key default gen_random_uuid(),
  actor_uid    uuid not null,
  actor_email  text,
  target_email text not null,
  rol_anterior text,
  rol_nuevo    text,
  accion       text not null, -- 'update_rol' | 'add_member' | 'remove_member'
  created_at   timestamptz not null default now()
);

alter table audit_role_changes enable row level security;

-- Solo los superadmins pueden leer la auditoría
create policy audit_role_changes_select on audit_role_changes
  for select using (es_superadmin());

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Habilitar RLS en allowed_emails
-- ────────────────────────────────────────────────────────────────────────────

alter table allowed_emails enable row level security;

-- Limpiar policies previas si existieran de alguna ejecución anterior
drop policy if exists ae_select_own_team on allowed_emails;
drop policy if exists ae_select_own_row  on allowed_emails;
drop policy if exists ae_superadmin      on allowed_emails;

-- SELECT: el owner ve a todos sus miembros (owner_user_id = mi uid)
create policy ae_select_own_team on allowed_emails
  for select
  using (owner_user_id = auth.uid());

-- SELECT: un miembro ve su propia fila (para onboarding / UI de perfil)
create policy ae_select_own_row on allowed_emails
  for select
  using (lower(email) = lower(auth.email()));

-- SELECT: superadmins ven todo (para el panel de Pedro)
create policy ae_superadmin on allowed_emails
  for select
  using (es_superadmin());

-- ⚠️ NO se crean policies de INSERT / UPDATE / DELETE.
-- Toda mutación va por RPC SECURITY DEFINER (abajo).

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Helper interno: obtener owner_user_id del caller
--    (ya sea dueño directo o admin del mismo negocio)
-- ────────────────────────────────────────────────────────────────────────────

create or replace function _ae_caller_is_owner_or_admin(p_owner_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public, auth, pg_catalog
as $$
  -- El caller es el owner directo
  select auth.uid() = p_owner_user_id
  -- O el caller es admin del mismo equipo (tiene fila con rol='admin' y mismo owner)
  or exists (
    select 1
    from public.allowed_emails
    where lower(email) = lower(auth.email())
      and owner_user_id = p_owner_user_id
      and rol = 'admin'
  )
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. RPC update_member_rol(member_id, nuevo_rol)
-- ────────────────────────────────────────────────────────────────────────────

create or replace function update_member_rol(
  p_member_id uuid,
  p_nuevo_rol text
)
returns void
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_target   allowed_emails%rowtype;
begin
  -- Validar rol permitido (nunca se puede asignar 'owner' via esta RPC)
  if p_nuevo_rol not in ('admin', 'vendedor', 'visualizador') then
    raise exception 'Rol inválido: %. Los roles permitidos son: admin, vendedor, visualizador.', p_nuevo_rol
      using errcode = 'P0001';
  end if;

  -- Traer la fila objetivo
  select * into v_target from public.allowed_emails where id = p_member_id;

  if v_target.id is null then
    raise exception 'Miembro no encontrado.'
      using errcode = 'P0002';
  end if;

  -- No se puede modificar la fila del owner
  if v_target.is_owner then
    raise exception 'No podés cambiar el rol del dueño del negocio.'
      using errcode = 'P0003';
  end if;

  -- No se puede modificar la propia fila (auto-escalación)
  if lower(v_target.email) = lower(auth.email()) then
    raise exception 'No podés cambiar tu propio rol.'
      using errcode = 'P0004';
  end if;

  -- Verificar autorización: caller debe ser owner o admin del mismo negocio
  if not _ae_caller_is_owner_or_admin(v_target.owner_user_id) then
    raise exception 'Sin permiso: necesitás ser owner o admin para cambiar roles.'
      using errcode = 'P0005';
  end if;

  -- Ejecutar el cambio
  update public.allowed_emails
    set rol = p_nuevo_rol
    where id = p_member_id;

  -- Registrar en auditoría
  insert into public.audit_role_changes
    (actor_uid, actor_email, target_email, rol_anterior, rol_nuevo, accion)
  values
    (auth.uid(), auth.email(), v_target.email, v_target.rol, p_nuevo_rol, 'update_rol');
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. RPC add_member_email(email, rol)
-- ────────────────────────────────────────────────────────────────────────────

create or replace function add_member_email(
  p_email text,
  p_rol   text default 'vendedor'
)
returns uuid
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_owner_uid uuid;
  v_new_id    uuid;
begin
  -- Solo owner o admin pueden agregar miembros
  -- El owner es auth.uid() (los owners son quienes tienen negocios)
  v_owner_uid := auth.uid();

  -- Validar rol
  if p_rol not in ('admin', 'vendedor', 'visualizador') then
    raise exception 'Rol inválido: %. Los roles permitidos son: admin, vendedor, visualizador.', p_rol
      using errcode = 'P0001';
  end if;

  -- No puede agregarse a sí mismo como miembro subordinado
  if lower(p_email) = lower(auth.email()) then
    raise exception 'No podés agregarte a vos mismo como miembro.'
      using errcode = 'P0006';
  end if;

  -- El caller debe ser owner (uid directo) o admin
  if not (
    exists (select 1 from public.negocios where owner_id = auth.uid())
    or exists (
      select 1 from public.allowed_emails
      where lower(email) = lower(auth.email()) and rol = 'admin'
    )
    or es_superadmin()
  ) then
    raise exception 'Sin permiso: necesitás ser owner o admin para agregar miembros.'
      using errcode = 'P0005';
  end if;

  insert into public.allowed_emails (email, rol, owner_user_id, is_owner)
    values (lower(trim(p_email)), p_rol, v_owner_uid, false)
    returning id into v_new_id;

  insert into public.audit_role_changes
    (actor_uid, actor_email, target_email, rol_anterior, rol_nuevo, accion)
  values
    (auth.uid(), auth.email(), lower(trim(p_email)), null, p_rol, 'add_member');

  return v_new_id;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. RPC remove_member_email(id)
-- ────────────────────────────────────────────────────────────────────────────

create or replace function remove_member_email(
  p_member_id uuid
)
returns void
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_target allowed_emails%rowtype;
begin
  select * into v_target from public.allowed_emails where id = p_member_id;

  if v_target.id is null then
    raise exception 'Miembro no encontrado.'
      using errcode = 'P0002';
  end if;

  -- No se puede eliminar al owner
  if v_target.is_owner then
    raise exception 'No podés eliminar al dueño del negocio.'
      using errcode = 'P0003';
  end if;

  -- No se puede eliminar la propia fila
  if lower(v_target.email) = lower(auth.email()) then
    raise exception 'No podés eliminarte a vos mismo del equipo.'
      using errcode = 'P0004';
  end if;

  if not _ae_caller_is_owner_or_admin(v_target.owner_user_id) then
    raise exception 'Sin permiso: necesitás ser owner o admin para eliminar miembros.'
      using errcode = 'P0005';
  end if;

  delete from public.allowed_emails where id = p_member_id;

  insert into public.audit_role_changes
    (actor_uid, actor_email, target_email, rol_anterior, rol_nuevo, accion)
  values
    (auth.uid(), auth.email(), v_target.email, v_target.rol, null, 'remove_member');
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Validación inline
-- ────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_rls boolean;
begin
  select rowsecurity into v_rls
    from pg_tables
    where schemaname = 'public' and tablename = 'allowed_emails';

  if not v_rls then
    raise exception 'VALIDACIÓN FALLIDA: RLS no está habilitado en allowed_emails.';
  end if;

  raise notice '✓ RLS habilitado en allowed_emails.';
  raise notice '✓ RPCs update_member_rol / add_member_email / remove_member_email creadas.';
  raise notice '✓ Tabla audit_role_changes lista.';
end $$;

commit;

-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (comentado — ejecutar solo si hay que revertir)
-- ────────────────────────────────────────────────────────────────────────────
-- begin;
-- alter table allowed_emails disable row level security;
-- drop policy if exists ae_select_own_team on allowed_emails;
-- drop policy if exists ae_select_own_row  on allowed_emails;
-- drop policy if exists ae_superadmin      on allowed_emails;
-- drop function if exists update_member_rol(uuid, text);
-- drop function if exists add_member_email(text, text);
-- drop function if exists remove_member_email(uuid);
-- drop function if exists _ae_caller_is_owner_or_admin(uuid);
-- drop table if exists audit_role_changes;
-- commit;
