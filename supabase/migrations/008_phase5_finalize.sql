-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 5 — NOT NULL + drop policies viejas + rename _v2 → canonico
-- Solvr Gestión — plan: docs/plan-rls-multitenant.md §7 Fase 5
--
-- QUÉ HACE:
--   1. Pre-check: verifica que negocio_id no tenga NULLs en ninguna tabla.
--      Si los hay, la transacción aborta antes de tocar policies.
--   2. Aplica `NOT NULL` a negocio_id en las 17 tablas de datos.
--   3. Elimina todas las policies viejas (las que usaban user_id /
--      allowed_emails / get_my_role / is_my_owner_data).
--   4. Renombra las policies _v2 a su nombre canónico (sin sufijo).
--   5. Validación inline: ninguna policy _v2 sobrevive, conteo correcto.
--
-- PREREQUISITO:
--   Fase 4 deployada y estable en producción ≥ 1 semana sin issues.
--   Todas las filas tienen negocio_id != NULL (backfill Fase 2 / trigger Fase 3).
--
-- RIESGO:
--   Alto si queda alguna fila con negocio_id IS NULL → el ALTER falla.
--   Alto si el frontend no migró → todas las escrituras se rompen al
--   no tener la policy vieja que aceptaba auth.uid() = user_id.
--   VERIFICAR que Fase 4 está deployada ANTES de ejecutar este script.
--
-- IDEMPOTENTE:
--   DROP POLICY IF EXISTS es seguro de re-ejecutar.
--   RENAME falla si el nombre nuevo ya existe o el viejo no existe.
--   Si se interrumpe entre DROP y RENAME, re-ejecutar dentro de la
--   misma transacción vuelve a un estado consistente.
--
-- ROLLBACK: ver sección al final del archivo (comentada).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ────────────────────────────────────────────────────────────────────────
-- 1. PRE-CHECK: negocio_id sin NULLs en las 17 tablas
-- ────────────────────────────────────────────────────────────────────────
-- Si falla, la transacción aborta y no se toca nada más.
-- Indica que el backfill de Fase 2 no se completó o hubo inserts
-- entre Fase 2 y Fase 3 que el trigger no cubrió.

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
      'select count(*) from %I where negocio_id is null', v_tabla
    ) into v_nulls;

    if v_nulls > 0 then
      raise exception
        'PRE-CHECK fallido: % fila(s) en % con negocio_id IS NULL. '
        'Completar backfill antes de aplicar NOT NULL (Fase 5 abortada).',
        v_nulls, v_tabla;
    end if;
  end loop;

  raise notice 'PRE-CHECK OK: 0 NULLs en negocio_id en las 17 tablas.';
end $$;


-- ────────────────────────────────────────────────────────────────────────
-- 2. NOT NULL en negocio_id (17 tablas)
-- ────────────────────────────────────────────────────────────────────────

alter table clientes                   alter column negocio_id set not null;
alter table productos                  alter column negocio_id set not null;
alter table pedidos                    alter column negocio_id set not null;
alter table gastos                     alter column negocio_id set not null;
alter table categorias                 alter column negocio_id set not null;
alter table alertas_config             alter column negocio_id set not null;
alter table suscripciones              alter column negocio_id set not null;
alter table negocio_config             alter column negocio_id set not null;
alter table devoluciones               alter column negocio_id set not null;
alter table comunicaciones             alter column negocio_id set not null;
alter table productos_precio_historial alter column negocio_id set not null;
alter table pedidos_recurrentes        alter column negocio_id set not null;
alter table proveedores                alter column negocio_id set not null;
alter table ordenes_compra             alter column negocio_id set not null;
alter table pedido_items               alter column negocio_id set not null;
alter table devolucion_items           alter column negocio_id set not null;
alter table ordenes_compra_items       alter column negocio_id set not null;


-- ────────────────────────────────────────────────────────────────────────
-- 3. DROP policies viejas
-- ────────────────────────────────────────────────────────────────────────
-- Todas usan auth.uid() = user_id, allowed_emails, get_my_role() o
-- is_my_owner_data(). Son reemplazadas por las _v2 (negocio_id).
-- Se usan DROP IF EXISTS para idempotencia.

