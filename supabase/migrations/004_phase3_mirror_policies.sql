-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 3 — Mirror policies (policies espejo _v2)
-- Solvr Gestión — plan: docs/plan-rls-multitenant.md §7 Fase 3
--
-- QUÉ HACE:
--   1. Crea la función is_suscripcion_activa(uuid) — gate de suscripción
--      para operaciones de escritura en tablas transaccionales.
--   2. Crea policies _v2 (que usan negocio_id) para todas las tablas de datos
--      en paralelo a las policies viejas (que usan user_id).
--   3. Habilita RLS en `planes` y crea la policy de lectura pública.
--
-- POR QUÉ NO ROMPE NADA:
--   PostgreSQL combina múltiples policies de la misma operación con OR.
--   Las viejas (auth.uid() = user_id) siguen activas. La app en producción
--   sigue funcionando exactamente igual. Las nuevas agregan un segundo camino.
--
-- IMPORTANTE — COEXISTENCIA:
--   Mientras viejas y nuevas coexistan, el gate de suscripción NO es estricto.
--   Un INSERT pasa si la política vieja lo permite, aunque la nueva lo rechace
--   por suscripción vencida. El gate se vuelve estricto en Fase 5 (drop policies
--   viejas). Esto es intencional y está documentado en §7 Fase 3 del plan.
--
-- PREREQUISITO:
--   Fases 0, 1 y 2 ejecutadas. Las columnas negocio_id ya existen en todas
--   las tablas y están backfilladas (negocio_id = user_id para todos los rows
--   existentes).
--
-- TABLAS CUBIERTAS (17 tablas de datos + 2 tablas globales):
--   Directas (negocio_id propio): clientes, productos, pedidos, gastos,
--     categorias, negocio_config, alertas_config, devoluciones, comunicaciones,
--     productos_precio_historial, pedidos_recurrentes, proveedores,
--     ordenes_compra, suscripciones
--   Hijo/desnorm (negocio_id heredado): pedido_items, devolucion_items,
--     ordenes_compra_items
--   Globales: planes
--
-- IDEMPOTENTE:
--   Cada CREATE POLICY está precedido de DROP POLICY IF EXISTS, así se puede
--   re-ejecutar sin error si algo falló a mitad del bloque anterior.
--   El bloque 0-PRE usa IF NOT EXISTS / WHERE IS NULL, por lo que también
--   es seguro re-ejecutar aunque Fase 2 ya hubiera agregado la columna.
--
-- ROLLBACK: ver sección al final del archivo.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ────────────────────────────────────────────────────────────────────────
-- 0-PRE. Prerequisito: negocio_id en TODAS las tablas de datos
-- ────────────────────────────────────────────────────────────────────────
-- Las policies y la función is_suscripcion_activa referencian negocio_id.
-- PostgreSQL resuelve columnas en funciones language sql al hacer CREATE,
-- y en policies al crearlas. Si falta la columna en cualquier tabla,
-- el CREATE falla con 42703.
-- Esta sección absorbe el trabajo de Fase 2: agrega la columna con
-- IF NOT EXISTS (idempotente si Fase 2 ya corrió) y hace el backfill.

-- Tablas con user_id directo
alter table clientes              add column if not exists negocio_id uuid references negocios(id);
alter table productos             add column if not exists negocio_id uuid references negocios(id);
alter table pedidos               add column if not exists negocio_id uuid references negocios(id);
alter table gastos                add column if not exists negocio_id uuid references negocios(id);
alter table categorias            add column if not exists negocio_id uuid references negocios(id);
alter table alertas_config        add column if not exists negocio_id uuid references negocios(id);
alter table suscripciones         add column if not exists negocio_id uuid references negocios(id);
alter table negocio_config        add column if not exists negocio_id uuid references negocios(id);
alter table devoluciones          add column if not exists negocio_id uuid references negocios(id);
alter table comunicaciones        add column if not exists negocio_id uuid references negocios(id);
alter table productos_precio_historial add column if not exists negocio_id uuid references negocios(id);
alter table pedidos_recurrentes   add column if not exists negocio_id uuid references negocios(id);
alter table proveedores           add column if not exists negocio_id uuid references negocios(id);
alter table ordenes_compra        add column if not exists negocio_id uuid references negocios(id);

