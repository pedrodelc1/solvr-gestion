-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 1 — Infraestructura de tenancy (additiva)
-- Solvr Gestión — plan: docs/plan-rls-multitenant.md §7 Fase 1
--
-- QUÉ HACE:
--   1. Crea tipo `rol_negocio` (enum).
--   2. Crea tablas `negocios`, `negocio_members`, `invitaciones` + índices.
--   3. Crea funciones helper: mi_negocio_id, es_miembro, mi_rol_en,
--      puede_leer / escribir / eliminar / administrar, es_owner.
--      ⚠ NO crea is_suscripcion_activa — esa va en Fase 3 (§2.4).
--   4. Habilita RLS y crea policies en las 3 tablas nuevas, todo en la
--      misma transacción (regla §7.0).
--   5. Crea RPC `accept_invitation(text)` (security definer).
--   6. Crea trigger `on_auth_user_created` que, para signups self-service:
--        - crea negocio + membership owner
--        - crea suscripción de trial (usando el schema VIEJO: user_id, no
--          negocio_id todavía, porque la columna se agrega en Fase 2).
--   7. Backfill: UNION distinct user_id sobre TODAS las tablas de datos
--      (no solo negocio_config — §7 Fase 1, corrección #3).
--   8. Verificaciones que abortan la transacción si el backfill quedó incompleto.
--
-- DÓNDE CORRER:
--   1. Staging primero. Validar.
--   2. Soak 24h en staging sin issues.
--   3. Producción. Soak 24h antes de Fase 2.
--
-- IMPACTO EN LA APP EN PRODUCCIÓN:
--   Ninguno. La app sigue usando user_id y las tablas viejas. Las nuevas
--   tablas existen pero no se consultan desde el frontend hasta Fase 4.
--
-- IDEMPOTENTE:
--   Parcial. Tablas/índices: `if not exists`. Funciones: `create or replace`.
--   Policies y tipo: bloques `do $$ ... exception when duplicate_object end $$`.
--   Backfill: `on conflict do nothing`. Re-ejecución segura.
--
-- ROLLBACK: ver final del archivo.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────────────────
-- 1. Tipo enum
-- ────────────────────────────────────────────────────────────────────────

do $$ begin
  create type rol_negocio as enum ('owner','admin','vendedor','visualizador');
exception when duplicate_object then null;
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- 2. Tablas
-- ────────────────────────────────────────────────────────────────────────

create table if not exists negocios (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  owner_id     uuid not null references auth.users(id) on delete restrict,
  trial_hasta  date,
  created_at   timestamptz default now(),
  archived_at  timestamptz
);

create index if not exists negocios_owner_id_idx on negocios(owner_id);

create table if not exists negocio_members (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references negocios(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  rol            rol_negocio not null,
  activo         boolean not null default true,
  invited_by     uuid references auth.users(id) on delete set null,
  joined_at      timestamptz default now(),
  deactivated_at timestamptz,
  unique (negocio_id, user_id)
);

create index if not exists negocio_members_user_idx
  on negocio_members(user_id) where activo;

create index if not exists negocio_members_negocio_idx
  on negocio_members(negocio_id) where activo;

create table if not exists invitaciones (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references negocios(id) on delete cascade,
  email       text not null,
  rol         rol_negocio not null,
  token       text not null unique,
  invited_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);

create index if not exists invitaciones_token_idx
  on invitaciones(token) where accepted_at is null;

create index if not exists invitaciones_email_idx
  on invitaciones(lower(email));

-- ────────────────────────────────────────────────────────────────────────
-- 3. Funciones helper (NO is_suscripcion_activa — esa va en Fase 3)
-- ────────────────────────────────────────────────────────────────────────

-- Lee active_negocio_id del JWT (user_metadata o top-level) y lo VALIDA contra
-- membresía activa. El claim viene de auth.users.raw_user_meta_data que el
-- propio usuario puede editar vía supabase.auth.updateUser, así que jamás se
-- acepta a ciegas. Si la validación falla, cae al primer negocio activo
-- (orden estable por joined_at). Ver docs/plan-rls-multitenant.md §2.4 / §4.1.
create or replace function mi_negocio_id()
returns uuid
language sql stable security definer set search_path = public, pg_catalog
as $$
  with claimed as (
    select nullif(
      coalesce(
        auth.jwt() -> 'user_metadata' ->> 'active_negocio_id',
        auth.jwt() ->> 'active_negocio_id'
      ), ''
    )::uuid as id
  ),
  validated as (
    select c.id from claimed c
     where c.id is not null
       and exists (
         select 1 from negocio_members
          where user_id = auth.uid() and negocio_id = c.id and activo
       )
  )
  select coalesce(
    (select id from validated),
    (select negocio_id from negocio_members
      where user_id = auth.uid() and activo
      order by joined_at
      limit 1)
  );
$$;

create or replace function es_miembro(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$
  select exists(
    select 1 from negocio_members
     where user_id = auth.uid() and negocio_id = p_negocio_id and activo
  );
$$;

create or replace function mi_rol_en(p_negocio_id uuid)
returns rol_negocio
language sql stable security definer set search_path = public, pg_catalog
as $$
  select rol from negocio_members
   where user_id = auth.uid() and negocio_id = p_negocio_id and activo
   limit 1;
$$;

create or replace function puede_leer(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$ select es_miembro(p_negocio_id); $$;

create or replace function puede_escribir(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$ select mi_rol_en(p_negocio_id) in ('owner','admin','vendedor'); $$;

create or replace function puede_eliminar(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$ select mi_rol_en(p_negocio_id) in ('owner','admin'); $$;

create or replace function puede_administrar(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$ select mi_rol_en(p_negocio_id) in ('owner','admin'); $$;

create or replace function es_owner(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$ select mi_rol_en(p_negocio_id) = 'owner'; $$;

-- ────────────────────────────────────────────────────────────────────────
-- 4. RLS + policies en las 3 tablas nuevas (regla §7.0: mismo BEGIN)
-- ────────────────────────────────────────────────────────────────────────

alter table negocios        enable row level security;
alter table negocio_members enable row level security;
alter table invitaciones    enable row level security;

-- ── negocios ──────────────────────────────────────────────
do $$ begin
  create policy negocios_select on negocios
    for select using (es_miembro(id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy negocios_update on negocios
    for update
    using (puede_administrar(id))
    with check (puede_administrar(id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy negocios_delete on negocios
    for delete using (es_owner(id));
exception when duplicate_object then null; end $$;

-- (sin policy INSERT: solo via trigger on_auth_user_created, security definer)

-- ── negocio_members ───────────────────────────────────────
do $$ begin
  create policy members_select on negocio_members
    for select using (es_miembro(negocio_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy members_insert on negocio_members
    for insert with check (puede_administrar(negocio_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy members_update on negocio_members
    for update
    using (puede_administrar(negocio_id))
    with check (puede_administrar(negocio_id) and rol <> 'owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy members_delete on negocio_members
    for delete using (puede_administrar(negocio_id) and rol <> 'owner');
exception when duplicate_object then null; end $$;

-- ── invitaciones ──────────────────────────────────────────
do $$ begin
  create policy invit_select on invitaciones
    for select using (invited_by = auth.uid() or puede_administrar(negocio_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy invit_insert on invitaciones
    for insert with check (puede_administrar(negocio_id) and invited_by = auth.uid());
exception when duplicate_object then null; end $$;

-- (sin policy UPDATE: solo via rpc accept_invitation, security definer)

do $$ begin
  create policy invit_delete on invitaciones
    for delete using (invited_by = auth.uid() or puede_administrar(negocio_id));
exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────────────────
-- 5. RPC: accept_invitation
-- ────────────────────────────────────────────────────────────────────────

create or replace function accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_invit invitaciones;
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'no autenticado';
  end if;

  select * into v_invit from invitaciones
   where token = p_token and accepted_at is null and expires_at > now()
   for update;

  if v_invit is null then
    raise exception 'invitación inválida o expirada';
  end if;

  if lower(v_invit.email) <> lower(v_email) then
    raise exception 'esta invitación es para otro email';
  end if;

  insert into negocio_members (negocio_id, user_id, rol, invited_by)
       values (v_invit.negocio_id, auth.uid(), v_invit.rol, v_invit.invited_by)
       on conflict (negocio_id, user_id)
       do update set rol = excluded.rol, activo = true, deactivated_at = null;

  update invitaciones
     set accepted_at = now(), accepted_by = auth.uid()
   where id = v_invit.id;

  return v_invit.negocio_id;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 6. Trigger: on_auth_user_created (signup self-service)
--
-- IMPORTANTE: en Fase 1, suscripciones todavía usa user_id (no negocio_id).
-- El trigger inserta usando el schema viejo. En Fase 2 se agrega negocio_id a
-- suscripciones y el trigger se reescribe para llenarlo también.
-- ────────────────────────────────────────────────────────────────────────

create or replace function on_auth_user_created()
returns trigger
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_negocio_id uuid;
begin
  -- Si el user llega vía invitación pending para su email, no autocreamos.
  if exists(
    select 1 from invitaciones
     where lower(email) = lower(new.email) and accepted_at is null
  ) then
    return new;
  end if;

  insert into negocios (nombre, owner_id, trial_hasta)
       values ('Mi Negocio', new.id, current_date + interval '14 days')
    returning id into v_negocio_id;

  insert into negocio_members (negocio_id, user_id, rol)
       values (v_negocio_id, new.id, 'owner');

  -- Suscripción de trial. Schema actual (Fase 1): user_id, no negocio_id.
  -- on conflict por si la app ya la creó manualmente.
  insert into suscripciones (user_id, user_email, estado, fecha_inicio, fecha_vencimiento)
       values (new.id, new.email, 'prueba', current_date, current_date + interval '14 days')
       on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function on_auth_user_created();

-- ────────────────────────────────────────────────────────────────────────
-- 7. Backfill — UNION de distinct user_id sobre TODAS las tablas de datos
-- ────────────────────────────────────────────────────────────────────────

create temporary table _owners_detectados (user_id uuid primary key) on commit drop;

insert into _owners_detectados (user_id)
  select user_id from negocio_config              where user_id is not null union
  select user_id from clientes                    where user_id is not null union
  select user_id from productos                   where user_id is not null union
  select user_id from pedidos                     where user_id is not null union
  select user_id from gastos                      where user_id is not null union
  select user_id from categorias                  where user_id is not null union
  select user_id from alertas_config              where user_id is not null union
  select user_id from suscripciones               where user_id is not null union
  select user_id from devoluciones                where user_id is not null union
  select user_id from comunicaciones              where user_id is not null union
  select user_id from productos_precio_historial  where user_id is not null union
  select user_id from pedidos_recurrentes         where user_id is not null union
  select user_id from proveedores                 where user_id is not null union
  select user_id from ordenes_compra              where user_id is not null;

-- Truco: reusamos user_id como id del negocio para que el backfill de Fase 2
-- (negocio_id := user_id) sea 1-a-1 sin tabla de mapeo intermedia.
insert into negocios (id, nombre, owner_id)
  select o.user_id,
         coalesce(
           (select nombre from negocio_config nc where nc.user_id = o.user_id),
           'Mi Negocio'
         ),
         o.user_id
    from _owners_detectados o
  on conflict (id) do nothing;

insert into negocio_members (negocio_id, user_id, rol)
  select n.id, n.owner_id, 'owner'
    from negocios n
  on conflict (negocio_id, user_id) do nothing;

-- allowed_emails: solo si la tabla existe (no está en supabase_schema.sql,
-- pero sí en producción según relevamiento §1.3 del plan).
do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'allowed_emails'
  ) then
    execute $sql$
      insert into negocio_members (negocio_id, user_id, rol)
        select ae.owner_user_id,
               u.id,
               (case ae.rol
                  when 'admin'    then 'admin'::rol_negocio
                  when 'vendedor' then 'vendedor'::rol_negocio
                  else 'visualizador'::rol_negocio
                end)
          from allowed_emails ae
          join auth.users u on lower(u.email) = lower(ae.email)
         where ae.is_owner = false
           and exists (select 1 from negocios n where n.id = ae.owner_user_id)
        on conflict (negocio_id, user_id) do nothing
    $sql$;
    raise notice 'backfill desde allowed_emails ejecutado';
  else
    raise notice 'allowed_emails no existe — salteando backfill de members no-owner';
  end if;
end $$;

-- team_members: equivalente alternativo mencionado en contexto.md. Si existe,
-- backfilear también. Estructura asumida: (id, owner_id, member_email, role).
do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'team_members'
  ) then
    execute $sql$
      insert into negocio_members (negocio_id, user_id, rol)
        select tm.owner_id,
               u.id,
               (case tm.role
                  when 'admin'    then 'admin'::rol_negocio
                  when 'vendedor' then 'vendedor'::rol_negocio
                  else 'visualizador'::rol_negocio
                end)
          from team_members tm
          join auth.users u on lower(u.email) = lower(tm.member_email)
         where exists (select 1 from negocios n where n.id = tm.owner_id)
        on conflict (negocio_id, user_id) do nothing
    $sql$;
    raise notice 'backfill desde team_members ejecutado';
  else
    raise notice 'team_members no existe — saltando';
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- 8. Verificaciones post-backfill (abortan la tx si algo quedó incompleto)
-- ────────────────────────────────────────────────────────────────────────

do $$
declare
  v_huerfanos int;
  v_muestra   uuid;
begin
  select count(*), min(o.user_id)
    into v_huerfanos, v_muestra
    from _owners_detectados o
   where not exists (select 1 from negocios where id = o.user_id);

  if v_huerfanos > 0 then
    raise exception
      'Backfill incompleto: % owner(s) con datos quedaron sin negocio. Muestra: %',
      v_huerfanos, v_muestra;
  end if;
end $$;

do $$
declare
  v_negocios_sin_owner int;
begin
  select count(*) into v_negocios_sin_owner
    from negocios n
   where not exists (
     select 1 from negocio_members m
      where m.negocio_id = n.id
        and m.user_id = n.owner_id
        and m.rol = 'owner'
        and m.activo
   );

  if v_negocios_sin_owner > 0 then
    raise exception
      'Backfill incompleto: % negocio(s) sin miembro owner activo.', v_negocios_sin_owner;
  end if;
end $$;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- VALIDACIÓN MANUAL POST-DEPLOY
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. Conteos básicos (deben ser > 0 si había datos en prod):
--    select count(*) from negocios;
--    select count(*) from negocio_members where rol = 'owner' and activo;
--
-- 2. Cada negocio tiene exactamente 1 owner activo:
--    select n.id, count(m.id) as owners
--      from negocios n
--      join negocio_members m on m.negocio_id = n.id
--                            and m.rol = 'owner' and m.activo
--      group by n.id
--     having count(m.id) <> 1;
--    -- (debe devolver 0 filas)
--
-- 3. Distribución de miembros por negocio:
--    select n.id, n.nombre, count(m.id) as miembros
--      from negocios n
--      left join negocio_members m on m.negocio_id = n.id and m.activo
--     group by n.id, n.nombre
--     order by miembros desc
--     limit 20;
--
-- 4. Smoke test del trigger: crear un usuario test desde Supabase Dashboard
--    Authentication → Users → Add User. Confirmar que aparezcan automáticamente:
--      - 1 fila en negocios con owner_id = nuevo user.id
--      - 1 fila en negocio_members rol=owner para ese user
--      - 1 fila en suscripciones estado='prueba' para ese user
--    Después borrar el usuario test.
--
-- 5. Smoke test del helper:
--    set local role authenticated;
--    set local "request.jwt.claim.sub" = '<uuid-de-un-owner-existente>';
--    select mi_negocio_id();
--    -- debe devolver el uuid del negocio del owner
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK 002_phase1_tenancy.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Restaura el estado previo a Fase 1. Orden importante: trigger → funciones
-- que usan helper functions → policies → helper functions → tablas → tipo.
--
-- ⚠ DECIDIR ANTES: ¿qué hacer con las suscripciones de trial creadas por el
--   trigger durante el período de Fase 1? Son válidas en el schema viejo
--   (tienen user_id), así que NO se borran automáticamente. Si querés
--   borrarlas explícitamente, agregar antes del rollback:
--     delete from suscripciones
--      where estado = 'prueba'
--        and created_at >= '<timestamp-de-deploy-de-fase-1>';
--
-- begin;
--
--   -- 1. Trigger y sus funciones
--   drop trigger   if exists trg_on_auth_user_created on auth.users;
--   drop function  if exists on_auth_user_created();
--   drop function  if exists accept_invitation(text);
--
--   -- 2. Policies (antes de dropear helper functions que referencian)
--   drop policy if exists invit_delete     on invitaciones;
--   drop policy if exists invit_insert     on invitaciones;
--   drop policy if exists invit_select     on invitaciones;
--   drop policy if exists members_delete   on negocio_members;
--   drop policy if exists members_update   on negocio_members;
--   drop policy if exists members_insert   on negocio_members;
--   drop policy if exists members_select   on negocio_members;
--   drop policy if exists negocios_delete  on negocios;
--   drop policy if exists negocios_update  on negocios;
--   drop policy if exists negocios_select  on negocios;
--
--   -- 3. Helper functions
--   drop function if exists es_owner(uuid);
--   drop function if exists puede_administrar(uuid);
--   drop function if exists puede_eliminar(uuid);
--   drop function if exists puede_escribir(uuid);
--   drop function if exists puede_leer(uuid);
--   drop function if exists mi_rol_en(uuid);
--   drop function if exists es_miembro(uuid);
--   drop function if exists mi_negocio_id();
--
--   -- 4. Tablas (orden inverso a las FK)
--   drop table if exists invitaciones;
--   drop table if exists negocio_members;
--   drop table if exists negocios;
--
--   -- 5. Tipo enum
--   drop type if exists rol_negocio;
--
-- commit;
-- ═══════════════════════════════════════════════════════════════════════════
