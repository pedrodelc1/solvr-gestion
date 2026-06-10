-- ═══════════════════════════════════════════════════════════════════════════
-- VALIDACIÓN FASE 5 — NOT NULL + Policies canónicas + Gate de suscripción
-- Solvr Gestión — plan: docs/plan-rls-multitenant.md §5 y §7 Fase 5
--
-- Ejecutar en Supabase SQL Editor después de correr 008_phase5_finalize.sql.
--
-- Secciones:
--   A. Checks automáticos (no requieren usuarios de test)
--   B. Tests de aislamiento §5.2–§5.3 (requieren usuarios de test del §5.1)
--   C. Tests del gate de suscripción §5.5.1 (requieren negocio con suscripción vencida)
--
-- Para B y C: reemplazar los UUIDs placeholders con los de tu entorno de test.
-- ═══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════
-- SECCIÓN A — Checks automáticos (ejecutar sin setup de usuarios)
-- ══════════════════════════════════════════════════════════════

-- A1: Ninguna policy _v2 sobrevive
do $$
declare v_count int;
begin
  select count(*) into v_count
    from pg_policies
   where schemaname = 'public' and policyname like '%_v2';
  raise notice 'A1: policies con sufijo _v2 restantes: % (esperado: 0) → %',
    v_count, case when v_count = 0 then 'PASS' else 'FAIL' end;
end $$;

-- A2: Conteo exacto de policies en tablas de datos = 66
do $$
declare v_count int;
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
  raise notice 'A2: policies en tablas de datos: % (esperado: 66) → %',
    v_count, case when v_count = 66 then 'PASS' else 'FAIL' end;
end $$;

-- A3: NOT NULL en las 17 tablas
do $$
declare
  v_tabla  text;
  v_notnull bool;
  v_fails  int := 0;
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

    if not coalesce(v_notnull, false) then
      raise notice 'A3: % negocio_id NULLABLE → FAIL', v_tabla;
      v_fails := v_fails + 1;
    end if;
  end loop;

  if v_fails = 0 then
    raise notice 'A3: negocio_id NOT NULL en las 17 tablas → PASS';
  else
    raise notice 'A3: % tabla(s) con negocio_id nullable → FAIL', v_fails;
  end if;
end $$;

-- A4: Policies de gobernanza intactas
do $$
declare
  v_check record;
  v_fails int := 0;
begin
  for v_check in values
    ('negocios',        'negocios_select'),
    ('negocios',        'negocios_update'),
    ('negocios',        'negocios_delete'),
    ('negocio_members', 'members_select'),
    ('negocio_members', 'members_insert'),
    ('negocio_members', 'members_update'),
    ('negocio_members', 'members_delete'),
    ('invitaciones',    'invit_select'),
    ('invitaciones',    'invit_insert'),
    ('invitaciones',    'invit_delete')
  loop
    if not exists (
      select 1 from pg_policies
       where schemaname = 'public'
         and tablename  = v_check.column1
         and policyname = v_check.column2
    ) then
      raise notice 'A4: policy %.% FALTANTE → FAIL',
        v_check.column1, v_check.column2;
      v_fails := v_fails + 1;
    end if;
  end loop;

  if v_fails = 0 then
    raise notice 'A4: políticas de gobernanza (negocios, members, invitaciones) intactas → PASS';
  end if;
end $$;

-- A5: policies viejas críticas ya no existen
do $$
declare
  v_check record;
  v_fails int := 0;
begin
  for v_check in values
    ('clientes',                   'team_read_clientes'),
    ('clientes',                   'team_insert_clientes'),
    ('pedidos',                    'team_insert_pedidos'),
    ('pedidos',                    'team_read_pedidos'),
    ('productos',                  'team_read_productos'),
    ('gastos',                     'team_read_gastos'),
    ('negocio_config',             'team_read_negocio_config'),
    ('alertas_config',             'user_own_alertas'),
    ('devoluciones',               'devoluciones_all'),
    ('comunicaciones',             'comunicaciones_all'),
    ('productos_precio_historial', 'precio_historial_all'),
    ('pedidos_recurrentes',        'recurrentes_all'),
    ('proveedores',                'proveedores_all'),
    ('ordenes_compra',             'ordenes_compra_all'),
    ('suscripciones',              'owner_manage_suscripciones'),
    ('suscripciones',              'user_insert_suscripcion')
  loop
    if exists (
      select 1 from pg_policies
       where schemaname = 'public'
         and tablename  = v_check.column1
         and policyname = v_check.column2
    ) then
      raise notice 'A5: policy vieja %.% TODAVÍA EXISTE → FAIL',
        v_check.column1, v_check.column2;
      v_fails := v_fails + 1;
    end if;
  end loop;

  if v_fails = 0 then
    raise notice 'A5: muestra de policies viejas confirmadas eliminadas → PASS';
  end if;