-- ── clientes ────────────────────────────────────────────────────────────
drop policy if exists clientes_select         on clientes;
drop policy if exists team_read_clientes      on clientes;
drop policy if exists clientes_insert         on clientes;
drop policy if exists team_insert_clientes    on clientes;
drop policy if exists clientes_update         on clientes;
drop policy if exists team_update_clientes    on clientes;
drop policy if exists clientes_delete         on clientes;
drop policy if exists team_delete_clientes    on clientes;

-- ── pedidos ─────────────────────────────────────────────────────────────
drop policy if exists pedidos_select          on pedidos;
drop policy if exists team_read_pedidos       on pedidos;
drop policy if exists pedidos_insert          on pedidos;
drop policy if exists team_insert_pedidos     on pedidos;
drop policy if exists pedidos_update          on pedidos;
drop policy if exists team_update_pedidos     on pedidos;
drop policy if exists pedidos_delete          on pedidos;
drop policy if exists team_delete_pedidos     on pedidos;

-- ── pedido_items ─────────────────────────────────────────────────────────
drop policy if exists pedido_items_select     on pedido_items;
drop policy if exists pedido_items_insert     on pedido_items;
drop policy if exists pedido_items_update     on pedido_items;
drop policy if exists pedido_items_delete     on pedido_items;

-- ── productos ────────────────────────────────────────────────────────────
drop policy if exists productos_select        on productos;
drop policy if exists team_read_productos     on productos;
drop policy if exists productos_insert        on productos;
drop policy if exists team_insert_productos   on productos;
drop policy if exists productos_update        on productos;
drop policy if exists team_update_productos   on productos;
drop policy if exists productos_delete        on productos;
drop policy if exists team_delete_productos   on productos;

-- ── gastos ───────────────────────────────────────────────────────────────
drop policy if exists gastos_select           on gastos;
drop policy if exists team_read_gastos        on gastos;
drop policy if exists gastos_insert           on gastos;
drop policy if exists gastos_update           on gastos;
drop policy if exists gastos_delete           on gastos;

-- ── categorias ───────────────────────────────────────────────────────────
drop policy if exists categorias_select       on categorias;
drop policy if exists categorias_insert       on categorias;
drop policy if exists categorias_update       on categorias;
drop policy if exists categorias_delete       on categorias;

-- ── negocio_config ───────────────────────────────────────────────────────
drop policy if exists negocio_config_select        on negocio_config;
drop policy if exists team_read_negocio_config     on negocio_config;
drop policy if exists negocio_config_insert        on negocio_config;
drop policy if exists negocio_config_update        on negocio_config;

-- ── alertas_config ───────────────────────────────────────────────────────
drop policy if exists user_own_alertas             on alertas_config;

-- ── devoluciones ─────────────────────────────────────────────────────────
drop policy if exists devoluciones_all             on devoluciones;
drop policy if exists team_insert_devoluciones     on devoluciones;

-- ── devolucion_items ─────────────────────────────────────────────────────
drop policy if exists devolucion_items_select      on devolucion_items;
drop policy if exists devolucion_items_insert      on devolucion_items;
drop policy if exists devolucion_items_delete      on devolucion_items;

-- ── comunicaciones ───────────────────────────────────────────────────────
drop policy if exists comunicaciones_all           on comunicaciones;
drop policy if exists team_insert_comunicaciones   on comunicaciones;

-- ── productos_precio_historial ───────────────────────────────────────────
drop policy if exists precio_historial_all         on productos_precio_historial;

-- ── pedidos_recurrentes ──────────────────────────────────────────────────
drop policy if exists recurrentes_all              on pedidos_recurrentes;

-- ── suscripciones ────────────────────────────────────────────────────────
drop policy if exists user_own_suscripcion         on suscripciones;
drop policy if exists owner_see_all_suscripciones  on suscripciones;
drop policy if exists user_insert_suscripcion      on suscripciones;
drop policy if exists owner_manage_suscripciones   on suscripciones;

-- ── proveedores ──────────────────────────────────────────────────────────
drop policy if exists proveedores_all              on proveedores;

-- ── ordenes_compra ───────────────────────────────────────────────────────
drop policy if exists ordenes_compra_all           on ordenes_compra;

