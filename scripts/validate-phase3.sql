-- ═══════════════════════════════════════════════════════════════════════════
-- VALIDACIÓN FASE 3 — Mirror policies
-- Solvr Gestión — plan: docs/plan-rls-multitenant.md §5 y §7 Fase 3
--
-- Cómo usar:
--   1. Correr en Supabase SQL Editor (proyecto de staging o producción).
--   2. Cada bloque emite RAISE NOTICE si pasa o RAISE EXCEPTION si falla.
--   3. Si todos terminan sin error: Fase 3 validada.
--
-- Prerequisito: 004_phase3_mirror_policies.sql ya ejecutado.
-- ═══════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────
-- V1. Verificar que todas las policies _v2 existen
-- ────────────────────────────────────────────────────────────────────────

do $$
declare
  v_count int;
  v_esperadas int := 66;
  v_faltantes text;
begin
  select count(*) into v_count
    from pg_policies
   where schemaname = 'public'
     and (policyname like '%_v2' or policyname = 'planes_select');

  if v_count < v_esperadas then
    -- Listar cuáles faltan por tabla
    select string_agg(tablename || '(' || cmd || ')', ', ') into v_faltantes
      from (
        values
          ('clientes','SELECT'),('clientes','INSERT'),('clientes','UPDATE'),('clientes','DELETE'),
          ('productos','SELECT'),('productos','INSERT'),('productos','UPDATE'),('productos','DELETE'),
          ('pedidos','SELECT'),('pedidos','INSERT'),('pedidos','UPDATE'),('pedidos','DELETE'),
          ('pedido_items','SELECT'),('pedido_items','INSERT'),('pedido_items','UPDATE'),('pedido_items','DELETE'),
          ('gastos','SELECT'),('gastos','INSERT'),('gastos','UPDATE'),('gastos','DELETE'),
          ('categorias','SELECT'),('categorias','INSERT'),('categorias','UPDATE'),('categorias','DELETE'),
          ('negocio_config','SELECT'),('negocio_config','INSERT'),('negocio_config','UPDATE'),('negocio_config','DELETE'),
          ('alertas_config','SELECT'),('alertas_config','INSERT'),('alertas_config','UPDATE'),('alertas_config','DELETE'),
          ('devoluciones','SELECT'),('devoluciones','INSERT'),('devoluciones','UPDATE'),('devoluciones','DELETE'),
          ('devolucion_items','SELECT'),('devolucion_items','INSERT'),('devolucion_items','UPDATE'),('devolucion_items','DELETE'),
          ('comunicaciones','SELECT'),('comunicaciones','INSERT'),('comunicaciones','UPDATE'),('comunicaciones','DELETE'),
          ('productos_precio_historial','SELECT'),('productos_precio_historial','INSERT'),('productos_precio_historial','UPDATE'),('productos_precio_historial','DELETE'),
          ('pedidos_recurrentes','SELECT'),('pedidos_recurrentes','INSERT'),('pedidos_recurrentes','UPDATE'),('pedidos_recurrentes','DELETE'),
          ('proveedores','SELECT'),('proveedores','INSERT'),('proveedores','UPDATE'),('proveedores','DELETE'),
          ('ordenes_compra','SELECT'),('ordenes_compra','INSERT'),('ordenes_compra','UPDATE'),('ordenes_compra','DELETE'),
          ('ordenes_compra_items','SELECT'),('ordenes_compra_items','INSERT'),('ordenes_compra_items','UPDATE'),('ordenes_compra_items','DELETE'),
          ('suscripciones','SELECT'),
          ('planes','SELECT')
      ) as expected(t, c)
    where not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = expected.t
        and p.cmd = expected.c
        and (p.policyname like '%_v2' or p.policyname = 'planes_select')
    );

    raise exception 'V1 FAIL: % policies _v2 encontradas, esperadas %. Faltan: %',
      v_count, v_esperadas, coalesce(v_faltantes, 'no se pudo determinar');
  end if;

  raise notice 'V1 PASS: % policies _v2 + planes_select presentes.', v_count;
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- V2. Verificar que is_suscripcion_activa existe y es security definer
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
     and p.prosecdef = true
     and p.provolatile = 's';  -- stable

  if v_count = 0 then
    raise exception 'V2 FAIL: is_suscripcion_activa no existe o no es stable security definer.';
  end if;

  raise notice 'V2 PASS: is_suscripcion_activa existe, stable, security definer.';
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- V3. Verificar que planes tiene RLS habilitado
-- ────────────────────────────────────────────────────────────────────────