end $$;

-- A6: is_suscripcion_activa existe y es security definer
do $$
declare v_ok bool;
begin
  select true into v_ok
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'is_suscripcion_activa'
     and p.prosecdef = true;
  raise notice 'A6: is_suscripcion_activa security definer → %',
    case when v_ok then 'PASS' else 'FAIL' end;
end $$;

-- A7: funciones helper esenciales existen
do $$
declare
  v_fn text;
  v_fails int := 0;
begin
  foreach v_fn in array array[
    'mi_negocio_id','es_miembro','mi_rol_en',
    'puede_leer','puede_escribir','puede_eliminar','puede_administrar','es_owner',
    'is_suscripcion_activa','set_negocio_id_default',
    'accept_invitation','claim_team_access'
  ] loop
    if not exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_fn
    ) then
      raise notice 'A7: función % FALTANTE → FAIL', v_fn;
      v_fails := v_fails + 1;
    end if;
  end loop;
  if v_fails = 0 then
    raise notice 'A7: todas las funciones helper presentes → PASS';
  end if;
end $$;

-- A8: planes tiene RLS habilitado y policy de lectura
do $$
declare v_rls bool;
begin
  select relrowsecurity into v_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'planes';
  raise notice 'A8 RLS planes: % → %',
    v_rls, case when v_rls then 'PASS' else 'FAIL' end;
end $$;

do $$
declare v_ok bool;
begin
  select true into v_ok
    from pg_policies
   where schemaname = 'public' and tablename = 'planes' and policyname = 'planes_select';
  raise notice 'A8 planes_select: % → %',
    v_ok, case when v_ok then 'PASS' else 'FAIL' end;
end $$;


-- ══════════════════════════════════════════════════════════════
-- SECCIÓN B — Tests de aislamiento cross-tenant y roles
-- REQUIERE: usuarios de test definidos en §5.1 del plan.
-- Sustituir UUIDs por los de tu entorno de test.
-- ══════════════════════════════════════════════════════════════
--
-- Setup §5.1 completo debe estar ejecutado:
--   Alicia = owner Negocio Alfa (tiene datos: clientes, pedidos)
--   Bruno  = owner Negocio Beta (sin acceso a datos de Alfa)
--   Camila = vendedor en Alfa
--   Damián = visualizador en Alfa
--
-- Ajustar estas variables antes de ejecutar:
-- \set uuid_alicia 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
-- \set uuid_bruno  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
-- \set uuid_camila 'cccccccc-cccc-cccc-cccc-cccccccccccc'
-- \set uuid_damian 'dddddddd-dddd-dddd-dddd-dddddddddddd'
-- \set id_negocio_alfa '<uuid del negocio de Alicia>'
-- \set id_cliente_alfa '<uuid del cliente insertado por Alicia>'

-- T1 — Bruno no ve clientes de Alfa
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_bruno';
-- select count(*) as t1_resultado from clientes;
-- ESPERADO: 0 (solo ve los de Beta, si tiene)

-- T2 — Bruno no puede lookup directo por id de Alfa
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_bruno';
-- select * from clientes where id = :'id_cliente_alfa';
-- ESPERADO: 0 filas

-- T3 — Bruno no puede INSERT en Negocio Alfa
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_bruno';
-- insert into clientes (negocio_id, nombre) values (:'id_negocio_alfa', 'Hack');
-- ESPERADO: ERROR "new row violates row-level security policy"

-- T4 — Bruno inserta sin negocio_id: trigger lo pone en Beta, no Alfa
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_bruno';
-- insert into clientes (nombre) values ('Solo Beta');
-- select negocio_id from clientes where nombre = 'Solo Beta';
-- ESPERADO: negocio_id = Negocio Beta de Bruno (no Alfa)

-- T5 — Bruno UPDATE cross-tenant afecta 0 filas
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_bruno';
-- update clientes set nombre = 'Hacked' where negocio_id = :'id_negocio_alfa';
-- ESPERADO: UPDATE 0

-- T6 — Bruno DELETE cross-tenant afecta 0 filas
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_bruno';
-- delete from clientes where negocio_id = :'id_negocio_alfa';
-- ESPERADO: DELETE 0