-- Tablas hijo (desnormalización para evitar joins en las policies)
alter table pedido_items          add column if not exists negocio_id uuid references negocios(id);
alter table devolucion_items      add column if not exists negocio_id uuid references negocios(id);
alter table ordenes_compra_items  add column if not exists negocio_id uuid references negocios(id);

-- Índices (idempotentes)
create index if not exists clientes_negocio_idx              on clientes(negocio_id);
create index if not exists productos_negocio_idx             on productos(negocio_id);
create index if not exists pedidos_negocio_idx               on pedidos(negocio_id);
create index if not exists gastos_negocio_idx                on gastos(negocio_id);
create index if not exists categorias_negocio_idx            on categorias(negocio_id);
create index if not exists alertas_config_negocio_idx        on alertas_config(negocio_id);
create index if not exists suscripciones_negocio_idx         on suscripciones(negocio_id);
create index if not exists negocio_config_negocio_idx        on negocio_config(negocio_id);
create index if not exists devoluciones_negocio_idx          on devoluciones(negocio_id);
create index if not exists comunicaciones_negocio_idx        on comunicaciones(negocio_id);
create index if not exists productos_precio_historial_negocio_idx on productos_precio_historial(negocio_id);
create index if not exists pedidos_recurrentes_negocio_idx   on pedidos_recurrentes(negocio_id);
create index if not exists proveedores_negocio_idx           on proveedores(negocio_id);
create index if not exists ordenes_compra_negocio_idx        on ordenes_compra(negocio_id);
create index if not exists pedido_items_negocio_idx          on pedido_items(negocio_id);
create index if not exists devolucion_items_negocio_idx      on devolucion_items(negocio_id);
create index if not exists ordenes_compra_items_negocio_idx  on ordenes_compra_items(negocio_id);

-- Backfill tablas directas: negocio_id = user_id
-- (Fase 1 creó negocios con id = user_id, la igualación es exacta)
update clientes              set negocio_id = user_id where negocio_id is null and user_id is not null;
update productos             set negocio_id = user_id where negocio_id is null and user_id is not null;
update pedidos               set negocio_id = user_id where negocio_id is null and user_id is not null;
update gastos                set negocio_id = user_id where negocio_id is null and user_id is not null;
update categorias            set negocio_id = user_id where negocio_id is null and user_id is not null;
update alertas_config        set negocio_id = user_id where negocio_id is null and user_id is not null;
update suscripciones         set negocio_id = user_id where negocio_id is null and user_id is not null;
update negocio_config        set negocio_id = user_id where negocio_id is null and user_id is not null;
update devoluciones          set negocio_id = user_id where negocio_id is null and user_id is not null;
update comunicaciones        set negocio_id = user_id where negocio_id is null and user_id is not null;
update productos_precio_historial set negocio_id = user_id where negocio_id is null and user_id is not null;
update pedidos_recurrentes   set negocio_id = user_id where negocio_id is null and user_id is not null;
update proveedores           set negocio_id = user_id where negocio_id is null and user_id is not null;
update ordenes_compra        set negocio_id = user_id where negocio_id is null and user_id is not null;

-- Backfill tablas hijo desde el padre
update pedido_items pi
  set negocio_id = p.negocio_id
  from pedidos p
  where pi.pedido_id = p.id and pi.negocio_id is null and p.negocio_id is not null;

update devolucion_items di
  set negocio_id = d.negocio_id
  from devoluciones d
  where di.devolucion_id = d.id and di.negocio_id is null and d.negocio_id is not null;

update ordenes_compra_items oci
  set negocio_id = oc.negocio_id
  from ordenes_compra oc
  where oci.orden_id = oc.id and oci.negocio_id is null and oc.negocio_id is not null;

-- Trigger set_negocio_id_default (idempotente — OR REPLACE)
create or replace function set_negocio_id_default()
returns trigger language plpgsql security definer
set search_path = public, pg_catalog as $$
begin
  if new.negocio_id is null then
    new.negocio_id := mi_negocio_id();
  end if;
  return new;
end;
$$;

