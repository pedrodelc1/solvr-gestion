-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 — Agregar negocio_id nullable + backfill en tablas de datos
-- Solvr Gestión — plan: docs/plan-rls-multitenant.md §7 Fase 2
--
-- QUÉ HACE:
--   1. Agrega columna negocio_id uuid references negocios(id) (nullable) en
--      las 14 tablas de datos con user_id directo.
--   2. Agrega negocio_id también en las 3 tablas hijo (pedido_items,
--      devolucion_items, ordenes_compra_items) como desnormalización para que
--      las policies de Fase 3 no necesiten joins innecesarios.
--   3. Crea índice (negocio_id) en cada tabla.
--   4. Backfill: negocio_id = user_id en tablas directas (Fase 1 usó user_id
--      como id del negocio, así que la igualación es directa).
--   5. Backfill de tablas hijo desde la tabla padre.
--   6. Validaciones: count(*) where negocio_id is null = 0 en todas las tablas.
--   7. Crea trigger set_negocio_id_default (BEFORE INSERT) en cada tabla de datos.
--
-- PREREQUISITO: Fase 1 ejecutada (negocios, negocio_members, funciones helper).
--
-- DÓNDE CORRER:
--   1. Staging primero. Validar.
--   2. Soak 24h en staging sin issues.
--   3. Producción. Soak 24h antes de Fase 3.
--
-- IMPACTO EN LA APP EN PRODUCCIÓN:
--   Ninguno. Las columnas son nullable; el frontend no las menciona hasta
--   Fase 4. Los triggers auto-completan el valor en inserts nuevos.
--
-- IDEMPOTENTE:
--   Las columnas e índices usan IF NOT EXISTS.
--   El backfill usa WHERE negocio_id IS NULL (seguro re-ejecutar).
--   Los triggers usan CREATE OR REPLACE + DROP IF EXISTS antes de crear.
--   Las validaciones solo leen.
--
-- ROLLBACK: ver final del archivo.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ────────────────────────────────────────────────────────────────────────
-- 1. Agregar negocio_id a tablas de datos con user_id directo
-- ────────────────────────────────────────────────────────────────────────

alter table clientes
  add column if not exists negocio_id uuid references negocios(id);

alter table productos
  add column if not exists negocio_id uuid references negocios(id);

alter table pedidos
  add column if not exists negocio_id uuid references negocios(id);

alter table gastos
  add column if not exists negocio_id uuid references negocios(id);

alter table categorias
  add column if not exists negocio_id uuid references negocios(id);

alter table alertas_config
  add column if not exists negocio_id uuid references negocios(id);

alter table suscripciones
  add column if not exists negocio_id uuid references negocios(id);

alter table negocio_config
  add column if not exists negocio_id uuid references negocios(id);

alter table devoluciones
  add column if not exists negocio_id uuid references negocios(id);

alter table comunicaciones
  add column if not exists negocio_id uuid references negocios(id);

alter table productos_precio_historial
  add column if not exists negocio_id uuid references negocios(id);

alter table pedidos_recurrentes
  add column if not exists negocio_id uuid references negocios(id);

alter table proveedores
  add column if not exists negocio_id uuid references negocios(id);

alter table ordenes_compra
  add column if not exists negocio_id uuid references negocios(id);

-- ────────────────────────────────────────────────────────────────────────
-- 2. Agregar negocio_id a tablas hijo (desnormalización para las policies _v2)
-- ────────────────────────────────────────────────────────────────────────

alter table pedido_items
  add column if not exists negocio_id uuid references negocios(id);

alter table devolucion_items
  add column if not exists negocio_id uuid references negocios(id);

alter table ordenes_compra_items
  add column if not exists negocio_id uuid references negocios(id);

-- ────────────────────────────────────────────────────────────────────────
-- 3. Índices
-- ────────────────────────────────────────────────────────────────────────

create index if not exists clientes_negocio_idx
  on clientes(negocio_id);

create index if not exists productos_negocio_idx
  on productos(negocio_id);

create index if not exists pedidos_negocio_idx
  on pedidos(negocio_id);

create index if not exists gastos_negocio_idx
  on gastos(negocio_id);

create index if not exists categorias_negocio_idx
  on categorias(negocio_id);

