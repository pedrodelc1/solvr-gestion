-- ═══════════════════════════════════════════════════════════════════════════
-- PLANES POR CANTIDAD DE ASIENTOS (USUARIOS POR EQUIPO)
--
-- Hasta ahora había un único plan ("Básico", $4990) y ningún límite de
-- usuarios por negocio: cualquier dueño podía invitar miembros sin tope.
--
-- Esta migration introduce planes por cantidad de usuarios y los ENFORZA en
-- el backend (doble verificación: el frontend además muestra el contador y
-- bloquea el alta, pero la regla real vive acá y no se puede bypassear).
--
-- Modelo de asientos:
--   • Un "asiento" = el dueño + cada miembro invitado que NO sea visualizador.
--   • Los visualizadores (solo lectura) NO consumen asiento.
--   • negocio_id = user_id del dueño. Los invitados viven en allowed_emails
--     con owner_user_id = negocio_id; el dueño es is_owner = true (se cuenta
--     como el +1 fijo).
--
-- Planes:
--   • Solo     → 1 usuario  (solo el dueño)
--   • Equipo   → 5 usuarios  (dueño + hasta 4)
--   • Negocio  → ilimitado   (max_asientos = NULL)
--
-- Los precios quedan en 0 a propósito: Pedro los define después desde la DB
-- o el panel. El límite de asientos es lo único que esta migration fija.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ────────────────────────────────────────────────────────────────────────
-- 1. Columna de límite de asientos en planes (NULL = ilimitado)
-- ────────────────────────────────────────────────────────────────────────
alter table planes add column if not exists max_asientos integer;

-- Retira el plan viejo de la oferta (no se borra para no romper históricos)
update planes set activo = false where nombre = 'Básico';

-- Crea los 3 planes nuevos (idempotente por nombre)
insert into planes (id, nombre, descripcion, precio_mensual, activo, max_asientos)
select gen_random_uuid(), 'Solo', 'Para uso individual — solo el dueño', 0, true, 1
where not exists (select 1 from planes where nombre = 'Solo');

insert into planes (id, nombre, descripcion, precio_mensual, activo, max_asientos)
select gen_random_uuid(), 'Equipo', 'Hasta 5 usuarios (visualizadores no cuentan)', 0, true, 5
where not exists (select 1 from planes where nombre = 'Equipo');

insert into planes (id, nombre, descripcion, precio_mensual, activo, max_asientos)
select gen_random_uuid(), 'Negocio', 'Usuarios ilimitados', 0, true, null
where not exists (select 1 from planes where nombre = 'Negocio');

-- ────────────────────────────────────────────────────────────────────────
-- 2. Helpers (security definer — cuentan/leen a través de RLS de forma
--    consistente para frontend y backend: misma fuente de verdad)
-- ────────────────────────────────────────────────────────────────────────

-- Asientos usados por un negocio = 1 (dueño) + invitados no-visualizador
create or replace function asientos_usados(p_negocio uuid)
returns integer
language sql stable security definer set search_path = public, pg_catalog
as $$
  select 1 + (
    select count(*)::int
    from allowed_emails
    where owner_user_id = p_negocio
      and is_owner = false
      and coalesce(rol, '') <> 'visualizador'
  );
$$;

-- Límite de asientos de un negocio según su plan.
--   NULL  = ilimitado (plan Negocio o superadmin)
--   5     = default cuando todavía no tiene plan asignado (prueba)
create or replace function negocio_max_asientos(p_negocio uuid)
returns integer
language plpgsql stable security definer set search_path = public, pg_catalog
as $$
declare
  v_default constant integer := 5;  -- tope durante la prueba / sin plan
  v_email   text;
  v_max     integer;
  v_found   boolean := false;
begin
  -- El dueño superadmin nunca tiene tope
  select lower(u.email) into v_email from auth.users u where u.id = p_negocio;
  if v_email is not null and exists (
    select 1 from superadmins where lower(email) = v_email
  ) then
    return null;
  end if;

  -- Plan vigente del negocio (busca por negocio_id o user_id)
  select p.max_asientos, true
    into v_max, v_found
  from suscripciones s
  join planes p on p.id = s.plan_id
  where s.negocio_id = p_negocio or s.user_id = p_negocio
  order by s.created_at desc
  limit 1;

  if v_found then
    return v_max;          -- puede ser NULL = ilimitado (plan Negocio)
  end if;

  return v_default;        -- sin plan asignado todavía
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 3. Enforcement: trigger en allowed_emails (alta y cambio de rol)
-- ────────────────────────────────────────────────────────────────────────
create or replace function check_limite_asientos()
returns trigger
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_limite integer;
  v_usados integer;
  v_consume boolean;