-- ── ordenes_compra_items ─────────────────────────────────────────────────
drop policy if exists oc_items_select              on ordenes_compra_items;
drop policy if exists oc_items_insert              on ordenes_compra_items;
drop policy if exists oc_items_delete              on ordenes_compra_items;


-- ────────────────────────────────────────────────────────────────────────
-- 4. Renombrar _v2 → nombre canónico
-- ────────────────────────────────────────────────────────────────────────
-- Las policies viejas con el mismo nombre ya fueron dropped arriba,
-- por lo que el rename no produce conflicto.
-- planes_select ya tiene nombre canónico — no necesita rename.

-- ── clientes ─────────────────────────────────────────────────────────────
alter policy clientes_select_v2 on clientes rename to clientes_select;
alter policy clientes_insert_v2 on clientes rename to clientes_insert;
alter policy clientes_update_v2 on clientes rename to clientes_update;
alter policy clientes_delete_v2 on clientes rename to clientes_delete;

-- ── productos ────────────────────────────────────────────────────────────
alter policy productos_select_v2 on productos rename to productos_select;
alter policy productos_insert_v2 on productos rename to productos_insert;
alter policy productos_update_v2 on productos rename to productos_update;
alter policy productos_delete_v2 on productos rename to productos_delete;

-- ── pedidos ──────────────────────────────────────────────────────────────
alter policy pedidos_select_v2 on pedidos rename to pedidos_select;
alter policy pedidos_insert_v2 on pedidos rename to pedidos_insert;
alter policy pedidos_update_v2 on pedidos rename to pedidos_update;
alter policy pedidos_delete_v2 on pedidos rename to pedidos_delete;

-- ── pedido_items ─────────────────────────────────────────────────────────
alter policy pedido_items_select_v2 on pedido_items rename to pedido_items_select;
alter policy pedido_items_insert_v2 on pedido_items rename to pedido_items_insert;
alter policy pedido_items_update_v2 on pedido_items rename to pedido_items_update;
alter policy pedido_items_delete_v2 on pedido_items rename to pedido_items_delete;

-- ── gastos ───────────────────────────────────────────────────────────────
alter policy gastos_select_v2 on gastos rename to gastos_select;
alter policy gastos_insert_v2 on gastos rename to gastos_insert;
alter policy gastos_update_v2 on gastos rename to gastos_update;
alter policy gastos_delete_v2 on gastos rename to gastos_delete;

-- ── categorias ───────────────────────────────────────────────────────────
alter policy categorias_select_v2 on categorias rename to categorias_select;
alter policy categorias_insert_v2 on categorias rename to categorias_insert;
alter policy categorias_update_v2 on categorias rename to categorias_update;
alter policy categorias_delete_v2 on categorias rename to categorias_delete;

-- ── negocio_config ───────────────────────────────────────────────────────
alter policy negocio_config_select_v2 on negocio_config rename to negocio_config_select;
alter policy negocio_config_insert_v2 on negocio_config rename to negocio_config_insert;
alter policy negocio_config_update_v2 on negocio_config rename to negocio_config_update;
alter policy negocio_config_delete_v2 on negocio_config rename to negocio_config_delete;

-- ── alertas_config ───────────────────────────────────────────────────────
alter policy alertas_config_select_v2 on alertas_config rename to alertas_config_select;
alter policy alertas_config_insert_v2 on alertas_config rename to alertas_config_insert;
alter policy alertas_config_update_v2 on alertas_config rename to alertas_config_update;
alter policy alertas_config_delete_v2 on alertas_config rename to alertas_config_delete;

-- ── devoluciones ─────────────────────────────────────────────────────────
alter policy devoluciones_select_v2 on devoluciones rename to devoluciones_select;
alter policy devoluciones_insert_v2 on devoluciones rename to devoluciones_insert;
alter policy devoluciones_update_v2 on devoluciones rename to devoluciones_update;
alter policy devoluciones_delete_v2 on devoluciones rename to devoluciones_delete;

-- ── devolucion_items ─────────────────────────────────────────────────────
alter policy devolucion_items_select_v2 on devolucion_items rename to devolucion_items_select;
alter policy devolucion_items_insert_v2 on devolucion_items rename to devolucion_items_insert;
alter policy devolucion_items_update_v2 on devolucion_items rename to devolucion_items_update;
alter policy devolucion_items_delete_v2 on devolucion_items rename to devolucion_items_delete;