create index if not exists alertas_config_negocio_idx
  on alertas_config(negocio_id);

create index if not exists suscripciones_negocio_idx
  on suscripciones(negocio_id);

create index if not exists negocio_config_negocio_idx
  on negocio_config(negocio_id);

create index if not exists devoluciones_negocio_idx
  on devoluciones(negocio_id);

create index if not exists comunicaciones_negocio_idx
  on comunicaciones(negocio_id);

create index if not exists productos_precio_historial_negocio_idx
  on productos_precio_historial(negocio_id);

create index if not exists pedidos_recurrentes_negocio_idx
  on pedidos_recurrentes(negocio_id);

create index if not exists proveedores_negocio_idx
  on proveedores(negocio_id);

create index if not exists ordenes_compra_negocio_idx
  on ordenes_compra(negocio_id);

create index if not exists pedido_items_negocio_idx
  on pedido_items(negocio_id);

create index if not exists devolucion_items_negocio_idx
  on devolucion_items(negocio_id);

create index if not exists ordenes_compra_items_negocio_idx
  on ordenes_compra_items(negocio_id);

-- ────────────────────────────────────────────────────────────────────────
-- 4. Backfill tablas directas: negocio_id = user_id
-- (Fase 1 creó negocios con id = user_id, la igualación es exacta)
-- ────────────────────────────────────────────────────────────────────────

update clientes
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

update productos
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

update pedidos
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

update gastos
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

update categorias
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

update alertas_config
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

update suscripciones
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

update negocio_config
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

update devoluciones
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

update comunicaciones
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

update productos_precio_historial
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

update pedidos_recurrentes
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

update proveedores
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

update ordenes_compra
  set negocio_id = user_id
  where negocio_id is null and user_id is not null;

-- ────────────────────────────────────────────────────────────────────────
-- 5. Backfill tablas hijo (desde el padre ya backfilleado)
-- ────────────────────────────────────────────────────────────────────────

update pedido_items pi
  set negocio_id = p.negocio_id
  from pedidos p
  where pi.pedido_id = p.id
    and pi.negocio_id is null
    and p.negocio_id is not null;

update devolucion_items di
  set negocio_id = d.negocio_id
  from devoluciones d
  where di.devolucion_id = d.id
    and di.negocio_id is null
    and d.negocio_id is not null;

update ordenes_compra_items oci
  set negocio_id = oc.negocio_id
  from ordenes_compra oc
  where oci.orden_id = oc.id
    and oci.negocio_id is null
    and oc.negocio_id is not null;

-- ────────────────────────────────────────────────────────────────────────
-- 6. Validaciones: abortar si quedó algún null en una tabla con datos
-- ────────────────────────────────────────────────────────────────────────

do $$
declare
  v_tabla text;
  v_nulls bigint;
begin
  foreach v_tabla in array array[
    'clientes','productos','pedidos','gastos','categorias',
    'alertas_config','suscripciones','negocio_config','devoluciones',
    'comunicaciones','productos_precio_historial','pedidos_recurrentes',
    'proveedores','ordenes_compra',
    'pedido_items','devolucion_items','ordenes_compra_items'
  ] loop
    execute format(
      'select count(*) from %I where negocio_id is null',
      v_tabla
    ) into v_nulls;

    if v_nulls > 0 then
      raise exception
        'Backfill incompleto: tabla % tiene % fila(s) con negocio_id IS NULL.',
        v_tabla, v_nulls;
    end if;
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- 7. Trigger set_negocio_id_default en cada tabla de datos
-- Permite que el frontend haga INSERT sin pasar negocio_id; el trigger
-- lo completa con mi_negocio_id() del usuario autenticado.
-- ────────────────────────────────────────────────────────────────────────

create or replace function set_negocio_id_default()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.negocio_id is null then
    new.negocio_id := mi_negocio_id();
  end if;
  return new;
end;
$$;

-- Tablas directas
drop trigger if exists clientes_set_negocio on clientes;
create trigger clientes_set_negocio
  before insert on clientes
  for each row execute function set_negocio_id_default();

drop trigger if exists productos_set_negocio on productos;
create trigger productos_set_negocio
  before insert on productos
  for each row execute function set_negocio_id_default();

