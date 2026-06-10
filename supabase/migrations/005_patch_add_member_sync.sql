-- PATCH — Sincronizar allowed_emails con negocio_members
--
-- Problema: addAllowedEmail (PerfilPanel) solo escribe en allowed_emails.
-- Desde Fase 4, el login verifica negocio_members. Los miembros agregados
-- después de Fase 1 no tienen entrada en negocio_members y no pueden ingresar.
--
-- Solución:
--   1. RPC add_member_by_email: si el usuario ya tiene cuenta en auth.users,
--      lo inserta en negocio_members del negocio activo del invocador.
--   2. Trigger on_auth_user_created actualizado: si el email está en
--      allowed_emails como no-owner, lo añade al negocio del owner en vez
--      de crear uno nuevo.
--   3. Script de reparación: sincroniza allowed_emails existentes que no
--      tienen negocio_members y sí tienen cuenta en auth.users.

begin;

-- ── 1. RPC add_member_by_email ────────────────────────────────────────────────
-- Llamada desde el frontend al agregar un email en PerfilPanel.
-- Inserta en negocio_members si el usuario ya existe en auth.users.
-- Si no existe, la entrada en allowed_emails basta: el trigger los incorporará
-- cuando hagan su primer login.

create or replace function add_member_by_email(p_email text, p_rol text)
returns void
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_negocio_id uuid;
  v_user_id    uuid;
begin
  v_negocio_id := mi_negocio_id();
  if v_negocio_id is null then
    raise exception 'sin negocio activo';
  end if;

  if not puede_administrar(v_negocio_id) then
    raise exception 'no autorizado: se requiere rol owner o admin';
  end if;

  -- Buscar si el usuario ya tiene cuenta
  select id into v_user_id
    from auth.users
   where lower(email) = lower(trim(p_email));

  if v_user_id is not null then
    insert into negocio_members (negocio_id, user_id, rol, invited_by)
         values (v_negocio_id, v_user_id, p_rol::rol_negocio, auth.uid())
    on conflict (negocio_id, user_id)
    do update set rol = excluded.rol, activo = true, deactivated_at = null;
  end if;
  -- Si el usuario no existe aún, el trigger on_auth_user_created lo incorporará
  -- al hacer signup (ver punto 2).
end;
$$;

-- ── 2. Trigger on_auth_user_created actualizado ───────────────────────────────
-- Agrega el chequeo de allowed_emails ANTES de crear un negocio nuevo.
-- Si el email está en allowed_emails como miembro (is_owner = false),
-- lo une al negocio del owner en vez de crear uno propio.

create or replace function on_auth_user_created()
returns trigger
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_negocio_id  uuid;
  v_rol         rol_negocio;
  v_owner_id    uuid;
begin
  -- Prioridad 1: invitación pendiente → el flujo accept_invitation se encarga,
  --              no crear negocio propio.
  if exists(
    select 1 from invitaciones
     where lower(email) = lower(new.email) and accepted_at is null
  ) then
    return new;
  end if;

  -- Prioridad 2: allowed_emails (sistema heredado) → unirse al negocio del owner.
  select ae.owner_user_id,
         (case ae.rol
            when 'admin'    then 'admin'::rol_negocio
            when 'vendedor' then 'vendedor'::rol_negocio
            else                 'visualizador'::rol_negocio
          end)
    into v_owner_id, v_rol
    from allowed_emails ae
   where lower(ae.email) = lower(new.email)
     and ae.is_owner = false
   limit 1;

  if v_owner_id is not null then
    -- Verificar que el owner realmente tiene un negocio
    select id into v_negocio_id from negocios where id = v_owner_id;
    if v_negocio_id is not null then
      insert into negocio_members (negocio_id, user_id, rol)
           values (v_negocio_id, new.id, v_rol)
      on conflict (negocio_id, user_id)
      do update set rol = excluded.rol, activo = true, deactivated_at = null;
      return new;  -- no crear negocio propio
    end if;
  end if;

  -- Prioridad 3 (default): crear negocio nuevo con trial.
  insert into negocios (nombre, owner_id, trial_hasta)
       values ('Mi Negocio', new.id, current_date + interval '14 days')
    returning id into v_negocio_id;

  insert into negocio_members (negocio_id, user_id, rol)
       values (v_negocio_id, new.id, 'owner');

  insert into suscripciones (negocio_id, estado, fecha_inicio, fecha_vencimiento)
       values (v_negocio_id, 'prueba', current_date, current_date + interval '14 days');

  return new;
end;
$$;

-- El trigger ya existe (creado en Fase 1); solo actualiza la función.
-- No hace falta drop/create del trigger.

-- ── 3. Reparación: syncronizar allowed_emails existentes ─────────────────────
-- Inserta en negocio_members a los miembros que:
--   - Están en allowed_emails con is_owner = false
--   - Ya tienen cuenta en auth.users
--   - Todavía no tienen entrada en negocio_members para ese negocio
--   - El owner tiene negocio en la tabla negocios

insert into negocio_members (negocio_id, user_id, rol)
  select ae.owner_user_id as negocio_id,
         u.id             as user_id,
         (case ae.rol
            when 'admin'    then 'admin'::rol_negocio
            when 'vendedor' then 'vendedor'::rol_negocio
            else                 'visualizador'::rol_negocio
          end)             as rol
    from allowed_emails ae
    join auth.users u on lower(u.email) = lower(ae.email)
   where ae.is_owner = false
     and exists (select 1 from negocios n where n.id = ae.owner_user_id)
     and not exists (
       select 1 from negocio_members nm
        where nm.negocio_id = ae.owner_user_id
          and nm.user_id = u.id
     )
on conflict (negocio_id, user_id)
do update set rol = excluded.rol, activo = true, deactivated_at = null;

-- Verificación: mostrar cuántos miembros se sincronizaron
do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from negocio_members nm
    join allowed_emails ae
      on lower((select email from auth.users where id = nm.user_id)) = lower(ae.email)
   where ae.is_owner = false;

  raise notice 'Miembros en negocio_members derivados de allowed_emails: %', v_count;
end $$;

commit;