begin
  -- El dueño no se limita (es el +1 fijo)
  if NEW.is_owner then
    return NEW;
  end if;

  -- Un visualizador nunca consume asiento
  if coalesce(NEW.rol, '') = 'visualizador' then
    return NEW;
  end if;

  -- ¿Esta operación agrega un asiento nuevo que antes no existía?
  if TG_OP = 'INSERT' then
    v_consume := true;
  else  -- UPDATE: solo si pasa de visualizador/owner a un rol que sí consume
    v_consume := coalesce(OLD.rol, '') = 'visualizador' or OLD.is_owner;
  end if;

  if not v_consume then
    return NEW;
  end if;

  v_limite := negocio_max_asientos(NEW.owner_user_id);
  if v_limite is null then
    return NEW;  -- ilimitado
  end if;

  -- asientos_usados excluye la fila nueva (INSERT) o cuenta la vieja como
  -- visualizador (UPDATE), así +1 es el costo real de esta operación.
  v_usados := asientos_usados(NEW.owner_user_id);
  if v_usados + 1 > v_limite then
    raise exception 'Llegaste al límite de usuarios de tu plan (% de %). Cambiá a un plan más grande para agregar más. Los visualizadores no cuentan.', v_usados, v_limite
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_limite_asientos on allowed_emails;
create trigger trg_limite_asientos
  before insert or update on allowed_emails
  for each row execute function check_limite_asientos();

-- ────────────────────────────────────────────────────────────────────────
-- 4. RPC para el frontend: contador de asientos del negocio actual
-- ────────────────────────────────────────────────────────────────────────
create or replace function mi_plan_asientos()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_catalog
as $$
declare
  v_neg   uuid := mi_negocio_id();
  v_plan  text;
begin
  if v_neg is null then
    return jsonb_build_object('limite', null, 'usados', 0, 'plan', null);
  end if;

  select p.nombre into v_plan
  from suscripciones s
  join planes p on p.id = s.plan_id
  where s.negocio_id = v_neg or s.user_id = v_neg
  order by s.created_at desc
  limit 1;

  return jsonb_build_object(
    'limite', negocio_max_asientos(v_neg),
    'usados', asientos_usados(v_neg),
    'plan',   v_plan
  );
end;
$$;

grant execute on function mi_plan_asientos() to authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 5. Superadmin: listar planes y asignar plan a una suscripción
-- ────────────────────────────────────────────────────────────────────────
create or replace function admin_planes()
returns jsonb
language sql stable security definer set search_path = public, pg_catalog
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'nombre', p.nombre,
    'descripcion', p.descripcion,
    'precio_mensual', p.precio_mensual,
    'max_asientos', p.max_asientos,
    'activo', p.activo
  ) order by p.max_asientos nulls last), '[]'::jsonb)
  from planes p
  where es_superadmin() and p.activo;
$$;

create or replace function admin_set_plan(p_suscripcion_id uuid, p_plan_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if not es_superadmin() then
    raise exception 'No autorizado';
  end if;
  if p_plan_id is not null and not exists (select 1 from planes where id = p_plan_id) then
    raise exception 'Plan inexistente';
  end if;
  update suscripciones
  set plan_id = p_plan_id, updated_at = now()
  where id = p_suscripcion_id;
end;
$$;

grant execute on function admin_planes() to authenticated;
grant execute on function admin_set_plan(uuid, uuid) to authenticated;

-- Incluye el plan asignado en el listado de suscripciones del panel
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
    'plan_id', s.plan_id,
    'plan_nombre', (select p.nombre from planes p where p.id = s.plan_id),
    'asientos_usados', asientos_usados(coalesce(s.negocio_id, s.user_id)),
    'created_at', s.created_at
  ) order by s.created_at desc), '[]'::jsonb)
  from suscripciones s
  where es_superadmin();
$$;

commit;