drop trigger if exists pedidos_set_negocio on pedidos;
create trigger pedidos_set_negocio
  before insert on pedidos
  for each row execute function set_negocio_id_default();

drop trigger if exists gastos_set_negocio on gastos;
create trigger gastos_set_negocio
  before insert on gastos
  for each row execute function set_negocio_id_default();

drop trigger if exists categorias_set_negocio on categorias;
create trigger categorias_set_negocio
  before insert on categorias
  for each row execute function set_negocio_id_default();

drop trigger if exists alertas_config_set_negocio on alertas_config;
create trigger alertas_config_set_negocio
  before insert on alertas_config
  for each row execute function set_negocio_id_default();

drop trigger if exists suscripciones_set_negocio on suscripciones;
create trigger suscripciones_set_negocio
  before insert on suscripciones
  for each row execute function set_negocio_id_default();

drop trigger if exists negocio_config_set_negocio on negocio_config;
create trigger negocio_config_set_negocio
  before insert on negocio_config
  for each row execute function set_negocio_id_default();

drop trigger if exists devoluciones_set_negocio on devoluciones;
create trigger devoluciones_set_negocio
  before insert on devoluciones
  for each row execute function set_negocio_id_default();

drop trigger if exists comunicaciones_set_negocio on comunicaciones;
create trigger comunicaciones_set_negocio
  before insert on comunicaciones
  for each row execute function set_negocio_id_default();

drop trigger if exists productos_precio_historial_set_negocio on productos_precio_historial;
create trigger productos_precio_historial_set_negocio
  before insert on productos_precio_historial
  for each row execute function set_negocio_id_default();

drop trigger if exists pedidos_recurrentes_set_negocio on pedidos_recurrentes;
create trigger pedidos_recurrentes_set_negocio
  before insert on pedidos_recurrentes
  for each row execute function set_negocio_id_default();

drop trigger if exists proveedores_set_negocio on proveedores;
create trigger proveedores_set_negocio
  before insert on proveedores
  for each row execute function set_negocio_id_default();

drop trigger if exists ordenes_compra_set_negocio on ordenes_compra;
create trigger ordenes_compra_set_negocio
  before insert on ordenes_compra
  for each row execute function set_negocio_id_default();

-- Tablas hijo: el trigger también aplica (por si el frontend crea items directamente)
drop trigger if exists pedido_items_set_negocio on pedido_items;
create trigger pedido_items_set_negocio
  before insert on pedido_items
  for each row execute function set_negocio_id_default();

drop trigger if exists devolucion_items_set_negocio on devolucion_items;
create trigger devolucion_items_set_negocio
  before insert on devolucion_items
  for each row execute function set_negocio_id_default();