do $$
declare
  v_rls bool;
begin
  select relrowsecurity into v_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'planes';

  if not coalesce(v_rls, false) then
    raise exception 'V3 FAIL: tabla planes no tiene RLS habilitado.';
  end if;

  raise notice 'V3 PASS: planes tiene RLS habilitado.';
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- V4. Verificar coherencia: cada policy _v2 usa negocio_id (no user_id)
--     Detecta si alguna policy _v2 todavía referencia auth.uid() = user_id
-- ────────────────────────────────────────────────────────────────────────

do $$
declare
  v_malas text;
begin
  select string_agg(tablename || '.' || policyname, ', ') into v_malas
    from pg_policies
   where schemaname = 'public'
     and policyname like '%_v2'
     and (
       coalesce(qual, '') like '%auth.uid() = user_id%'
       or coalesce(with_check, '') like '%auth.uid() = user_id%'
     );

  if v_malas is not null then
    raise exception 'V4 FAIL: policies _v2 que aún referencian auth.uid() = user_id: %', v_malas;
  end if;

  raise notice 'V4 PASS: ninguna policy _v2 usa el patrón viejo auth.uid() = user_id.';
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- V5. Verificar que las policies viejas siguen existiendo (coexistencia)
-- ────────────────────────────────────────────────────────────────────────
-- Las viejas NO deben haberse eliminado en Fase 3. Fase 5 es quien las elimina.

do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from pg_policies
   where schemaname = 'public'
     and tablename = 'clientes'
     and policyname in ('clientes_select', 'clientes_insert', 'clientes_update', 'clientes_delete');

  if v_count < 4 then
    raise exception 'V5 FAIL: faltan policies viejas en clientes (encontradas: %). '
      'Esto indica que Fase 3 eliminó algo que no debía, o las policies viejas nunca existieron.',
      v_count;
  end if;

  raise notice 'V5 PASS: policies viejas de clientes siguen activas (coexistencia OK).';
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- V6. Test del gate de suscripción durante coexistencia
--     (lectura y verificaciones de comportamiento esperado)
-- ────────────────────────────────────────────────────────────────────────
-- NOTA: este bloque solo hace verificaciones de metadata (queries en pg_policies).
-- El test real de comportamiento (S1-S7 del plan §5.5.1) requiere impersonar
-- usuarios con set local role / set local "request.jwt.claim.sub".
-- Ver plan §5.1 para el script completo de test de aislamiento.

do $$
declare
  v_tiene_suscripcion_check bool;
begin
  -- Verificar que clientes_insert_v2 tiene el check de suscripción en with_check
  select (with_check like '%is_suscripcion_activa%') into v_tiene_suscripcion_check
    from pg_policies
   where schemaname = 'public'
     and tablename = 'clientes'
     and policyname = 'clientes_insert_v2';

  if not coalesce(v_tiene_suscripcion_check, false) then
    raise exception 'V6 FAIL: clientes_insert_v2 no contiene is_suscripcion_activa en with_check.';
  end if;

  raise notice 'V6 PASS: clientes_insert_v2 incluye gate is_suscripcion_activa.';
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- V7. Resumen final
-- ────────────────────────────────────────────────────────────────────────

do $$
declare
  v_v2_count int;
  v_tablas_cubiertas text;
begin
  select count(distinct tablename) into v_v2_count
    from pg_policies
   where schemaname = 'public'
     and (policyname like '%_v2' or policyname = 'planes_select');

  select string_agg(distinct tablename order by tablename, ', ') into v_tablas_cubiertas
    from pg_policies
   where schemaname = 'public'
     and (policyname like '%_v2' or policyname = 'planes_select');

  raise notice '═══ FASE 3 VALIDADA ═══';
  raise notice '% tablas con policies _v2: %', v_v2_count, v_tablas_cubiertas;
  raise notice 'Estado: COEXISTENCIA activa (policies viejas + nuevas, combinadas con OR).';
  raise notice 'Próximo paso: soak 24-72h → Fase 4 (migrar db.js + App.jsx).';
end $$;