-- ── comunicaciones ───────────────────────────────────────────────────────
alter policy comunicaciones_select_v2 on comunicaciones rename to comunicaciones_select;
alter policy comunicaciones_insert_v2 on comunicaciones rename to comunicaciones_insert;
alter policy comunicaciones_update_v2 on comunicaciones rename to comunicaciones_update;
alter policy comunicaciones_delete_v2 on comunicaciones rename to comunicaciones_delete;

-- ── productos_precio_historial ───────────────────────────────────────────
alter policy precio_historial_select_v2 on productos_precio_historial rename to precio_historial_select;
alter policy precio_historial_insert_v2 on productos_precio_historial rename to precio_historial_insert;
alter policy precio_historial_update_v2 on productos_precio_historial rename to precio_historial_update;
alter policy precio_historial_delete_v2 on productos_precio_historial rename to precio_historial_delete;

-- ── pedidos_recurrentes ──────────────────────────────────────────────────
alter policy recurrentes_select_v2 on pedidos_recurrentes rename to recurrentes_select;
alter policy recurrentes_insert_v2 on pedidos_recurrentes rename to recurrentes_insert;
alter policy recurrentes_update_v2 on pedidos_recurrentes rename to recurrentes_update;
alter policy recurrentes_delete_v2 on pedidos_recurrentes rename to recurrentes_delete;

-- ── proveedores ──────────────────────────────────────────────────────────
alter policy proveedores_select_v2 on proveedores rename to proveedores_select;
alter policy proveedores_insert_v2 on proveedores rename to proveedores_insert;
alter policy proveedores_update_v2 on proveedores rename to proveedores_update;
alter policy proveedores_delete_v2 on proveedores rename to proveedores_delete;

-- ── ordenes_compra ───────────────────────────────────────────────────────
alter policy ordenes_compra_select_v2 on ordenes_compra rename to ordenes_compra_select;
alter policy ordenes_compra_insert_v2 on ordenes_compra rename to ordenes_compra_insert;
alter policy ordenes_compra_update_v2 on ordenes_compra rename to ordenes_compra_update;
alter policy ordenes_compra_delete_v2 on ordenes_compra rename to ordenes_compra_delete;

-- ── ordenes_compra_items ─────────────────────────────────────────────────
alter policy oc_items_select_v2 on ordenes_compra_items rename to oc_items_select;
alter policy oc_items_insert_v2 on ordenes_compra_items rename to oc_items_insert;
alter policy oc_items_update_v2 on ordenes_compra_items rename to oc_items_update;
alter policy oc_items_delete_v2 on ordenes_compra_items rename to oc_items_delete;

-- ── suscripciones ────────────────────────────────────────────────────────
alter policy suscripciones_select_v2 on suscripciones rename to suscripciones_select;

-- planes_select: nombre ya canónico desde Fase 3. Sin rename.


-- ────────────────────────────────────────────────────────────────────────
-- 5. Validación inline
-- ────────────────────────────────────────────────────────────────────────

-- V1: 0 policies con sufijo _v2 quedan
do $$
declare v_count int;
begin
  select count(*) into v_count
    from pg_policies
   where schemaname = 'public' and policyname like '%_v2';

  if v_count > 0 then
    raise exception
      'V1 FAIL: quedan % policies con sufijo _v2. '
      'El rename no se completó.', v_count;
  end if;
  raise notice 'V1 PASS: 0 policies con sufijo _v2 en public.';
end $$;

-- V2: ninguna policy vieja (muestra de las más críticas) sobrevive
do $$
declare
  v_nombre text;
  v_tabla  text;