drop trigger if exists ordenes_compra_items_set_negocio on ordenes_compra_items;
create trigger ordenes_compra_items_set_negocio
  before insert on ordenes_compra_items
  for each row execute function set_negocio_id_default();

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- QUERIES DE VALIDACIÓN MANUAL (correr después del commit)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Para cada tabla, el resultado debe ser 0:
--   select count(*) from clientes                    where negocio_id is null;
--   select count(*) from productos                   where negocio_id is null;
--   select count(*) from pedidos                     where negocio_id is null;
--   select count(*) from gastos                      where negocio_id is null;
--   select count(*) from categorias                  where negocio_id is null;
--   select count(*) from alertas_config              where negocio_id is null;
--   select count(*) from suscripciones               where negocio_id is null;
--   select count(*) from negocio_config              where negocio_id is null;
--   select count(*) from devoluciones                where negocio_id is null;
--   select count(*) from comunicaciones              where negocio_id is null;
--   select count(*) from productos_precio_historial  where negocio_id is null;
--   select count(*) from pedidos_recurrentes         where negocio_id is null;
--   select count(*) from proveedores                 where negocio_id is null;
--   select count(*) from ordenes_compra              where negocio_id is null;
--   select count(*) from pedido_items                where negocio_id is null;
--   select count(*) from devolucion_items            where negocio_id is null;
--   select count(*) from ordenes_compra_items        where negocio_id is null;
--
-- Verificar que el trigger funciona (simular un insert sin negocio_id):
--   set local role authenticated;
--   set local "request.jwt.claim.sub" = '<uuid-de-owner>';
--   begin;
--     insert into clientes (nombre) values ('_test_negocio_id_trigger');
--     select negocio_id from clientes where nombre = '_test_negocio_id_trigger';
--     -- debe devolver el negocio_id del owner, no null
--   rollback;
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK 003_phase2_negocio_id.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Revierte completamente la Fase 2. Orden: triggers → función → índices → columnas.
-- No se pierden datos (las columnas negocio_id son nullable y nuevas).
--
-- begin;
--
--   -- 1. Triggers
--   drop trigger if exists ordenes_compra_items_set_negocio    on ordenes_compra_items;
--   drop trigger if exists devolucion_items_set_negocio        on devolucion_items;
--   drop trigger if exists pedido_items_set_negocio            on pedido_items;
--   drop trigger if exists ordenes_compra_set_negocio          on ordenes_compra;
--   drop trigger if exists proveedores_set_negocio             on proveedores;
--   drop trigger if exists pedidos_recurrentes_set_negocio     on pedidos_recurrentes;
--   drop trigger if exists productos_precio_historial_set_negocio on productos_precio_historial;
--   drop trigger if exists comunicaciones_set_negocio          on comunicaciones;
--   drop trigger if exists devoluciones_set_negocio            on devoluciones;
--   drop trigger if exists negocio_config_set_negocio          on negocio_config;
--   drop trigger if exists suscripciones_set_negocio           on suscripciones;
--   drop trigger if exists alertas_config_set_negocio          on alertas_config;
--   drop trigger if exists categorias_set_negocio              on categorias;
--   drop trigger if exists gastos_set_negocio                  on gastos;
--   drop trigger if exists pedidos_set_negocio                 on pedidos;
--   drop trigger if exists productos_set_negocio               on productos;
--   drop trigger if exists clientes_set_negocio                on clientes;
--
--   -- 2. Función del trigger
--   drop function if exists set_negocio_id_default();
--
--   -- 3. Índices
--   drop index if exists ordenes_compra_items_negocio_idx;
--   drop index if exists devolucion_items_negocio_idx;
--   drop index if exists pedido_items_negocio_idx;
--   drop index if exists ordenes_compra_negocio_idx;
--   drop index if exists proveedores_negocio_idx;
--   drop index if exists pedidos_recurrentes_negocio_idx;
--   drop index if exists productos_precio_historial_negocio_idx;
--   drop index if exists comunicaciones_negocio_idx;
--   drop index if exists devoluciones_negocio_idx;
--   drop index if exists negocio_config_negocio_idx;
--   drop index if exists suscripciones_negocio_idx;
--   drop index if exists alertas_config_negocio_idx;
--   drop index if exists categorias_negocio_idx;
--   drop index if exists gastos_negocio_idx;
--   drop index if exists pedidos_negocio_idx;
--   drop index if exists productos_negocio_idx;
--   drop index if exists clientes_negocio_idx;
--
--   -- 4. Columnas (orden inverso al de creación no importa, pero tablas hijo primero
--   --    para evitar FK issues si se agregaran constraints en el futuro)
--   alter table ordenes_compra_items   drop column if exists negocio_id;
--   alter table devolucion_items       drop column if exists negocio_id;
--   alter table pedido_items           drop column if exists negocio_id;
--   alter table ordenes_compra         drop column if exists negocio_id;
--   alter table proveedores            drop column if exists negocio_id;
--   alter table pedidos_recurrentes    drop column if exists negocio_id;
--   alter table productos_precio_historial drop column if exists negocio_id;
--   alter table comunicaciones         drop column if exists negocio_id;
--   alter table devoluciones           drop column if exists negocio_id;
--   alter table negocio_config         drop column if exists negocio_id;
--   alter table suscripciones          drop column if exists negocio_id;
--   alter table alertas_config         drop column if exists negocio_id;
--   alter table categorias             drop column if exists negocio_id;
--   alter table gastos                 drop column if exists negocio_id;
--   alter table pedidos                drop column if exists negocio_id;
--   alter table productos              drop column if exists negocio_id;
--   alter table clientes               drop column if exists negocio_id;
--
-- commit;
-- ═══════════════════════════════════════════════════════════════════════════