-- R1 — Camila (vendedor) puede leer
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_camila';
-- select count(*) from clientes;
-- ESPERADO: >= 1

-- R4 — Camila NO puede eliminar
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_camila';
-- delete from clientes where id = :'id_cliente_alfa';
-- ESPERADO: DELETE 0

-- R5 — Camila NO puede insertar en productos (requiere puede_administrar)
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_camila';
-- insert into productos (nombre, precio) values ('Test', 100);
-- ESPERADO: ERROR o 0 filas

-- R7 — Damián (visualizador) puede leer
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_damian';
-- select count(*) from clientes;
-- ESPERADO: >= 1

-- R8 — Damián NO puede insertar
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_damian';
-- insert into clientes (nombre) values ('X');
-- ESPERADO: ERROR o 0 filas

-- M1 — Camila desactivada pierde acceso
-- Ejecutar como Alicia (owner):
-- update negocio_members set activo = false where user_id = :'uuid_camila';
-- Luego como Camila:
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_camila';
-- select count(*) from clientes;
-- ESPERADO: 0


-- ══════════════════════════════════════════════════════════════
-- SECCIÓN C — Gate de suscripción §5.5.1
-- REQUIERE: negocio de test con suscripcion vencida.
-- ══════════════════════════════════════════════════════════════
-- Estos tests son ESTRICTAMENTE VINCULANTES solo después de Fase 5.
-- Durante Fase 3-4 (coexistencia) las policies viejas pasaban escritura.
-- Ahora que las viejas se eliminaron, is_suscripcion_activa es la única guardia.
--
-- Setup antes de cada bloque:
-- update suscripciones
--    set estado = 'vencida', fecha_vencimiento = current_date - 1
--  where negocio_id = :'id_negocio_alfa';

-- S1 — Alicia puede leer con suscripción vencida (SELECT no gateado)
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_alicia';
-- select count(*) from clientes;
-- ESPERADO: count >= 1 (lectura sigue libre)

-- S2 — Alicia NO puede insertar con suscripción vencida
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_alicia';
-- insert into clientes (nombre) values ('Post-vencimiento');
-- ESPERADO: ERROR "new row violates row-level security policy"

-- S3 — Alicia NO puede actualizar con suscripción vencida
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_alicia';
-- update clientes set nombre = 'X' where id = :'id_cliente_alfa';
-- ESPERADO: UPDATE 0 o ERROR

-- S4 — Alicia NO puede eliminar con suscripción vencida
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_alicia';
-- delete from clientes where id = :'id_cliente_alfa';
-- ESPERADO: DELETE 0 o ERROR

-- S5 — Re-activar suscripción destrabea escritura
-- update suscripciones
--    set estado = 'activa', fecha_vencimiento = current_date + 30
--  where negocio_id = :'id_negocio_alfa';
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_alicia';
-- insert into clientes (nombre) values ('Post-renovacion');
-- ESPERADO: INSERT 1

-- S6 — negocios UPDATE disponible aún con suscripción vencida (exenta)
-- (restaurar vencida primero)
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_alicia';
-- update negocios set nombre = 'Renombrado' where id = :'id_negocio_alfa';
-- ESPERADO: UPDATE 1

-- S7 — negocio_members UPDATE disponible con suscripción vencida (exenta)
-- set local role authenticated;
-- set local "request.jwt.claim.sub" = :'uuid_alicia';
-- update negocio_members set activo = true where user_id = :'uuid_camila';
-- ESPERADO: UPDATE 1


-- ══════════════════════════════════════════════════════════════
-- RESUMEN — Criterios de PASS
-- ══════════════════════════════════════════════════════════════
-- Para declarar Fase 5 completada, TODOS deben verificarse:
--
-- Automáticos (Sección A):
--  ✅ A1: 0 policies _v2 restantes
--  ✅ A2: 66 policies canónicas en tablas de datos
--  ✅ A3: negocio_id NOT NULL en 17 tablas
--  ✅ A4: policies de gobernanza intactas
--  ✅ A5: muestra de policies viejas eliminadas
--  ✅ A6: is_suscripcion_activa security definer
--  ✅ A7: funciones helper presentes
--  ✅ A8: planes con RLS + planes_select
--
-- Manuales con usuarios de test (Secciones B y C):
--  ✅ T1-T6: aislamiento cross-tenant
--  ✅ R1,R4,R5,R7,R8: permisos por rol
--  ✅ M1: miembro desactivado pierde acceso
--  ✅ S1-S7: gate de suscripción estricto post-Fase 5