drop trigger if exists clientes_set_negocio             on clientes;
create trigger clientes_set_negocio             before insert on clientes             for each row execute function set_negocio_id_default();
drop trigger if exists productos_set_negocio            on productos;
create trigger productos_set_negocio            before insert on productos            for each row execute function set_negocio_id_default();
drop trigger if exists pedidos_set_negocio              on pedidos;
create trigger pedidos_set_negocio              before insert on pedidos              for each row execute function set_negocio_id_default();
drop trigger if exists gastos_set_negocio               on gastos;
create trigger gastos_set_negocio               before insert on gastos               for each row execute function set_negocio_id_default();
drop trigger if exists categorias_set_negocio           on categorias;
create trigger categorias_set_negocio           before insert on categorias           for each row execute function set_negocio_id_default();
drop trigger if exists alertas_config_set_negocio       on alertas_config;
create trigger alertas_config_set_negocio       before insert on alertas_config       for each row execute function set_negocio_id_default();
drop trigger if exists suscripciones_set_negocio        on suscripciones;
create trigger suscripciones_set_negocio        before insert on suscripciones        for each row execute function set_negocio_id_default();
drop trigger if exists negocio_config_set_negocio       on negocio_config;
create trigger negocio_config_set_negocio       before insert on negocio_config       for each row execute function set_negocio_id_default();
drop trigger if exists devoluciones_set_negocio         on devoluciones;
create trigger devoluciones_set_negocio         before insert on devoluciones         for each row execute function set_negocio_id_default();
drop trigger if exists comunicaciones_set_negocio       on comunicaciones;
create trigger comunicaciones_set_negocio       before insert on comunicaciones       for each row execute function set_negocio_id_default();
drop trigger if exists productos_precio_historial_set_negocio on productos_precio_historial;
create trigger productos_precio_historial_set_negocio before insert on productos_precio_historial for each row execute function set_negocio_id_default();
drop trigger if exists pedidos_recurrentes_set_negocio  on pedidos_recurrentes;
create trigger pedidos_recurrentes_set_negocio  before insert on pedidos_recurrentes  for each row execute function set_negocio_id_default();
drop trigger if exists proveedores_set_negocio          on proveedores;
create trigger proveedores_set_negocio          before insert on proveedores          for each row execute function set_negocio_id_default();
drop trigger if exists ordenes_compra_set_negocio       on ordenes_compra;
create trigger ordenes_compra_set_negocio       before insert on ordenes_compra       for each row execute function set_negocio_id_default();
drop trigger if exists pedido_items_set_negocio         on pedido_items;
create trigger pedido_items_set_negocio         before insert on pedido_items         for each row execute function set_negocio_id_default();
drop trigger if exists devolucion_items_set_negocio     on devolucion_items;
create trigger devolucion_items_set_negocio     before insert on devolucion_items     for each row execute function set_negocio_id_default();
drop trigger if exists ordenes_compra_items_set_negocio on ordenes_compra_items;
create trigger ordenes_compra_items_set_negocio before insert on ordenes_compra_items for each row execute function set_negocio_id_default();

-- Validación: ninguna tabla con datos debe tener negocio_id IS NULL
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
    execute format('select count(*) from %I where negocio_id is null', v_tabla) into v_nulls;
    if v_nulls > 0 then
      raise exception
        'Prerequisito fallido: % fila(s) en % con negocio_id IS NULL. '
        'Verificar que Fase 1 creó negocios para todos los user_id.', v_nulls, v_tabla;
    end if;
  end loop;
  raise notice 'OK 0-PRE: negocio_id presente y backfilleado en las 17 tablas.';
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- 0. Función is_suscripcion_activa
-- ────────────────────────────────────────────────────────────────────────
-- Gate de suscripción para INSERT/UPDATE/DELETE en tablas transaccionales.
-- SELECT está explícitamente EXCLUIDO del gate: el cliente debe poder leer
-- sus datos aún con la suscripción vencida (modo lectura forzada para que
-- pueda decidir renovar).
-- La función NO se crea en Fase 1 porque no hay policies que la consuman
-- hasta este momento (ver §2.4 del plan).

create or replace function is_suscripcion_activa(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from suscripciones
     where negocio_id = p_negocio_id
       and estado in ('prueba', 'activa')
       and (fecha_vencimiento is null or fecha_vencimiento >= current_date)
  );
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 1. clientes
-- ────────────────────────────────────────────────────────────────────────
-- Patrón: puede_leer / puede_escribir / puede_eliminar (datos transaccionales)