begin
  -- sample de policies viejas que NO deben existir
  for v_nombre, v_tabla in values
    ('team_read_clientes',        'clientes'),
    ('team_insert_pedidos',       'pedidos'),
    ('user_own_alertas',          'alertas_config'),
    ('devoluciones_all',          'devoluciones'),
    ('comunicaciones_all',        'comunicaciones'),
    ('precio_historial_all',      'productos_precio_historial'),
    ('recurrentes_all',           'pedidos_recurrentes'),
    ('proveedores_all',           'proveedores'),
    ('ordenes_compra_all',        'ordenes_compra'),
    ('owner_manage_suscripciones','suscripciones')
  loop
    if exists (
      select 1 from pg_policies
       where schemaname = 'public'
         and tablename = v_tabla
         and policyname = v_nombre
    ) then
      raise exception
        'V2 FAIL: policy vieja % en % sigue existiendo.',
        v_nombre, v_tabla;
    end if;
  end loop;
  raise notice 'V2 PASS: muestra de policies viejas confirmadas eliminadas.';
end $$;

-- V3: conteo de policies en tablas de datos (debe ser 66 canónicas)
do $$
declare
  v_count    int;
  v_esperadas int := 66;
begin
  select count(*) into v_count
    from pg_policies
   where schemaname = 'public'
     and tablename in (
       'clientes','productos','pedidos','pedido_items','gastos','categorias',
       'negocio_config','alertas_config','devoluciones','devolucion_items',
       'comunicaciones','productos_precio_historial','pedidos_recurrentes',
       'proveedores','ordenes_compra','ordenes_compra_items',
       'suscripciones','planes'
     );

  if v_count <> v_esperadas then
    raise exception
      'V3 FAIL: se esperaban % policies en tablas de datos, se encontraron %. '
      'Revisar drops y renames.', v_esperadas, v_count;
  end if;
  raise notice 'V3 PASS: % policies canónicas en tablas de datos.', v_count;
end $$;

-- V4: NOT NULL confirmado en las 17 tablas (via pg_attribute)
do $$
declare
  v_tabla  text;
  v_notnull bool;
begin
  foreach v_tabla in array array[
    'clientes','productos','pedidos','gastos','categorias',
    'alertas_config','suscripciones','negocio_config','devoluciones',
    'comunicaciones','productos_precio_historial','pedidos_recurrentes',
    'proveedores','ordenes_compra',
    'pedido_items','devolucion_items','ordenes_compra_items'
  ] loop
    select a.attnotnull into v_notnull
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = v_tabla
       and a.attname = 'negocio_id';

    if not v_notnull then
      raise exception
        'V4 FAIL: negocio_id en % todavía es nullable.',
        v_tabla;
    end if;
  end loop;
  raise notice 'V4 PASS: negocio_id NOT NULL confirmado en las 17 tablas.';
end $$;

-- V5: tablas de gobernanza no tocadas por este script
do $$
begin
  -- negocios, negocio_members, invitaciones tienen sus policies (creadas en Fase 1)
  -- y no deben aparecer en el conteo de arriba. Verificar que siguen intactas.
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='negocios' and policyname='negocios_select'
  ) then
    raise exception 'V5 FAIL: negocios_select desapareció.';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='negocio_members' and policyname='members_select'
  ) then
    raise exception 'V5 FAIL: members_select desapareció.';
  end if;
  raise notice 'V5 PASS: policies de gobernanza (negocios, negocio_members) intactas.';
end $$;

commit;


-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK FASE 5
-- ═══════════════════════════════════════════════════════════════════════════
-- IMPORTANTE: ejecutar SÓLO si Fase 4 también está siendo revertida.
-- Si la app ya usa negocio_id, volver a activar las policies viejas rompe
-- el flujo de team members (que ya no pasan auth.uid() = user_id).
--
-- Para revertir:
--   1. Renombrar las policies canónicas de vuelta a _v2.
--   2. Recrear las policies viejas (copiar de 002_phase1_tenancy.sql y
--      del schema original en docs/baseline-policies.md).
--   3. Quitar NOT NULL (no es posible en Postgres sin recrear la columna;
--      alternativa: setear un default NULL y asegurarse de que no hay
--      inserts nuevos sin negocio_id).
--
-- Dado que quitar NOT NULL requiere recrear la columna, el rollback real
-- de este paso es:
--   a. Restaurar backup de base de datos pre-Fase 5.
--   b. Rollback del deploy del frontend a la versión de Fase 4.
-- Por eso el soak de 1 semana post-Fase 4 es crítico antes de ejecutar Fase 5.
-- ═══════════════════════════════════════════════════════════════════════════