drop policy if exists clientes_select_v2 on clientes;
create policy clientes_select_v2 on clientes
  for select using (puede_leer(negocio_id));

drop policy if exists clientes_insert_v2 on clientes;
create policy clientes_insert_v2 on clientes
  for insert with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists clientes_update_v2 on clientes;
create policy clientes_update_v2 on clientes
  for update
  using (puede_escribir(negocio_id))
  with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists clientes_delete_v2 on clientes;
create policy clientes_delete_v2 on clientes
  for delete using (
    puede_eliminar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 2. productos
-- ────────────────────────────────────────────────────────────────────────
-- Catálogo de productos: solo owner/admin puede modificar.
-- SELECT abierto a cualquier miembro (vendedor necesita ver el catálogo).

drop policy if exists productos_select_v2 on productos;
create policy productos_select_v2 on productos
  for select using (puede_leer(negocio_id));

drop policy if exists productos_insert_v2 on productos;
create policy productos_insert_v2 on productos
  for insert with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists productos_update_v2 on productos;
create policy productos_update_v2 on productos
  for update
  using (puede_administrar(negocio_id))
  with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists productos_delete_v2 on productos;
create policy productos_delete_v2 on productos
  for delete using (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 3. pedidos
-- ────────────────────────────────────────────────────────────────────────

drop policy if exists pedidos_select_v2 on pedidos;
create policy pedidos_select_v2 on pedidos
  for select using (puede_leer(negocio_id));

drop policy if exists pedidos_insert_v2 on pedidos;
create policy pedidos_insert_v2 on pedidos
  for insert with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists pedidos_update_v2 on pedidos;
create policy pedidos_update_v2 on pedidos
  for update
  using (puede_escribir(negocio_id))
  with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists pedidos_delete_v2 on pedidos;
create policy pedidos_delete_v2 on pedidos
  for delete using (
    puede_eliminar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 4. pedido_items
-- ────────────────────────────────────────────────────────────────────────
-- negocio_id desnormalizado en Fase 2 — no se necesita join al padre.

drop policy if exists pedido_items_select_v2 on pedido_items;
create policy pedido_items_select_v2 on pedido_items
  for select using (puede_leer(negocio_id));

drop policy if exists pedido_items_insert_v2 on pedido_items;
create policy pedido_items_insert_v2 on pedido_items
  for insert with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists pedido_items_update_v2 on pedido_items;
create policy pedido_items_update_v2 on pedido_items
  for update
  using (puede_escribir(negocio_id))
  with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists pedido_items_delete_v2 on pedido_items;
create policy pedido_items_delete_v2 on pedido_items
  for delete using (
    puede_eliminar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 5. gastos
-- ────────────────────────────────────────────────────────────────────────
-- Solo owner/admin toca finanzas (puede_administrar).

drop policy if exists gastos_select_v2 on gastos;
create policy gastos_select_v2 on gastos
  for select using (puede_leer(negocio_id));

drop policy if exists gastos_insert_v2 on gastos;
create policy gastos_insert_v2 on gastos
  for insert with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists gastos_update_v2 on gastos;
create policy gastos_update_v2 on gastos
  for update
  using (puede_administrar(negocio_id))
  with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists gastos_delete_v2 on gastos;
create policy gastos_delete_v2 on gastos
  for delete using (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 6. categorias
-- ────────────────────────────────────────────────────────────────────────

drop policy if exists categorias_select_v2 on categorias;
create policy categorias_select_v2 on categorias
  for select using (puede_leer(negocio_id));

drop policy if exists categorias_insert_v2 on categorias;
create policy categorias_insert_v2 on categorias
  for insert with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists categorias_update_v2 on categorias;
create policy categorias_update_v2 on categorias
  for update
  using (puede_administrar(negocio_id))
  with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists categorias_delete_v2 on categorias;
create policy categorias_delete_v2 on categorias
  for delete using (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 7. negocio_config
-- ────────────────────────────────────────────────────────────────────────
-- DELETE solo por el owner (más restrictivo que el resto de administrar).

drop policy if exists negocio_config_select_v2 on negocio_config;
create policy negocio_config_select_v2 on negocio_config
  for select using (puede_leer(negocio_id));

drop policy if exists negocio_config_insert_v2 on negocio_config;
create policy negocio_config_insert_v2 on negocio_config
  for insert with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists negocio_config_update_v2 on negocio_config;
create policy negocio_config_update_v2 on negocio_config
  for update
  using (puede_administrar(negocio_id))
  with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists negocio_config_delete_v2 on negocio_config;
create policy negocio_config_delete_v2 on negocio_config
  for delete using (
    es_owner(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 8. alertas_config
-- ────────────────────────────────────────────────────────────────────────
-- Reemplaza el FOR ALL existente. Solo admin/owner configura alertas.

drop policy if exists alertas_config_select_v2 on alertas_config;
create policy alertas_config_select_v2 on alertas_config
  for select using (puede_leer(negocio_id));

drop policy if exists alertas_config_insert_v2 on alertas_config;
create policy alertas_config_insert_v2 on alertas_config
  for insert with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists alertas_config_update_v2 on alertas_config;
create policy alertas_config_update_v2 on alertas_config
  for update
  using (puede_administrar(negocio_id))
  with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists alertas_config_delete_v2 on alertas_config;
create policy alertas_config_delete_v2 on alertas_config
  for delete using (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 9. devoluciones
-- ────────────────────────────────────────────────────────────────────────
-- Reemplaza el FOR ALL. Vendedores pueden crear/editar; solo admin/owner elimina.

drop policy if exists devoluciones_select_v2 on devoluciones;
create policy devoluciones_select_v2 on devoluciones
  for select using (puede_leer(negocio_id));

drop policy if exists devoluciones_insert_v2 on devoluciones;
create policy devoluciones_insert_v2 on devoluciones
  for insert with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists devoluciones_update_v2 on devoluciones;
create policy devoluciones_update_v2 on devoluciones
  for update
  using (puede_escribir(negocio_id))
  with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists devoluciones_delete_v2 on devoluciones;
create policy devoluciones_delete_v2 on devoluciones
  for delete using (
    puede_eliminar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 10. devolucion_items
-- ────────────────────────────────────────────────────────────────────────
-- negocio_id desnormalizado en Fase 2. Se agrega UPDATE (faltaba en el baseline).

drop policy if exists devolucion_items_select_v2 on devolucion_items;
create policy devolucion_items_select_v2 on devolucion_items
  for select using (puede_leer(negocio_id));

drop policy if exists devolucion_items_insert_v2 on devolucion_items;
create policy devolucion_items_insert_v2 on devolucion_items
  for insert with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists devolucion_items_update_v2 on devolucion_items;
create policy devolucion_items_update_v2 on devolucion_items
  for update
  using (puede_escribir(negocio_id))
  with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists devolucion_items_delete_v2 on devolucion_items;
create policy devolucion_items_delete_v2 on devolucion_items
  for delete using (
    puede_eliminar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 11. comunicaciones
-- ────────────────────────────────────────────────────────────────────────
-- Reemplaza el FOR ALL.

drop policy if exists comunicaciones_select_v2 on comunicaciones;
create policy comunicaciones_select_v2 on comunicaciones
  for select using (puede_leer(negocio_id));

drop policy if exists comunicaciones_insert_v2 on comunicaciones;
create policy comunicaciones_insert_v2 on comunicaciones
  for insert with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists comunicaciones_update_v2 on comunicaciones;
create policy comunicaciones_update_v2 on comunicaciones
  for update
  using (puede_escribir(negocio_id))
  with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists comunicaciones_delete_v2 on comunicaciones;
create policy comunicaciones_delete_v2 on comunicaciones
  for delete using (
    puede_eliminar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 12. productos_precio_historial
-- ────────────────────────────────────────────────────────────────────────
-- Reemplaza el FOR ALL. Auditoría de precios: solo admin/owner modifica.

drop policy if exists precio_historial_select_v2 on productos_precio_historial;
create policy precio_historial_select_v2 on productos_precio_historial
  for select using (puede_leer(negocio_id));

drop policy if exists precio_historial_insert_v2 on productos_precio_historial;
create policy precio_historial_insert_v2 on productos_precio_historial
  for insert with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists precio_historial_update_v2 on productos_precio_historial;
create policy precio_historial_update_v2 on productos_precio_historial
  for update
  using (puede_administrar(negocio_id))
  with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists precio_historial_delete_v2 on productos_precio_historial;
create policy precio_historial_delete_v2 on productos_precio_historial
  for delete using (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 13. pedidos_recurrentes
-- ────────────────────────────────────────────────────────────────────────
-- Reemplaza el FOR ALL.

drop policy if exists recurrentes_select_v2 on pedidos_recurrentes;
create policy recurrentes_select_v2 on pedidos_recurrentes
  for select using (puede_leer(negocio_id));

drop policy if exists recurrentes_insert_v2 on pedidos_recurrentes;
create policy recurrentes_insert_v2 on pedidos_recurrentes
  for insert with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists recurrentes_update_v2 on pedidos_recurrentes;
create policy recurrentes_update_v2 on pedidos_recurrentes
  for update
  using (puede_administrar(negocio_id))
  with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists recurrentes_delete_v2 on pedidos_recurrentes;
create policy recurrentes_delete_v2 on pedidos_recurrentes
  for delete using (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 14. proveedores
-- ────────────────────────────────────────────────────────────────────────
-- Reemplaza el FOR ALL.

drop policy if exists proveedores_select_v2 on proveedores;
create policy proveedores_select_v2 on proveedores
  for select using (puede_leer(negocio_id));

drop policy if exists proveedores_insert_v2 on proveedores;
create policy proveedores_insert_v2 on proveedores
  for insert with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists proveedores_update_v2 on proveedores;
create policy proveedores_update_v2 on proveedores
  for update
  using (puede_administrar(negocio_id))
  with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists proveedores_delete_v2 on proveedores;
create policy proveedores_delete_v2 on proveedores
  for delete using (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 15. ordenes_compra
-- ────────────────────────────────────────────────────────────────────────
-- Reemplaza el FOR ALL.

drop policy if exists ordenes_compra_select_v2 on ordenes_compra;
create policy ordenes_compra_select_v2 on ordenes_compra
  for select using (puede_leer(negocio_id));

drop policy if exists ordenes_compra_insert_v2 on ordenes_compra;
create policy ordenes_compra_insert_v2 on ordenes_compra
  for insert with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists ordenes_compra_update_v2 on ordenes_compra;
create policy ordenes_compra_update_v2 on ordenes_compra
  for update
  using (puede_administrar(negocio_id))
  with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists ordenes_compra_delete_v2 on ordenes_compra;
create policy ordenes_compra_delete_v2 on ordenes_compra
  for delete using (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 16. ordenes_compra_items
-- ────────────────────────────────────────────────────────────────────────
-- negocio_id desnormalizado en Fase 2. Se agrega UPDATE (faltaba en el baseline).

drop policy if exists oc_items_select_v2 on ordenes_compra_items;
create policy oc_items_select_v2 on ordenes_compra_items
  for select using (puede_leer(negocio_id));

drop policy if exists oc_items_insert_v2 on ordenes_compra_items;
create policy oc_items_insert_v2 on ordenes_compra_items
  for insert with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists oc_items_update_v2 on ordenes_compra_items;
create policy oc_items_update_v2 on ordenes_compra_items
  for update
  using (puede_administrar(negocio_id))
  with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists oc_items_delete_v2 on ordenes_compra_items;
create policy oc_items_delete_v2 on ordenes_compra_items
  for delete using (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- ────────────────────────────────────────────────────────────────────────
-- 17. suscripciones
-- ────────────────────────────────────────────────────────────────────────
-- EXENTA del gate (el webhook de Mercado Pago necesita escribir sin JWT).
-- Solo se crea policy de SELECT. INSERT/UPDATE/DELETE siguen siendo solo
-- para service_role (sin policy authenticated = deny by default).

drop policy if exists suscripciones_select_v2 on suscripciones;
create policy suscripciones_select_v2 on suscripciones
  for select using (es_miembro(negocio_id));

-- ────────────────────────────────────────────────────────────────────────
-- 18. planes (tabla global — no es por tenant)
-- ────────────────────────────────────────────────────────────────────────
-- Se habilita RLS y se crea la policy de lectura pública para authenticated.
-- CRÍTICO: habilitar RLS sin policy de SELECT deja la tabla inaccesible.
-- Ambas operaciones van en la misma transacción.

alter table planes enable row level security;

drop policy if exists planes_select on planes;
create policy planes_select on planes
  for select using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────────────────
-- Validación inline: contar policies _v2 creadas
-- ────────────────────────────────────────────────────────────────────────

do $$
declare
  v_count int;
  v_esperadas int := 61;
  -- Desglose esperado:
  --   clientes(4) + productos(4) + pedidos(4) + pedido_items(4)
  -- + gastos(4) + categorias(4) + negocio_config(4) + alertas_config(4)
  -- + devoluciones(4) + devolucion_items(4) + comunicaciones(4)
  -- + precio_historial(4) + recurrentes(4) + proveedores(4)
  -- + ordenes_compra(4) + ordenes_compra_items(4) + suscripciones(1)
  -- + planes(1) = 65 total
  -- Ajuste: suscripciones solo SELECT (1), planes solo SELECT (1),
  --         resto 4 × 16 tablas = 64 + 1 + 1 = 66.
  -- Corrección: 16 tablas × 4 = 64 + suscripciones(1) + planes(1) = 66
begin
  v_esperadas := 66;

  select count(*) into v_count
    from pg_policies
   where schemaname = 'public'
     and (policyname like '%_v2' or policyname = 'planes_select');

  if v_count < v_esperadas then
    raise exception
      'Validación fallida: se esperaban >= % policies _v2 / planes_select, se encontraron %. '
      'Verificar que todas las tablas tienen sus 4 policies (o 1 para suscripciones/planes).',
      v_esperadas, v_count;
  end if;

  raise notice 'OK: % policies _v2 + planes_select creadas (esperadas >= %).', v_count, v_esperadas;
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- Validación inline: is_suscripcion_activa existe y es stable security definer
-- ────────────────────────────────────────────────────────────────────────

do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'is_suscripcion_activa'
     and p.prosecdef = true;

  if v_count = 0 then
    raise exception 'Validación fallida: función is_suscripcion_activa no encontrada o no es security definer.';
  end if;

  raise notice 'OK: función is_suscripcion_activa presente (security definer).';
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- Validación inline: planes tiene RLS habilitado
-- ────────────────────────────────────────────────────────────────────────

do $$
declare
  v_rls_enabled bool;
begin
  select relrowsecurity into v_rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'planes';

  if not v_rls_enabled then
    raise exception 'Validación fallida: RLS no habilitado en tabla planes.';
  end if;

  raise notice 'OK: planes tiene RLS habilitado.';
end $$;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK FASE 3
-- ═══════════════════════════════════════════════════════════════════════════
-- Copiar y ejecutar en SQL Editor para revertir todo lo que hizo esta fase.
-- La app vuelve a funcionar solo con las policies viejas (user_id).
--
-- begin;
--
-- -- Drop function
-- drop function if exists is_suscripcion_activa(uuid);
--
-- -- Drop all _v2 policies
-- drop policy if exists clientes_select_v2 on clientes;
-- drop policy if exists clientes_insert_v2 on clientes;
-- drop policy if exists clientes_update_v2 on clientes;
-- drop policy if exists clientes_delete_v2 on clientes;
--
-- drop policy if exists productos_select_v2 on productos;
-- drop policy if exists productos_insert_v2 on productos;
-- drop policy if exists productos_update_v2 on productos;
-- drop policy if exists productos_delete_v2 on productos;
--
-- drop policy if exists pedidos_select_v2 on pedidos;
-- drop policy if exists pedidos_insert_v2 on pedidos;
-- drop policy if exists pedidos_update_v2 on pedidos;
-- drop policy if exists pedidos_delete_v2 on pedidos;
--
-- drop policy if exists pedido_items_select_v2 on pedido_items;
-- drop policy if exists pedido_items_insert_v2 on pedido_items;
-- drop policy if exists pedido_items_update_v2 on pedido_items;
-- drop policy if exists pedido_items_delete_v2 on pedido_items;
--
-- drop policy if exists gastos_select_v2 on gastos;
-- drop policy if exists gastos_insert_v2 on gastos;
-- drop policy if exists gastos_update_v2 on gastos;
-- drop policy if exists gastos_delete_v2 on gastos;
--
-- drop policy if exists categorias_select_v2 on categorias;
-- drop policy if exists categorias_insert_v2 on categorias;
-- drop policy if exists categorias_update_v2 on categorias;
-- drop policy if exists categorias_delete_v2 on categorias;
--
-- drop policy if exists negocio_config_select_v2 on negocio_config;
-- drop policy if exists negocio_config_insert_v2 on negocio_config;
-- drop policy if exists negocio_config_update_v2 on negocio_config;
-- drop policy if exists negocio_config_delete_v2 on negocio_config;
--
-- drop policy if exists alertas_config_select_v2 on alertas_config;
-- drop policy if exists alertas_config_insert_v2 on alertas_config;
-- drop policy if exists alertas_config_update_v2 on alertas_config;
-- drop policy if exists alertas_config_delete_v2 on alertas_config;
--
-- drop policy if exists devoluciones_select_v2 on devoluciones;
-- drop policy if exists devoluciones_insert_v2 on devoluciones;
-- drop policy if exists devoluciones_update_v2 on devoluciones;
-- drop policy if exists devoluciones_delete_v2 on devoluciones;
--
-- drop policy if exists devolucion_items_select_v2 on devolucion_items;
-- drop policy if exists devolucion_items_insert_v2 on devolucion_items;
-- drop policy if exists devolucion_items_update_v2 on devolucion_items;
-- drop policy if exists devolucion_items_delete_v2 on devolucion_items;
--
-- drop policy if exists comunicaciones_select_v2 on comunicaciones;
-- drop policy if exists comunicaciones_insert_v2 on comunicaciones;
-- drop policy if exists comunicaciones_update_v2 on comunicaciones;
-- drop policy if exists comunicaciones_delete_v2 on comunicaciones;
--
-- drop policy if exists precio_historial_select_v2 on productos_precio_historial;
-- drop policy if exists precio_historial_insert_v2 on productos_precio_historial;
-- drop policy if exists precio_historial_update_v2 on productos_precio_historial;
-- drop policy if exists precio_historial_delete_v2 on productos_precio_historial;
--
-- drop policy if exists recurrentes_select_v2 on pedidos_recurrentes;
-- drop policy if exists recurrentes_insert_v2 on pedidos_recurrentes;
-- drop policy if exists recurrentes_update_v2 on pedidos_recurrentes;
-- drop policy if exists recurrentes_delete_v2 on pedidos_recurrentes;
--
-- drop policy if exists proveedores_select_v2 on proveedores;
-- drop policy if exists proveedores_insert_v2 on proveedores;
-- drop policy if exists proveedores_update_v2 on proveedores;
-- drop policy if exists proveedores_delete_v2 on proveedores;
--
-- drop policy if exists ordenes_compra_select_v2 on ordenes_compra;
-- drop policy if exists ordenes_compra_insert_v2 on ordenes_compra;
-- drop policy if exists ordenes_compra_update_v2 on ordenes_compra;
-- drop policy if exists ordenes_compra_delete_v2 on ordenes_compra;
--
-- drop policy if exists oc_items_select_v2 on ordenes_compra_items;
-- drop policy if exists oc_items_insert_v2 on ordenes_compra_items;
-- drop policy if exists oc_items_update_v2 on ordenes_compra_items;
-- drop policy if exists oc_items_delete_v2 on ordenes_compra_items;
--
-- drop policy if exists suscripciones_select_v2 on suscripciones;
--
-- -- planes: deshabilitar RLS (vuelve a acceso libre sin policy)
-- drop policy if exists planes_select on planes;
-- alter table planes disable row level security;
--
-- -- Si el bloque 0-PRE agregó la columna en esta fase (y Fase 2 no la había creado),
-- -- revertirla también. SI Fase 2 ya la había creado, NO hacer el drop column.
-- -- Verificar antes: select column_name from information_schema.columns
-- --   where table_name='suscripciones' and column_name='negocio_id';
-- -- Solo si Fase 2 NO la había creado:
-- -- drop index if exists suscripciones_negocio_idx;
-- -- alter table suscripciones drop column if exists negocio_id;
--
-- commit;
-- ═══════════════════════════════════════════════════════════════════════════
